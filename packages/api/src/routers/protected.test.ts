import {
	type AnyTRPCProcedure,
	type AnyTRPCRouter,
	callTRPCProcedure,
	TRPCError,
	type TRPCRouterRecord,
} from "@trpc/server";
import { createTestDatabase } from "@zyk-aws-admin/db/testing";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { createGithubClient } from "../github/client";
import { githubUserRouter } from "./github-user";
import { appRouter } from "./index";

const GITHUB_USER_PREFIX = "githubUser.";

/**
 * 需要登录的接口路径：githubUserRouter 的全部 procedure（遍历 _def.procedures，
 * 后续需求新增的接口自动纳入）+ 现有的 privateData
 */
const protectedPaths = [
	...Object.keys(githubUserRouter._def.procedures).map(
		(path) => `${GITHUB_USER_PREFIX}${path}`
	),
	"privateData",
];

/**
 * 运行时 _def.procedures 是按 "a.b" 拍平的路径表（类型上写成嵌套的 RouterRecord），
 * 这里放宽成 AnyTRPCRouter 以便按字符串路径查找
 */
const rootRouter: AnyTRPCRouter = appRouter;

const isProcedure = (
	value: AnyTRPCProcedure | TRPCRouterRecord | undefined
): value is AnyTRPCProcedure => typeof value === "function";

const db = createTestDatabase();

const createAnonymousContext = (): Context => ({
	db,
	// 未登录时应在鉴权中间件就被拦下，假的 fetch 被调用就说明鉴权没生效
	github: createGithubClient({
		fetch: vi.fn(() => Promise.reject(new Error("不应请求 GitHub"))),
	}),
	session: null,
});

afterAll(async () => {
	await db.$disconnect();
});

/** 以未登录身份调用 appRouter 上的 procedure，返回它抛出的 TRPCError */
const callAnonymously = async (path: string): Promise<TRPCError> => {
	const procedure = rootRouter._def.procedures[path];
	if (!isProcedure(procedure)) {
		throw new Error(`appRouter 上没有 ${path}`);
	}
	try {
		await callTRPCProcedure({
			batchIndex: 0,
			ctx: createAnonymousContext(),
			getRawInput: () => Promise.resolve(undefined),
			path,
			router: rootRouter,
			signal: undefined,
			type: procedure._def.type,
		});
	} catch (error) {
		if (error instanceof TRPCError) {
			return error;
		}
		throw new Error(`期望抛出 TRPCError，实际是 ${String(error)}`, {
			cause: error,
		});
	}
	throw new Error(`期望 ${path} 抛出 UNAUTHORIZED，实际正常返回`);
};

describe("未登录调用需要登录的接口", () => {
	it("githubUser 的 procedure 和 privateData 都挂在 appRouter 上", () => {
		for (const path of protectedPaths) {
			expect(isProcedure(rootRouter._def.procedures[path])).toBe(true);
		}
	});

	it.each(protectedPaths)("%s 抛 UNAUTHORIZED", async (path) => {
		const error = await callAnonymously(path);
		expect(error.code).toBe("UNAUTHORIZED");
	});
});
