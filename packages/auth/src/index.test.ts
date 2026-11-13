import {
	createTestDatabase,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
	AUTH_RATE_LIMIT_MAX_REQUESTS,
	type AuthConfig,
	createAuth,
} from "./index";

const TEST_CONFIG: AuthConfig = {
	BETTER_AUTH_SECRET: "test-secret-for-vitest-only-0123456789abcdef",
	BETTER_AUTH_URL: "http://localhost:3000",
	CORS_ORIGIN: "http://localhost:3001",
};
const TEST_PASSWORD = "password-1234";
const HTTP_OK = 200;
const HTTP_TOO_MANY_REQUESTS = 429;
const USER_ALREADY_EXISTS_CODE_PATTERN = /^USER_ALREADY_EXISTS/;
const SESSION_TOKEN_COOKIE_PATTERN = /session_token=[^;]+/;

const db = createTestDatabase();
const auth = createAuth(TEST_CONFIG, db);

/**
 * Better Auth 的内存限流存储是模块级的，同一进程内的所有 auth 实例共享计数，
 * 所以每个用例都用自己的 IP（通过 x-forwarded-for 传入）来隔离计数。
 */
let ipCounter = 0;
function nextIp(): string {
	ipCounter += 1;
	return `198.51.100.${ipCounter}`;
}

let emailCounter = 0;
function nextEmail(): string {
	emailCounter += 1;
	return `user-${emailCounter}@example.com`;
}

interface RequestOptions {
	body?: Record<string, unknown>;
	cookie?: string;
	ip: string;
}

function postAuth(
	path: string,
	{ body = {}, cookie, ip }: RequestOptions
): Promise<Response> {
	const headers = new Headers({
		"content-type": "application/json",
		origin: TEST_CONFIG.CORS_ORIGIN,
		"x-forwarded-for": ip,
	});
	if (cookie) {
		headers.set("cookie", cookie);
	}
	return auth.handler(
		new Request(`${TEST_CONFIG.BETTER_AUTH_URL}/api/auth${path}`, {
			body: JSON.stringify(body),
			headers,
			method: "POST",
		})
	);
}

function signUp(ip: string, email: string = nextEmail()): Promise<Response> {
	return postAuth("/sign-up/email", {
		body: { email, name: "测试用户", password: TEST_PASSWORD },
		ip,
	});
}

function signIn(ip: string, email: string): Promise<Response> {
	return postAuth("/sign-in/email", {
		body: { email, password: TEST_PASSWORD },
		ip,
	});
}

/** 把响应的 Set-Cookie 转成后续请求的 Cookie 请求头 */
function toCookieHeader(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

function getSession(cookie: string) {
	return auth.api.getSession({ headers: new Headers({ cookie }) });
}

/** 逐个发送 count 次请求并返回各自的状态码：限流按请求先后计数，不能并发 */
async function sendSequentially(
	send: () => Promise<Response>,
	count: number
): Promise<number[]> {
	if (count <= 0) {
		return [];
	}
	const { status } = await send();
	return [status, ...(await sendSequentially(send, count - 1))];
}

beforeEach(async () => {
	await resetTestDatabase(db);
});

afterAll(async () => {
	await db.$disconnect();
});

describe("注册", () => {
	it("注册成功返回会话 Cookie，即自动登录", async () => {
		const email = nextEmail();
		const response = await signUp(nextIp(), email);

		expect(response.status).toBe(HTTP_OK);
		const cookie = toCookieHeader(response);
		expect(cookie).toMatch(SESSION_TOKEN_COOKIE_PATTERN);

		const session = await getSession(cookie);
		expect(session?.user.email).toBe(email);
	});

	it("同一邮箱再次注册返回 USER_ALREADY_EXISTS 类错误码", async () => {
		const ip = nextIp();
		const email = nextEmail();
		await signUp(ip, email);

		const response = await signUp(ip, email);

		expect(response.status).not.toBe(HTTP_OK);
		const body = (await response.json()) as { code?: string };
		expect(body.code).toMatch(USER_ALREADY_EXISTS_CODE_PATTERN);
	});
});

describe("限流", () => {
	it("同一 IP 连续注册 5 次都不是 429，第 6 次是 429", async () => {
		const ip = nextIp();

		const statuses = await sendSequentially(
			() => signUp(ip),
			AUTH_RATE_LIMIT_MAX_REQUESTS
		);
		expect(statuses).not.toContain(HTTP_TOO_MANY_REQUESTS);

		const limited = await signUp(ip);
		expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
		expect(limited.headers.get("X-Retry-After")).not.toBeNull();
	});

	it("同一 IP 连续登录 5 次都不是 429，第 6 次是 429", async () => {
		const email = nextEmail();
		await signUp(nextIp(), email);
		const ip = nextIp();

		const statuses = await sendSequentially(
			() => signIn(ip, email),
			AUTH_RATE_LIMIT_MAX_REQUESTS
		);
		expect(statuses).not.toContain(HTTP_TOO_MANY_REQUESTS);

		const limited = await signIn(ip, email);
		expect(limited.status).toBe(HTTP_TOO_MANY_REQUESTS);
	});

	it("注册和登录分开计数", async () => {
		const ip = nextIp();
		const email = nextEmail();
		await sendSequentially(() => signUp(ip), AUTH_RATE_LIMIT_MAX_REQUESTS);
		expect((await signUp(ip)).status).toBe(HTTP_TOO_MANY_REQUESTS);

		// 注册已被限流，同一 IP 的登录不受影响
		await signUp(nextIp(), email);
		const statuses = await sendSequentially(
			() => signIn(ip, email),
			AUTH_RATE_LIMIT_MAX_REQUESTS
		);
		expect(statuses).not.toContain(HTTP_TOO_MANY_REQUESTS);
		expect((await signIn(ip, email)).status).toBe(HTTP_TOO_MANY_REQUESTS);
	});

	it("换一个 x-forwarded-for 的 IP 不受影响", async () => {
		const limitedIp = nextIp();
		await sendSequentially(
			() => signUp(limitedIp),
			AUTH_RATE_LIMIT_MAX_REQUESTS
		);
		expect((await signUp(limitedIp)).status).toBe(HTTP_TOO_MANY_REQUESTS);

		const otherIpResponse = await signUp(nextIp());
		expect(otherIpResponse.status).toBe(HTTP_OK);
	});
});

describe("退出登录", () => {
	it("退出登录后用原 Cookie 调 getSession 得到 null", async () => {
		const ip = nextIp();
		const cookie = toCookieHeader(await signUp(ip));
		expect(await getSession(cookie)).not.toBeNull();

		const response = await postAuth("/sign-out", { cookie, ip });

		expect(response.status).toBe(HTTP_OK);
		expect(await getSession(cookie)).toBeNull();
	});
});
