import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { type AppCode, getAppErrorData, type TrpcErrorCode } from "../errors";
import { createGithubClient, type GithubClient } from "./client";

const NOW = Date.UTC(2026, 10, 10, 8, 0, 0);
const RESET_SECONDS = 1_800_000_000;
const MS_PER_SECOND = 1000;
const DEFAULT_RETRY_MS = 60_000;
const RETRY_AFTER_SECONDS = 30;
const TOKEN = "ghp_test_token";
const FIRST_TYPE_QUALIFIER = /(?:^|\s)type:(user|org)\b/i;

const searchBody = {
	incomplete_results: false,
	items: [
		{
			avatar_url: "https://avatars.githubusercontent.com/u/1",
			html_url: "https://github.com/octocat",
			id: 1,
			login: "octocat",
			type: "User",
		},
	],
	total_count: 1,
};

const userBody = {
	avatar_url: "https://avatars.githubusercontent.com/u/1",
	bio: null,
	blog: "https://github.blog",
	company: "@github",
	created_at: "2011-01-25T18:44:36Z",
	email: null,
	followers: 100,
	following: 9,
	html_url: "https://github.com/octocat",
	id: 1,
	location: "San Francisco",
	login: "octocat",
	name: "The Octocat",
	public_gists: 8,
	public_repos: 8,
	site_admin: false,
	updated_at: "2026-01-01T00:00:00Z",
};

const jsonResponse = (
	body: unknown,
	status = 200,
	headers: Record<string, string> = {}
): Response =>
	new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json", ...headers },
		status,
	});

type FetchHandler = () => Response | Promise<Response>;

const createFakeFetch = (handler: FetchHandler) =>
	vi.fn<typeof fetch>(async () => await handler());

const setup = (handler: FetchHandler, token?: string) => {
	const fakeFetch = createFakeFetch(handler);
	const client = createGithubClient({
		fetch: fakeFetch,
		now: () => NOW,
		token,
	});
	return { client, fakeFetch };
};

/** 取第 n 次调用的 URL 和请求头 */
const getRequest = (fakeFetch: ReturnType<typeof createFakeFetch>, n = 0) => {
	const [input, init] = fakeFetch.mock.calls[n] ?? [];
	return {
		headers: new Headers(init?.headers),
		signal: init?.signal,
		url: new URL(String(input)),
	};
};

const captureError = async (promise: Promise<unknown>): Promise<TRPCError> => {
	try {
		await promise;
	} catch (error) {
		if (error instanceof TRPCError) {
			return error;
		}
		throw new Error(`期望抛出 TRPCError，实际是 ${String(error)}`, {
			cause: error,
		});
	}
	throw new Error("期望抛出 TRPCError，实际没有抛错");
};

interface ExpectedError {
	appCode: AppCode;
	code: TrpcErrorCode;
	resetAt?: number | null;
}

const expectAppError = (error: TRPCError, expected: ExpectedError) => {
	expect(error.code).toBe(expected.code);
	const data = getAppErrorData(error);
	expect(data.appCode).toBe(expected.appCode);
	expect(data.resetAt).toBe(expected.resetAt ?? null);
};

interface Endpoint {
	call: (client: GithubClient) => Promise<unknown>;
	name: string;
	rateLimitedCode: AppCode;
}

const endpoints: Endpoint[] = [
	{
		call: (client) => client.searchUsers({ page: 1, q: "octo" }),
		name: "searchUsers",
		rateLimitedCode: "GITHUB_SEARCH_RATE_LIMITED",
	},
	{
		call: (client) => client.getUserByLogin("octocat"),
		name: "getUserByLogin",
		rateLimitedCode: "GITHUB_RATE_LIMITED",
	},
	{
		call: (client) => client.getUserById(1),
		name: "getUserById",
		rateLimitedCode: "GITHUB_RATE_LIMITED",
	},
];

