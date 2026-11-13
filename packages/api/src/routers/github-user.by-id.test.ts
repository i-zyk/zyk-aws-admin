import {
	createTestDatabase,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import type { Context } from "../context";
import { AppCode } from "../errors";
import type { GithubClient } from "../github/client";
import { GITHUB_USER_ID_MAX } from "../github/schemas";
import { githubUserRouter } from "./github-user";

const db = createTestDatabase();
const now = new Date("2026-11-11T00:00:00Z");
const ADDER_ID = "adder-user";
const ADDER_NAME = "添加人小王";
const session: NonNullable<Context["session"]> = {
	session: {
		createdAt: now,
		expiresAt: new Date("2026-11-12T00:00:00Z"),
		id: "test-session",
		token: "test-token",
		updatedAt: now,
		userId: "viewer-user",
	},
	user: {
		createdAt: now,
		email: "by-id-test@example.com",
		emailVerified: false,
		id: "viewer-user",
		name: "查看人",
		updatedAt: now,
	},
};

const github: GithubClient = {
	getUserById: vi.fn<GithubClient["getUserById"]>(),
	getUserByLogin: vi.fn<GithubClient["getUserByLogin"]>(),
	searchUsers: vi.fn<GithubClient["searchUsers"]>(),
};
const caller = githubUserRouter.createCaller({ db, github, session });

/** 一条字段全部有值的记录，日期互不相同，能区分每个日期字段 */
const fullRecord = {
	avatarUrl: "https://avatars.githubusercontent.com/u/583231",
	bio: "GitHub 吉祥物",
	blog: "https://github.blog",
	company: "@github",
	createdAt: new Date("2026-10-01T08:00:00Z"),
	createdById: ADDER_ID,
	email: "octocat@example.com",
	followers: 12_345,
	following: 9,
	githubCreatedAt: new Date("2011-01-25T18:44:36Z"),
	githubId: 583_231,
	githubUpdatedAt: new Date("2026-09-30T12:00:00Z"),
	htmlUrl: "https://github.com/octocat",
	location: "San Francisco",
	login: "octocat",
	name: "The Octocat",
	publicGists: 8,
	publicRepos: 42,
	remark: "第一行备注\n第二行备注",
	syncedAt: new Date("2026-10-15T09:30:00Z"),
	tags: ["mascot", "github"],
	twitterUsername: "octocat",
};

const createAdder = async (): Promise<void> => {
	await db.user.create({
		data: {
			email: "adder@example.com",
			id: ADDER_ID,
			name: ADDER_NAME,
		},
	});
};

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
});

afterEach(() => {
	// 详情只读本地数据库，GitHub 不可用也不影响，任何用例都不应请求 GitHub
	expect(github.getUserById).not.toHaveBeenCalled();
	expect(github.getUserByLogin).not.toHaveBeenCalled();
	expect(github.searchUsers).not.toHaveBeenCalled();
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.byId", () => {
	it("未登录时拒绝请求", async () => {
		await createAdder();
		const record = await db.githubUser.create({ data: fullRecord });
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(anonymous.byId({ id: record.id })).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("返回记录的全部字段（日期为 ISO 字符串）和添加人名字", async () => {
		await createAdder();
		const record = await db.githubUser.create({ data: fullRecord });

		await expect(caller.byId({ id: record.id })).resolves.toEqual({
			avatarUrl: fullRecord.avatarUrl,
			bio: fullRecord.bio,
			blog: fullRecord.blog,
			company: fullRecord.company,
			createdAt: fullRecord.createdAt.toISOString(),
			createdBy: { id: ADDER_ID, name: ADDER_NAME },
			createdById: ADDER_ID,
			email: fullRecord.email,
			followers: fullRecord.followers,
			following: fullRecord.following,
			githubCreatedAt: fullRecord.githubCreatedAt.toISOString(),
			githubId: fullRecord.githubId,
			githubUpdatedAt: fullRecord.githubUpdatedAt.toISOString(),
			htmlUrl: fullRecord.htmlUrl,
			id: record.id,
			location: fullRecord.location,
			login: fullRecord.login,
			name: fullRecord.name,
			publicGists: fullRecord.publicGists,
			publicRepos: fullRecord.publicRepos,
			remark: fullRecord.remark,
			syncedAt: fullRecord.syncedAt.toISOString(),
			tags: fullRecord.tags,
			twitterUsername: fullRecord.twitterUsername,
			updatedAt: record.updatedAt.toISOString(),
		});
	});

	it("可选字段为空、无标签时原样返回 null 和空数组", async () => {
		await createAdder();
		const record = await db.githubUser.create({
			data: {
				avatarUrl: "https://avatars.githubusercontent.com/u/1",
				createdById: ADDER_ID,
				githubCreatedAt: now,
				githubId: 1,
				githubUpdatedAt: now,
				htmlUrl: "https://github.com/empty",
				login: "empty",
				syncedAt: now,
			},
		});
		await expect(caller.byId({ id: record.id })).resolves.toMatchObject({
			bio: null,
			blog: null,
			company: null,
			email: null,
			location: null,
			name: null,
			remark: null,
			tags: [],
			twitterUsername: null,
		});
	});

	it("添加人账号已不存在时 createdBy 为 null，其余字段照常返回", async () => {
		const record = await db.githubUser.create({
			data: { ...fullRecord, createdById: "deleted-user" },
		});
		await expect(caller.byId({ id: record.id })).resolves.toMatchObject({
			createdBy: null,
			createdById: "deleted-user",
			id: record.id,
			login: fullRecord.login,
		});
	});

	it("添加人账号被删除后再查询，createdBy 变为 null", async () => {
		await createAdder();
		const record = await db.githubUser.create({ data: fullRecord });
		await expect(caller.byId({ id: record.id })).resolves.toMatchObject({
			createdBy: { id: ADDER_ID, name: ADDER_NAME },
		});

		await db.user.delete({ where: { id: ADDER_ID } });
		await expect(caller.byId({ id: record.id })).resolves.toMatchObject({
			createdBy: null,
		});
	});

	it.each([999_999, GITHUB_USER_ID_MAX])(
		"不存在的 ID %i 返回 NOT_FOUND / RECORD_NOT_FOUND",
		async (id) => {
			await expect(caller.byId({ id })).rejects.toMatchObject({
				cause: { appCode: AppCode.RECORD_NOT_FOUND },
				code: "NOT_FOUND",
			});
		}
	);

	it("记录被删除后再查询返回 NOT_FOUND", async () => {
		await createAdder();
		const record = await db.githubUser.create({ data: fullRecord });
		await db.githubUser.delete({ where: { id: record.id } });
		await expect(caller.byId({ id: record.id })).rejects.toMatchObject({
			cause: { appCode: AppCode.RECORD_NOT_FOUND },
			code: "NOT_FOUND",
		});
	});

	it.each([0, -1, 1.5, GITHUB_USER_ID_MAX + 1, Number.NaN])(
		"ID %d 返回 BAD_REQUEST",
		async (id) => {
			await expect(caller.byId({ id })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		}
	);

	it("ID 不是数字时返回 BAD_REQUEST", async () => {
		await expect(
			caller.byId({ id: "1" as unknown as number })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
