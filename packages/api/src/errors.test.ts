import { getTRPCErrorShape, TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTestDatabase } from "@zyk-aws-admin/db/testing";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { Context } from "./context";
import { AppCode, AppErrorCause, appError, getAppErrorData } from "./errors";
import { createGithubClient } from "./github/client";
import { publicProcedure, router, t } from "./index";

const RESET_AT = Date.UTC(2026, 10, 10, 8, 30, 0);
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_INTERNAL_SERVER_ERROR = 500;
const SECRET_CAUSE_MESSAGE = "secret-upstream-detail";
const TRPC_ENDPOINT = "/trpc";

const testRouter = router({
	appErrorWithCause: publicProcedure.query(() => {
		throw appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE, {
			cause: new Error(SECRET_CAUSE_MESSAGE),
		});
	}),
	appErrorWithMessage: publicProcedure.query(() => {
		throw appError("CONFLICT", AppCode.GITHUB_USER_ALREADY_SAVED, {
			message: "该用户已保存",
		});
	}),
	notFound: publicProcedure.query(() => {
		throw appError("NOT_FOUND", AppCode.GITHUB_USER_NOT_FOUND);
	}),
	plainError: publicProcedure.query(() => {
		throw new Error("boom");
	}),
	plainTrpcError: publicProcedure.query(() => {
		throw new TRPCError({ code: "FORBIDDEN", message: "forbidden" });
	}),
	rateLimited: publicProcedure.query(() => {
		throw appError("TOO_MANY_REQUESTS", AppCode.GITHUB_RATE_LIMITED, {
			resetAt: RESET_AT,
		});
	}),
});

type TestProcedure = keyof typeof testRouter._def.procedures;

const db = createTestDatabase();

const createContext = (): Context => ({
	db,
	// 测试 procedure 不会访问 GitHub，假的 fetch 被调用就说明用例写错了
	github: createGithubClient({
		fetch: vi.fn(() => Promise.reject(new Error("不应请求 GitHub"))),
	}),
	session: null,
});

const createCaller = t.createCallerFactory(testRouter);

afterAll(async () => {
	await db.$disconnect();
});

/** 调用测试 procedure，返回它抛出的 TRPCError */
const callAndCatch = async (path: TestProcedure): Promise<TRPCError> => {
	const caller = createCaller(createContext());
	try {
		await caller[path]();
	} catch (error) {
		if (error instanceof TRPCError) {
			return error;
		}
		throw new Error(`期望抛出 TRPCError，实际是 ${String(error)}`, {
			cause: error,
		});
	}
	throw new Error(`期望 ${path} 抛出错误，实际正常返回`);
};

/** 用 t 的配置（含 errorFormatter）格式化 procedure 抛出的错误 */
const callAndFormat = async (path: TestProcedure) => {
	const error = await callAndCatch(path);
	return getTRPCErrorShape({
		config: t._config,
		ctx: undefined,
		error,
		input: undefined,
		path,
		type: "query",
	});
};

/** 走 fetch 适配器发真实请求，返回响应 JSON 里的 error */
const requestOverHttp = async (path: TestProcedure) => {
	const response = await fetchRequestHandler({
		createContext,
		endpoint: TRPC_ENDPOINT,
		req: new Request(`http://localhost${TRPC_ENDPOINT}/${path}`),
		router: testRouter,
	});
	const body: unknown = await response.json();
	return { body, status: response.status };
};

