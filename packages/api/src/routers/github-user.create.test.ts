import { isUniqueConstraintError } from "@zyk-aws-admin/db";
import {
	createTestDatabase,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { AppCode, appError } from "../errors";
import type { GithubClient } from "../github/client";
import type { GithubProfile } from "../github/schemas";
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
		email: "create-test@example.com",
		emailVerified: false,
		id: "test-user",
		name: "测试用户",
		updatedAt: now,
	},
};

const profile: GithubProfile = {
	avatar_url: "https://avatars.githubusercontent.com/u/1024025",
	bio: "Linux 内核作者",
	blog: "https://example.com",
	company: "Linux Foundation",
	created_at: "2011-09-03T15:26:22Z",
	email: "torvalds@example.com",
	followers: 280_000,
	following: 0,
	html_url: "https://github.com/torvalds",
	id: 1_024_025,
	location: "Portland, OR",
	login: "torvalds",
	name: "Linus Torvalds",
	public_gists: 0,
	public_repos: 8,
	twitter_username: "linus",
	updated_at: "2026-10-01T08:30:00+08:00",
};

const getUserByLogin = vi.fn<GithubClient["getUserByLogin"]>();
const github: GithubClient = {
	getUserById: vi.fn<GithubClient["getUserById"]>(),
	getUserByLogin,
	searchUsers: vi.fn<GithubClient["searchUsers"]>(),
};
const caller = githubUserRouter.createCaller({ db, github, session });

const SYNCED_AT_TOLERANCE_MS = 5000;

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
	getUserByLogin.mockResolvedValue(profile);
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.create", () => {
	it("未登录时拒绝请求，不调用 GitHub", async () => {
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(
			anonymous.create({ username: "torvalds" })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(getUserByLogin).not.toHaveBeenCalled();
		await expect(db.githubUser.count()).resolves.toBe(0);
	});

	it.each(["-abc", "abc-", "a--b", "a".repeat(40), "张三", ""])(
		"拒绝不合法用户名 %j，不调用 GitHub",
		async (username) => {
			await expect(caller.create({ username })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
			expect(getUserByLogin).not.toHaveBeenCalled();
		}
	);

	it("不走缓存拉取资料，保存的字段与 GitHub 资料一致", async () => {
		const before = Date.now();
		const result = await caller.create({ username: "torvalds" });

		expect(getUserByLogin).toHaveBeenCalledTimes(1);
		expect(getUserByLogin).toHaveBeenCalledWith("torvalds", { cache: false });

		const record = await db.githubUser.findUniqueOrThrow({
			where: { githubId: profile.id },
		});
		expect(record).toMatchObject({
			avatarUrl: profile.avatar_url,
			bio: profile.bio,
			blog: profile.blog,
			company: profile.company,
			createdById: "test-user",
			email: profile.email,
			followers: profile.followers,
			following: profile.following,
			githubCreatedAt: new Date(profile.created_at),
			githubId: profile.id,
			githubUpdatedAt: new Date(profile.updated_at),
			htmlUrl: profile.html_url,
			location: profile.location,
			login: profile.login,
			name: profile.name,
			publicGists: profile.public_gists,
			publicRepos: profile.public_repos,
			remark: null,
			tags: [],
			twitterUsername: profile.twitter_username,
		});
		expect(record.syncedAt.getTime()).toBeGreaterThanOrEqual(before);
		expect(record.syncedAt.getTime() - before).toBeLessThan(
			SYNCED_AT_TOLERANCE_MS
		);

		expect(result).toEqual({
			avatarUrl: profile.avatar_url,
			bio: profile.bio,
			blog: profile.blog,
			company: profile.company,
			createdAt: record.createdAt.toISOString(),
			createdById: "test-user",
			email: profile.email,
			followers: profile.followers,
			following: profile.following,
			githubCreatedAt: "2011-09-03T15:26:22.000Z",
			githubId: profile.id,
			githubUpdatedAt: "2026-10-01T00:30:00.000Z",
			htmlUrl: profile.html_url,
			id: record.id,
			location: profile.location,
			login: profile.login,
			name: profile.name,
			publicGists: profile.public_gists,
			publicRepos: profile.public_repos,
			remark: null,
			syncedAt: record.syncedAt.toISOString(),
			tags: [],
			twitterUsername: profile.twitter_username,
			updatedAt: record.updatedAt.toISOString(),
		});
	});

	it("用户名大小写不同视为同一个人，第二次返回 CONFLICT", async () => {
		await caller.create({ username: "torvalds" });
		await expect(caller.create({ username: "Torvalds" })).rejects.toMatchObject(
			{
				cause: { appCode: AppCode.GITHUB_USER_ALREADY_SAVED },
				code: "CONFLICT",
			}
		);
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it("并发添加同一个人时只有一条成功，另一条返回 CONFLICT", async () => {
		const results = await Promise.allSettled([
			caller.create({ username: "torvalds" }),
			caller.create({ username: "Torvalds" }),
		]);
		const fulfilled = results.filter((item) => item.status === "fulfilled");
		const rejected = results.filter((item) => item.status === "rejected");
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.reason).toMatchObject({
			cause: { appCode: AppCode.GITHUB_USER_ALREADY_SAVED },
			code: "CONFLICT",
		});
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it("findUnique 之后才写入的并发记录，由唯一约束兜底转为 CONFLICT", async () => {
		const findUnique = vi
			.spyOn(db.githubUser, "findUnique")
			.mockResolvedValueOnce(null);
		try {
			await db.githubUser.create({
				data: {
					avatarUrl: profile.avatar_url,
					createdById: "other-user",
					githubCreatedAt: now,
					githubId: profile.id,
					githubUpdatedAt: now,
					htmlUrl: profile.html_url,
					login: profile.login,
					syncedAt: now,
				},
			});
			await expect(
				caller.create({ username: "torvalds" })
			).rejects.toMatchObject({
				cause: { appCode: AppCode.GITHUB_USER_ALREADY_SAVED },
				code: "CONFLICT",
			});
		} finally {
			findUnique.mockRestore();
		}
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it("isUniqueConstraintError 能从 pg 适配器的 P2002 中识别冲突字段", async () => {
		await caller.create({ username: "torvalds" });
		const error: unknown = await db.githubUser
			.create({
				data: {
					avatarUrl: profile.avatar_url,
					createdById: "other-user",
					githubCreatedAt: now,
					githubId: profile.id,
					githubUpdatedAt: now,
					htmlUrl: profile.html_url,
					login: profile.login,
					syncedAt: now,
				},
			})
			.catch((caught: unknown) => caught);
		expect(isUniqueConstraintError(error)).toBe(true);
		expect(isUniqueConstraintError(error, "githubId")).toBe(true);
		expect(isUniqueConstraintError(error, "login")).toBe(false);
		expect(isUniqueConstraintError(new Error("P2002"), "githubId")).toBe(false);
	});

	it.each([
		appError("NOT_FOUND", AppCode.GITHUB_USER_NOT_FOUND),
		appError("TOO_MANY_REQUESTS", AppCode.GITHUB_RATE_LIMITED, {
			resetAt: now.getTime(),
		}),
		appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE),
	])("原样传递客户端错误 $message，不写数据库", async (error) => {
		getUserByLogin.mockRejectedValue(error);
		await expect(caller.create({ username: "torvalds" })).rejects.toBe(error);
		await expect(db.githubUser.count()).resolves.toBe(0);
	});
});
