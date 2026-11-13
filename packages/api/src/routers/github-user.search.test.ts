import {
	createTestDatabase,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { AppCode, appError } from "../errors";
import type { GithubClient } from "../github/client";
import { githubUserRouter } from "./github-user";

const db = createTestDatabase();
const now = new Date("2026-11-11T00:00:00Z");
const session: NonNullable<Context["session"]> = {
	session: {
		createdAt: now,
		expiresAt: new Date("2026-11-12T00:00:00Z"),
		id: "test-session",
		token: "test-token",
		updatedAt: now,
		userId: "test-user",
	},
	user: {
		createdAt: now,
		email: "search-test@example.com",
		emailVerified: false,
		id: "test-user",
		name: "测试用户",
		updatedAt: now,
	},
};

const item = (id: number, login: string) => ({
	avatar_url: `https://avatars.githubusercontent.com/u/${id}`,
	html_url: `https://github.com/${login}`,
	id,
	login,
});

const searchUsers = vi.fn<GithubClient["searchUsers"]>();
const github: GithubClient = {
	getUserById: vi.fn<GithubClient["getUserById"]>(),
	getUserByLogin: vi.fn<GithubClient["getUserByLogin"]>(),
	searchUsers,
};
const caller = githubUserRouter.createCaller({ db, github, session });

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
	searchUsers.mockResolvedValue({ items: [], total: 0 });
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.search", () => {
	it("未登录时拒绝请求，不调用 GitHub", async () => {
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(anonymous.search({ q: "linus" })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(searchUsers).not.toHaveBeenCalled();
	});

	it.each([
		{ q: " " },
		{ q: "a".repeat(101) },
		{ page: 0, q: "linus" },
		{ page: 101, q: "linus" },
		{ page: 1.5, q: "linus" },
	])("拒绝不合法输入 %j，不调用 GitHub", async (input) => {
		await expect(caller.search(input)).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(searchUsers).not.toHaveBeenCalled();
	});

	it("去掉关键字首尾空格，默认第一页，空结果没有下一页", async () => {
		await expect(caller.search({ q: " linus " })).resolves.toEqual({
			hasMore: false,
			items: [],
			page: 1,
			total: 0,
		});
		expect(searchUsers).toHaveBeenCalledExactlyOnceWith({
			page: 1,
			q: "linus",
		});
	});

	it("精确匹配不区分大小写且置顶，其余顺序不变，不修改客户端结果", async () => {
		const items = [item(1, "first"), item(2, "Torvalds"), item(3, "last")];
		searchUsers.mockResolvedValue({ items, total: 3 });
		const result = await caller.search({ q: "torvalds" });
		expect(result.items.map((user) => user.login)).toEqual([
			"Torvalds",
			"first",
			"last",
		]);
		expect(result.items.map((user) => user.exactMatch)).toEqual([
			true,
			false,
			false,
		]);
		expect(items.map((user) => user.login)).toEqual([
			"first",
			"Torvalds",
			"last",
		]);
	});

	it("每次按 GitHub ID 计算保存状态；搜索不写数据库", async () => {
		searchUsers.mockResolvedValue({
			items: [item(1, "renamed"), item(2, "other")],
			total: 2,
		});
		const saved = await db.githubUser.create({
			data: {
				avatarUrl: "https://avatars.githubusercontent.com/u/1",
				createdById: "test-user",
				githubCreatedAt: now,
				githubId: 1,
				githubUpdatedAt: now,
				htmlUrl: "https://github.com/old-name",
				login: "old-name",
				syncedAt: now,
			},
		});
		const result = await caller.search({ q: "name" });
		expect(result.items.map((user) => user.savedId)).toEqual([saved.id, null]);
		expect(result.items[0]).toMatchObject({
			avatarUrl: "https://avatars.githubusercontent.com/u/1",
			githubId: 1,
			htmlUrl: "https://github.com/renamed",
			login: "renamed",
		});
		await expect(db.githubUser.findMany()).resolves.toEqual([saved]);
		await db.githubUser.delete({ where: { id: saved.id } });
		const afterDeletion = await caller.search({ q: "name" });
		expect(afterDeletion.items.map((user) => user.savedId)).toEqual([
			null,
			null,
		]);
		await expect(db.githubUser.count()).resolves.toBe(0);
	});

	it.each([
		{ hasMore: true, page: 2, total: 25 },
		{ hasMore: false, page: 3, total: 25 },
		{ hasMore: false, page: 100, total: 5000 },
	])(
		"total=$total/page=$page 的下一页标记为 $hasMore",
		async ({ hasMore, page, total }) => {
			searchUsers.mockResolvedValue({ items: [], total });
			await expect(caller.search({ page, q: "linus" })).resolves.toMatchObject({
				hasMore,
				page,
				total,
			});
		}
	);

	it.each([
		appError("TOO_MANY_REQUESTS", AppCode.GITHUB_SEARCH_RATE_LIMITED, {
			resetAt: now.getTime(),
		}),
		appError("BAD_REQUEST", AppCode.GITHUB_SEARCH_INVALID),
		appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE),
	])("原样传递客户端错误 $message", async (error) => {
		searchUsers.mockRejectedValue(error);
		await expect(caller.search({ q: "linus" })).rejects.toBe(error);
	});
});