describe("请求", () => {
	it("每个请求都带 GitHub 要求的请求头，没配置 token 时不带 Authorization", async () => {
		const { client, fakeFetch } = setup(() => jsonResponse(userBody));
		await client.getUserByLogin("octocat");

		const { headers, signal } = getRequest(fakeFetch);
		expect(headers.get("accept")).toBe("application/vnd.github+json");
		expect(headers.get("x-github-api-version")).toBe("2022-11-28");
		expect(headers.get("user-agent")).toBe("zyk-aws-admin");
		expect(headers.has("authorization")).toBe(false);
		expect(signal).toBeInstanceOf(AbortSignal);
	});

	it("配置了 token 时带 Authorization: Bearer <token>", async () => {
		const { client, fakeFetch } = setup(() => jsonResponse(searchBody), TOKEN);
		await client.searchUsers({ page: 1, q: "octo" });

		const { headers } = getRequest(fakeFetch);
		expect(headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
		expect(headers.get("accept")).toBe("application/vnd.github+json");
	});

	it("token 为空字符串时不带 Authorization", async () => {
		const { client, fakeFetch } = setup(() => jsonResponse(userBody), "");
		await client.getUserById(1);

		expect(getRequest(fakeFetch).headers.has("authorization")).toBe(false);
	});

	it("搜索 URL 带 type:user、per_page=10 和页码", async () => {
		const { client, fakeFetch } = setup(() => jsonResponse(searchBody));
		await client.searchUsers({ page: 3, q: "octo cat" });

		const { url } = getRequest(fakeFetch);
		expect(url.origin).toBe("https://api.github.com");
		expect(url.pathname).toBe("/search/users");
		expect(url.searchParams.get("q")).toBe("type:user octo cat");
		expect(url.searchParams.get("per_page")).toBe("10");
		expect(url.searchParams.get("page")).toBe("3");
	});

	it("输入组织限定符时仍只搜索个人账号", async () => {
		// 按真实 GitHub API 的行为模拟：重复 type 限定符采用第一个。
		const fakeFetch = vi.fn<typeof fetch>((input) => {
			const query = new URL(String(input)).searchParams.get("q") ?? "";
			const organization = FIRST_TYPE_QUALIFIER.exec(query)?.[1] === "org";
			return Promise.resolve(
				jsonResponse({
					...searchBody,
					items: [
						{
							...searchBody.items[0],
							login: organization ? "github" : "octocat",
							type: organization ? "Organization" : "User",
						},
					],
				})
			);
		});
		const client = createGithubClient({ fetch: fakeFetch });
		const result = await client.searchUsers({ page: 1, q: "type:org" });
		expect(result.items.map((user) => user.login)).toEqual(["octocat"]);
	});

	it("资料查询的路径分别是 /users/{login} 和 /user/{id}", async () => {
		const { client, fakeFetch } = setup(() => jsonResponse(userBody));
		await client.getUserByLogin("Octo-Cat");
		await client.getUserById(42);

		expect(getRequest(fakeFetch, 0).url.href).toBe(
			"https://api.github.com/users/Octo-Cat"
		);
		expect(getRequest(fakeFetch, 1).url.href).toBe(
			"https://api.github.com/user/42"
		);
	});
});

describe("成功响应", () => {
	it("searchUsers 返回 total 和只含需要字段的 items", async () => {
		const { client } = setup(() => jsonResponse(searchBody));

		await expect(client.searchUsers({ page: 1, q: "octo" })).resolves.toEqual({
			items: [
				{
					avatar_url: "https://avatars.githubusercontent.com/u/1",
					html_url: "https://github.com/octocat",
					id: 1,
					login: "octocat",
				},
			],
			total: 1,
		});
	});

	it.each([
		{ call: (client: GithubClient) => client.getUserByLogin("octocat") },
		{ call: (client: GithubClient) => client.getUserById(1) },
	])("资料查询返回校验后的资料（$call）", async ({ call }) => {
		const { client } = setup(() =>
			jsonResponse({ ...userBody, twitter_username: undefined })
		);
		const profile = await call(client);

		expect(profile).toMatchObject({
			bio: null,
			created_at: "2011-01-25T18:44:36Z",
			id: 1,
			login: "octocat",
			twitter_username: null,
		});
		expect(profile).not.toHaveProperty("site_admin");
	});
});

describe.each(endpoints)("$name 的错误映射", ({ call, rateLimitedCode }) => {
	it("404 → NOT_FOUND / GITHUB_USER_NOT_FOUND", async () => {
		const { client } = setup(() => jsonResponse({ message: "Not Found" }, 404));

		expectAppError(await captureError(call(client)), {
			appCode: "GITHUB_USER_NOT_FOUND",
			code: "NOT_FOUND",
		});
	});

	it("403 且 x-ratelimit-remaining=0 → TOO_MANY_REQUESTS，resetAt 取自 x-ratelimit-reset", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "rate limit" }, 403, {
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": String(RESET_SECONDS),
			})
		);

		expectAppError(await captureError(call(client)), {
			appCode: rateLimitedCode,
			code: "TOO_MANY_REQUESTS",
			resetAt: RESET_SECONDS * MS_PER_SECOND,
		});
	});

	it("403 但额度没用完 → BAD_GATEWAY / GITHUB_UNAVAILABLE", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "Forbidden" }, 403, {
				"x-ratelimit-remaining": "42",
			})
		);

		expectAppError(await captureError(call(client)), {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
	});

	it("429 → TOO_MANY_REQUESTS，resetAt 取自 x-ratelimit-reset", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "Too Many Requests" }, 429, {
				"x-ratelimit-remaining": "0",
				"x-ratelimit-reset": String(RESET_SECONDS),
			})
		);

		expectAppError(await captureError(call(client)), {
			appCode: rateLimitedCode,
			code: "TOO_MANY_REQUESTS",
			resetAt: RESET_SECONDS * MS_PER_SECOND,
		});
	});

	it("429 没有 x-ratelimit-reset 时按 retry-after 推算 resetAt", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "Too Many Requests" }, 429, {
				"retry-after": String(RETRY_AFTER_SECONDS),
			})
		);

		expectAppError(await captureError(call(client)), {
			appCode: rateLimitedCode,
			code: "TOO_MANY_REQUESTS",
			resetAt: NOW + RETRY_AFTER_SECONDS * MS_PER_SECOND,
		});
	});

	it("429 两个响应头都没有时 resetAt 取 60 秒后", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "Too Many Requests" }, 429)
		);

		expectAppError(await captureError(call(client)), {
			appCode: rateLimitedCode,
			code: "TOO_MANY_REQUESTS",
			resetAt: NOW + DEFAULT_RETRY_MS,
		});
	});

	it.each([500, 502, 503])(
		"%i → BAD_GATEWAY / GITHUB_UNAVAILABLE",
		async (status) => {
			const { client } = setup(() =>
				jsonResponse({ message: "Server Error" }, status)
			);

			expectAppError(await captureError(call(client)), {
				appCode: "GITHUB_UNAVAILABLE",
				code: "BAD_GATEWAY",
			});
		}
	);

	it("超时（fetch 抛 TimeoutError）→ BAD_GATEWAY / GITHUB_UNAVAILABLE", async () => {
		const timeout = new DOMException("signal timed out", "TimeoutError");
		const { client } = setup(() => {
			throw timeout;
		});

		const error = await captureError(call(client));
		expectAppError(error, {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
		expect(error.cause?.cause).toBe(timeout);
	});

	it("网络错误（fetch 抛 TypeError）→ BAD_GATEWAY / GITHUB_UNAVAILABLE", async () => {
		const { client } = setup(() => {
			throw new TypeError("fetch failed");
		});

		expectAppError(await captureError(call(client)), {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
	});

	it("响应体不是 JSON → BAD_GATEWAY / GITHUB_UNAVAILABLE", async () => {
		const { client } = setup(() => new Response("<html>oops</html>"));

		expectAppError(await captureError(call(client)), {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
	});
});

describe("422", () => {
	it("搜索接口 422 → BAD_REQUEST / GITHUB_SEARCH_INVALID", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "Validation Failed" }, 422)
		);

		expectAppError(
			await captureError(client.searchUsers({ page: 1, q: "octo" })),
			{ appCode: "GITHUB_SEARCH_INVALID", code: "BAD_REQUEST" }
		);
	});

	it("资料接口 422 → BAD_GATEWAY / GITHUB_UNAVAILABLE", async () => {
		const { client } = setup(() =>
			jsonResponse({ message: "Validation Failed" }, 422)
		);

		expectAppError(await captureError(client.getUserByLogin("octocat")), {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
	});
});

describe("返回字段不符", () => {
	const { login: _omittedLogin, ...userWithoutLogin } = userBody;

	it.each([
		{ body: { items: [] }, name: "搜索缺少 total_count" },
		{
			body: { ...searchBody, total_count: "1" },
			name: "搜索 total_count 是字符串",
		},
		{
			body: { ...searchBody, items: [{ ...searchBody.items[0], id: "1" }] },
			name: "搜索 items 的 id 是字符串",
		},
	])("$name → BAD_GATEWAY / GITHUB_UNAVAILABLE", async ({ body }) => {
		const { client } = setup(() => jsonResponse(body));

		expectAppError(
			await captureError(client.searchUsers({ page: 1, q: "octo" })),
			{ appCode: "GITHUB_UNAVAILABLE", code: "BAD_GATEWAY" }
		);
	});

	it.each([
		{ body: userWithoutLogin, name: "资料缺少 login" },
		{ body: { ...userBody, followers: -1 }, name: "资料 followers 为负数" },
		{
			body: { ...userBody, created_at: "yesterday" },
			name: "资料 created_at 不是日期",
		},
		{ body: { ...userBody, name: 123 }, name: "资料 name 是数字" },
	])("$name → BAD_GATEWAY / GITHUB_UNAVAILABLE", async ({ body }) => {
		const { client } = setup(() => jsonResponse(body));

		expectAppError(await captureError(client.getUserByLogin("octocat")), {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
		expectAppError(await captureError(client.getUserById(1)), {
			appCode: "GITHUB_UNAVAILABLE",
			code: "BAD_GATEWAY",
		});
	});
});