describe("errorFormatter", () => {
	it("限流错误：data 带 appCode 和 resetAt，保留默认字段", async () => {
		const shape = await callAndFormat("rateLimited");
		expect(shape.data.appCode).toBe(AppCode.GITHUB_RATE_LIMITED);
		expect(shape.data.resetAt).toBe(RESET_AT);
		expect(shape.data.code).toBe("TOO_MANY_REQUESTS");
		expect(shape.data.httpStatus).toBe(HTTP_TOO_MANY_REQUESTS);
		expect(shape.data.path).toBe("rateLimited");
		expect(shape.message).toBe(AppCode.GITHUB_RATE_LIMITED);
	});

	it("没传 resetAt 的业务错误：appCode 正确，resetAt 为 null", async () => {
		const shape = await callAndFormat("notFound");
		expect(shape.data.appCode).toBe(AppCode.GITHUB_USER_NOT_FOUND);
		expect(shape.data.resetAt).toBeNull();
		expect(shape.data.code).toBe("NOT_FOUND");
		expect(shape.data.httpStatus).toBe(HTTP_NOT_FOUND);
	});

	it("appError 传了 message 时用它，appCode 不变", async () => {
		const shape = await callAndFormat("appErrorWithMessage");
		expect(shape.message).toBe("该用户已保存");
		expect(shape.data.appCode).toBe(AppCode.GITHUB_USER_ALREADY_SAVED);
		expect(shape.data.code).toBe("CONFLICT");
	});

	it("普通 TRPCError：appCode 和 resetAt 都为 null", async () => {
		const shape = await callAndFormat("plainTrpcError");
		expect(shape.data.appCode).toBeNull();
		expect(shape.data.resetAt).toBeNull();
		expect(shape.data.code).toBe("FORBIDDEN");
		expect(shape.message).toBe("forbidden");
	});

	it("普通 Error：转成 INTERNAL_SERVER_ERROR，appCode 为 null", async () => {
		const shape = await callAndFormat("plainError");
		expect(shape.data.appCode).toBeNull();
		expect(shape.data.resetAt).toBeNull();
		expect(shape.data.code).toBe("INTERNAL_SERVER_ERROR");
		expect(shape.data.httpStatus).toBe(HTTP_INTERNAL_SERVER_ERROR);
	});

	it("原始 cause 只留在服务端，不出现在格式化结果里", async () => {
		const error = await callAndCatch("appErrorWithCause");
		expect(error.cause).toBeInstanceOf(AppErrorCause);
		expect(error.cause?.cause).toBeInstanceOf(Error);

		const shape = await callAndFormat("appErrorWithCause");
		expect(shape.data.appCode).toBe(AppCode.GITHUB_UNAVAILABLE);
		expect(shape.data.resetAt).toBeNull();
		expect(JSON.stringify(shape)).not.toContain(SECRET_CAUSE_MESSAGE);
	});
});

describe("HTTP 响应", () => {
	it("限流错误的响应 JSON 里带 appCode 和 resetAt", async () => {
		const { body, status } = await requestOverHttp("rateLimited");
		expect(status).toBe(HTTP_TOO_MANY_REQUESTS);
		expect(body).toMatchObject({
			error: {
				data: {
					appCode: AppCode.GITHUB_RATE_LIMITED,
					code: "TOO_MANY_REQUESTS",
					resetAt: RESET_AT,
				},
			},
		});
	});

	it("普通错误的响应 JSON 里 appCode 为 null", async () => {
		const { body, status } = await requestOverHttp("plainTrpcError");
		expect(status).toBe(HTTP_FORBIDDEN);
		expect(body).toMatchObject({
			error: { data: { appCode: null, code: "FORBIDDEN", resetAt: null } },
		});
	});
});

describe("getAppErrorData", () => {
	it("cause 是 AppErrorCause 时取出 appCode 和 resetAt", () => {
		const error = appError("TOO_MANY_REQUESTS", AppCode.GITHUB_RATE_LIMITED, {
			resetAt: RESET_AT,
		});
		expect(getAppErrorData(error)).toEqual({
			appCode: AppCode.GITHUB_RATE_LIMITED,
			resetAt: RESET_AT,
		});
	});

	it("cause 是其他错误或没有 cause 时都为 null", () => {
		const withOtherCause = new TRPCError({
			cause: new Error("other"),
			code: "BAD_REQUEST",
		});
		const withoutCause = new TRPCError({ code: "BAD_REQUEST" });
		const empty = { appCode: null, resetAt: null };
		expect(getAppErrorData(withOtherCause)).toEqual(empty);
		expect(getAppErrorData(withoutCause)).toEqual(empty);
	});
});
