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
		email: "lookup-test@example.com",
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

const saveUser = (githubId: number, login: string) =>
	db.githubUser.create({
		data: {
			avatarUrl: `https://avatars.githubusercontent.com/u/${githubId}`,
			createdById: "test-user",
			githubCreatedAt: now,
			githubId,
			githubUpdatedAt: now,
			htmlUrl: `https://github.com/${login}`,
			login,
			syncedAt: now,
		},
	});

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
	getUserByLogin.mockResolvedValue(profile);
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.lookup", () => {
	it("未登录时拒绝请求，不调用 GitHub", async () => {
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(
			anonymous.lookup({ username: "torvalds" })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(getUserByLogin).not.toHaveBeenCalled();
	});

	it.each(["-abc", "abc-", "a--b", "a".repeat(40), "张三", ""])(
		"拒绝不合法用户名 %j，不调用 GitHub",
		async (username) => {
			await expect(caller.lookup({ username })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
			expect(getUserByLogin).not.toHaveBeenCalled();
		}
	);

	it("接受 39 位用户名，去掉首尾空格后查询", async () => {
		const longName = `a${"-b".repeat(19)}`;
		await caller.lookup({ username: longName });
		await caller.lookup({ username: "  torvalds  " });
		expect(getUserByLogin.mock.calls.map(([login]) => login)).toEqual([
			longName,
			"torvalds",
		]);
	});

	it("返回全部资料字段，日期为 ISO 字符串，未保存时 savedId 为 null", async () => {
		await expect(caller.lookup({ username: "torvalds" })).resolves.toEqual({
			avatarUrl: "https://avatars.githubusercontent.com/u/1024025",
			bio: "Linux 内核作者",
			blog: "https://example.com",
			company: "Linux Foundation",
			email: "torvalds@example.com",
			followers: 280_000,
			following: 0,
			githubCreatedAt: "2011-09-03T15:26:22.000Z",
			githubId: 1_024_025,
			githubUpdatedAt: "2026-10-01T00:30:00.000Z",
			htmlUrl: "https://github.com/torvalds",
			location: "Portland, OR",
			login: "torvalds",
			name: "Linus Torvalds",
			publicGists: 0,
			publicRepos: 8,
			savedId: null,
			twitterUsername: "linus",
		});
	});

	it("空字段原样返回 null", async () => {
		getUserByLogin.mockResolvedValue({
			...profile,
			bio: null,
			blog: null,
			company: null,
			email: null,
			location: null,
			name: null,
			twitter_username: null,
		});
		await expect(
			caller.lookup({ username: "torvalds" })
		).resolves.toMatchObject({
			bio: null,
			blog: null,
			company: null,
			email: null,
			location: null,
			name: null,
			twitterUsername: null,
		});
	});

	it("按 githubId 判断是否已保存，用户名改过也能识别", async () => {
		const other = await saveUser(1, "someone-else");
		const saved = await saveUser(profile.id, "old-name");
		const result = await caller.lookup({ username: "torvalds" });
		expect(result.savedId).toBe(saved.id);
		expect(result.savedId).not.toBe(other.id);
		expect(result.login).toBe("torvalds");
	});

	it("只有同用户名、不同 githubId 的记录时 savedId 为 null", async () => {
		await saveUser(1, "torvalds");
		await expect(
			caller.lookup({ username: "torvalds" })
		).resolves.toMatchObject({ savedId: null });
	});

	it("查询不写数据库：github_user 表行数和内容不变", async () => {
		const saved = await saveUser(1, "someone-else");
		await caller.lookup({ username: "torvalds" });
		getUserByLogin.mockResolvedValue({ ...profile, id: 1, login: "renamed" });
		await caller.lookup({ username: "renamed" });
		await expect(db.githubUser.count()).resolves.toBe(1);
		await expect(db.githubUser.findMany()).resolves.toEqual([saved]);
	});

	it.each([
		appError("NOT_FOUND", AppCode.GITHUB_USER_NOT_FOUND),
		appError("TOO_MANY_REQUESTS", AppCode.GITHUB_RATE_LIMITED, {
			resetAt: now.getTime(),
		}),
		appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE),
	])("原样传递客户端错误 $message", async (error) => {
		getUserByLogin.mockRejectedValue(error);
		await expect(caller.lookup({ username: "torvalds" })).rejects.toBe(error);
		await expect(db.githubUser.count()).resolves.toBe(0);
	});
});
