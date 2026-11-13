import { isRecordNotFoundError } from "@zyk-aws-admin/db";
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
		userId: "sync-user",
	},
	user: {
		createdAt: now,
		email: "sync-test@example.com",
		emailVerified: false,
		id: "sync-user",
		name: "同步人",
		updatedAt: now,
	},
};

const GITHUB_ID = 583_231;
const MISSING_RECORD_ID = 999_999;

/** 本地保存的旧资料：GitHub 字段都和 profile 不同，备注、标签、添加人有值 */
const staleRecord = {
	avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=1",
	bio: "旧简介",
	blog: null,
	company: "旧公司",
	createdById: "adder-user",
	email: null,
	followers: 1,
	following: 2,
	githubCreatedAt: new Date("2011-01-25T18:44:36Z"),
	githubId: GITHUB_ID,
	githubUpdatedAt: new Date("2020-01-01T00:00:00Z"),
	htmlUrl: "https://github.com/octocat",
	location: null,
	login: "octocat",
	name: "Old Name",
	publicGists: 0,
	publicRepos: 3,
	remark: "重要用户\n第二行",
	syncedAt: new Date("2026-10-01T00:00:00Z"),
	tags: ["vip", "mascot"],
	twitterUsername: null,
};

/** GitHub 上的最新资料：对方已改名为 octocat-renamed */
const profile: GithubProfile = {
	avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4",
	bio: "新简介",
	blog: "https://github.blog",
	company: "@github",
	created_at: "2011-01-25T18:44:36Z",
	email: "octocat@example.com",
	followers: 20_000,
	following: 9,
	html_url: "https://github.com/octocat-renamed",
	id: GITHUB_ID,
	location: "San Francisco",
	login: "octocat-renamed",
	name: "The Octocat",
	public_gists: 8,
	public_repos: 42,
	twitter_username: "octocat",
	updated_at: "2026-11-10T08:00:00+08:00",
};

const getUserById = vi.fn<GithubClient["getUserById"]>();
const getUserByLogin = vi.fn<GithubClient["getUserByLogin"]>();
const github: GithubClient = {
	getUserById,
	getUserByLogin,
	searchUsers: vi.fn<GithubClient["searchUsers"]>(),
};
const caller = githubUserRouter.createCaller({ db, github, session });

const SYNCED_AT_TOLERANCE_MS = 5000;

const createStaleRecord = () => db.githubUser.create({ data: staleRecord });

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
	getUserById.mockResolvedValue(profile);
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.sync", () => {
	it("未登录时拒绝请求，不调用 GitHub", async () => {
		const { id } = await createStaleRecord();
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(anonymous.sync({ id })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		expect(getUserById).not.toHaveBeenCalled();
	});

	it.each([0, -1, 1.5])("拒绝不合法的 id %j，不调用 GitHub", async (id) => {
		await expect(caller.sync({ id })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		expect(getUserById).not.toHaveBeenCalled();
	});

	it("按 githubId 拉取，只覆盖 GitHub 字段和 syncedAt，备注、标签、添加人不变", async () => {
		const before = await createStaleRecord();
		const startedAt = Date.now();

		const result = await caller.sync({ id: before.id });

		expect(getUserById).toHaveBeenCalledTimes(1);
		expect(getUserById).toHaveBeenCalledWith(GITHUB_ID);
		expect(getUserByLogin).not.toHaveBeenCalled();

		const after = await db.githubUser.findUniqueOrThrow({
			where: { id: before.id },
		});
		expect(after).toMatchObject({
			avatarUrl: profile.avatar_url,
			bio: profile.bio,
			blog: profile.blog,
			company: profile.company,
			createdAt: before.createdAt,
			createdById: before.createdById,
			email: profile.email,
			followers: profile.followers,
			following: profile.following,
			githubCreatedAt: new Date(profile.created_at),
			githubId: GITHUB_ID,
			githubUpdatedAt: new Date(profile.updated_at),
			htmlUrl: profile.html_url,
			id: before.id,
			location: profile.location,
			login: "octocat-renamed",
			name: profile.name,
			publicGists: profile.public_gists,
			publicRepos: profile.public_repos,
			remark: before.remark,
			tags: before.tags,
			twitterUsername: profile.twitter_username,
		});
		expect(after.syncedAt.getTime()).toBeGreaterThan(before.syncedAt.getTime());
		expect(after.syncedAt.getTime()).toBeGreaterThanOrEqual(startedAt);
		expect(after.syncedAt.getTime() - startedAt).toBeLessThan(
			SYNCED_AT_TOLERANCE_MS
		);
		expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(
			before.updatedAt.getTime()
		);

		expect(result).toMatchObject({
			githubUpdatedAt: "2026-11-10T00:00:00.000Z",
			id: before.id,
			login: "octocat-renamed",
			remark: before.remark,
			syncedAt: after.syncedAt.toISOString(),
			tags: before.tags,
			updatedAt: after.updatedAt.toISOString(),
		});
	});

	it("不存在的记录返回 RECORD_NOT_FOUND，不调用 GitHub", async () => {
		await expect(caller.sync({ id: MISSING_RECORD_ID })).rejects.toMatchObject({
			cause: { appCode: AppCode.RECORD_NOT_FOUND },
			code: "NOT_FOUND",
		});
		expect(getUserById).not.toHaveBeenCalled();
	});

	it.each([
		appError("NOT_FOUND", AppCode.GITHUB_USER_NOT_FOUND),
		appError("TOO_MANY_REQUESTS", AppCode.GITHUB_RATE_LIMITED, {
			resetAt: now.getTime(),
		}),
		appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE),
	])("原样传递客户端错误 $message，本地记录逐字段不变", async (error) => {
		const before = await createStaleRecord();
		getUserById.mockRejectedValue(error);

		await expect(caller.sync({ id: before.id })).rejects.toBe(error);

		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: before.id } })
		).resolves.toEqual(before);
	});

	it("GitHub 返回的 id 与 githubId 不一致时返回 GITHUB_UNAVAILABLE，不写库", async () => {
		const before = await createStaleRecord();
		getUserById.mockResolvedValue({ ...profile, id: GITHUB_ID + 1 });

		await expect(caller.sync({ id: before.id })).rejects.toMatchObject({
			cause: { appCode: AppCode.GITHUB_UNAVAILABLE },
			code: "BAD_GATEWAY",
		});
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: before.id } })
		).resolves.toEqual(before);
	});

	it("同步过程中记录被删除（P2025）时返回 RECORD_NOT_FOUND", async () => {
		const { id } = await createStaleRecord();
		getUserById.mockImplementation(async () => {
			await db.githubUser.delete({ where: { id } });
			return profile;
		});

		await expect(caller.sync({ id })).rejects.toMatchObject({
			cause: { appCode: AppCode.RECORD_NOT_FOUND },
			code: "NOT_FOUND",
		});
		await expect(db.githubUser.count()).resolves.toBe(0);
	});

	it("isRecordNotFoundError 能识别 pg 适配器的 P2025", async () => {
		const error: unknown = await db.githubUser
			.update({ data: { remark: "x" }, where: { id: MISSING_RECORD_ID } })
			.catch((caught: unknown) => caught);
		expect(isRecordNotFoundError(error)).toBe(true);
		expect(isRecordNotFoundError(new Error("P2025"))).toBe(false);
	});
});
