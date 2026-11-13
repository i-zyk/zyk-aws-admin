import {
	createTestDatabase,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import { AppCode } from "../errors";
import type { GithubClient } from "../github/client";
import { GITHUB_USER_ID_MAX, type GithubProfile } from "../github/schemas";
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
		email: "delete-test@example.com",
		emailVerified: false,
		id: "test-user",
		name: "测试用户",
		updatedAt: now,
	},
};

const profile: GithubProfile = {
	avatar_url: "https://avatars.githubusercontent.com/u/583231",
	bio: null,
	blog: null,
	company: "@github",
	created_at: "2011-01-25T18:44:36Z",
	email: null,
	followers: 12_345,
	following: 9,
	html_url: "https://github.com/octocat",
	id: 583_231,
	location: "San Francisco",
	login: "octocat",
	name: "The Octocat",
	public_gists: 8,
	public_repos: 42,
	twitter_username: null,
	updated_at: "2026-09-30T12:00:00Z",
};

const getUserByLogin = vi.fn<GithubClient["getUserByLogin"]>();
const github: GithubClient = {
	getUserById: vi.fn<GithubClient["getUserById"]>(),
	getUserByLogin,
	searchUsers: vi.fn<GithubClient["searchUsers"]>(),
};
const caller = githubUserRouter.createCaller({ db, github, session });

/** 一条带备注和标签的记录，用来确认删除时它们一起被删掉 */
const createRecord = () =>
	db.githubUser.create({
		data: {
			avatarUrl: profile.avatar_url,
			createdById: session.user.id,
			githubCreatedAt: new Date(profile.created_at),
			githubId: profile.id,
			githubUpdatedAt: new Date(profile.updated_at),
			htmlUrl: profile.html_url,
			login: profile.login,
			remark: "重点关注",
			syncedAt: now,
			tags: ["mascot", "github"],
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

describe("githubUser.delete", () => {
	it("未登录时拒绝请求，记录不受影响", async () => {
		const record = await createRecord();
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(anonymous.delete({ id: record.id })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		await expect(
			db.githubUser.findUnique({ where: { id: record.id } })
		).resolves.not.toBeNull();
	});

	it("物理删除记录并返回 { id }，不请求 GitHub", async () => {
		const record = await createRecord();
		const other = await db.githubUser.create({
			data: {
				avatarUrl: "https://avatars.githubusercontent.com/u/1",
				createdById: session.user.id,
				githubCreatedAt: now,
				githubId: 1,
				githubUpdatedAt: now,
				htmlUrl: "https://github.com/other",
				login: "other",
				syncedAt: now,
			},
		});

		await expect(caller.delete({ id: record.id })).resolves.toEqual({
			id: record.id,
		});
		await expect(
			db.githubUser.findUnique({ where: { id: record.id } })
		).resolves.toBeNull();
		// 只删目标记录
		await expect(
			db.githubUser.findUnique({ where: { id: other.id } })
		).resolves.not.toBeNull();
		expect(getUserByLogin).not.toHaveBeenCalled();
		expect(github.getUserById).not.toHaveBeenCalled();
		expect(github.searchUsers).not.toHaveBeenCalled();
	});

	it("再删一次返回 NOT_FOUND / RECORD_NOT_FOUND", async () => {
		const record = await createRecord();
		await caller.delete({ id: record.id });
		await expect(caller.delete({ id: record.id })).rejects.toMatchObject({
			cause: { appCode: AppCode.RECORD_NOT_FOUND },
			code: "NOT_FOUND",
		});
	});

	it.each([999_999, GITHUB_USER_ID_MAX])(
		"不存在的 ID %i 返回 NOT_FOUND / RECORD_NOT_FOUND",
		async (id) => {
			await expect(caller.delete({ id })).rejects.toMatchObject({
				cause: { appCode: AppCode.RECORD_NOT_FOUND },
				code: "NOT_FOUND",
			});
		}
	);

	it("并发删除同一条时只有一个成功，另一个返回 RECORD_NOT_FOUND", async () => {
		const record = await createRecord();
		const results = await Promise.allSettled([
			caller.delete({ id: record.id }),
			caller.delete({ id: record.id }),
		]);
		const fulfilled = results.filter((result) => result.status === "fulfilled");
		const rejected = results.filter((result) => result.status === "rejected");
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.reason).toMatchObject({
			cause: { appCode: AppCode.RECORD_NOT_FOUND },
			code: "NOT_FOUND",
		});
	});

	it("删除后可以重新添加同一个 GitHub 用户，新记录 id 不同、备注和标签为空", async () => {
		const record = await createRecord();
		await caller.delete({ id: record.id });

		const recreated = await caller.create({ username: profile.login });
		expect(recreated.id).not.toBe(record.id);
		expect(recreated).toMatchObject({
			githubId: profile.id,
			login: profile.login,
			remark: null,
			tags: [],
		});
		await expect(
			db.githubUser.count({ where: { githubId: profile.id } })
		).resolves.toBe(1);
	});

	it.each([0, -1, 1.5, GITHUB_USER_ID_MAX + 1, Number.NaN])(
		"ID %d 返回 BAD_REQUEST，不删除任何记录",
		async (id) => {
			await createRecord();
			await expect(caller.delete({ id })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
			await expect(db.githubUser.count()).resolves.toBe(1);
		}
	);

	it("ID 不是数字时返回 BAD_REQUEST", async () => {
		await expect(
			caller.delete({ id: "1" as unknown as number })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
