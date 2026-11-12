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
import {
	GITHUB_USER_ID_MAX,
	REMARK_MAX_LENGTH,
	TAG_MAX_LENGTH,
	TAGS_MAX_COUNT,
} from "../github/schemas";
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
		userId: "editor-user",
	},
	user: {
		createdAt: now,
		email: "update-test@example.com",
		emailVerified: false,
		id: "editor-user",
		name: "编辑人",
		updatedAt: now,
	},
};

const github: GithubClient = {
	getUserById: vi.fn<GithubClient["getUserById"]>(),
	getUserByLogin: vi.fn<GithubClient["getUserByLogin"]>(),
	searchUsers: vi.fn<GithubClient["searchUsers"]>(),
};
const caller = githubUserRouter.createCaller({ db, github, session });
type UpdateInput = Parameters<typeof caller.update>[0];

/** GitHub 来源的字段：修改接口不得改动其中任何一个 */
const githubFields = {
	avatarUrl: "https://avatars.githubusercontent.com/u/583231",
	bio: "GitHub 吉祥物",
	blog: "https://github.blog",
	company: "@github",
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
	twitterUsername: "octocat",
};

const createRecord = () =>
	db.githubUser.create({
		data: {
			...githubFields,
			createdAt: new Date("2026-10-01T08:00:00Z"),
			createdById: "adder-user",
			remark: "原备注",
			syncedAt: new Date("2026-10-15T09:30:00Z"),
			tags: ["原标签"],
		},
	});

/** 除 remark、tags、updatedAt 外的所有列，用来确认它们在修改前后完全一致 */
const findUntouchedColumns = async (id: number) => {
	const record = await db.githubUser.findUniqueOrThrow({ where: { id } });
	const {
		remark: _remark,
		tags: _tags,
		updatedAt: _updatedAt,
		...rest
	} = record;
	return rest;
};

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
});

afterEach(() => {
	// 修改只写本地数据库，任何用例都不应请求 GitHub
	expect(github.getUserById).not.toHaveBeenCalled();
	expect(github.getUserByLogin).not.toHaveBeenCalled();
	expect(github.searchUsers).not.toHaveBeenCalled();
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.update", () => {
	it("未登录时返回 UNAUTHORIZED，数据库无变化", async () => {
		const record = await createRecord();
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(
			anonymous.update({ id: record.id, remark: "新备注" })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toEqual(record);
	});

	it("修改备注和标签后返回更新后的记录，再查数据仍在", async () => {
		const record = await createRecord();
		const result = await caller.update({
			id: record.id,
			remark: "新备注\n第二行",
			tags: ["前端", "开源"],
		});
		expect(result).toMatchObject({
			id: record.id,
			login: githubFields.login,
			remark: "新备注\n第二行",
			tags: ["前端", "开源"],
		});
		expect(typeof result.updatedAt).toBe("string");

		await expect(caller.byId({ id: record.id })).resolves.toMatchObject({
			remark: "新备注\n第二行",
			tags: ["前端", "开源"],
		});
	});

	it("只传 tags 时 remark 不变", async () => {
		const record = await createRecord();
		await caller.update({ id: record.id, tags: ["新标签"] });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toMatchObject({ remark: "原备注", tags: ["新标签"] });
	});

	it("只传 remark 时 tags 不变", async () => {
		const record = await createRecord();
		await caller.update({ id: record.id, remark: "只改备注" });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toMatchObject({ remark: "只改备注", tags: ["原标签"] });
	});

	it.each([
		["null", null],
		["空字符串", ""],
		["只有空白", "  \n "],
	])("remark 为 %s 时清空为 null", async (_label, remark) => {
		const record = await createRecord();
		await expect(
			caller.update({ id: record.id, remark })
		).resolves.toMatchObject({ remark: null });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toMatchObject({ remark: null });
	});

	it("tags 为空数组时清空标签", async () => {
		const record = await createRecord();
		await expect(
			caller.update({ id: record.id, tags: [] })
		).resolves.toMatchObject({ tags: [] });
	});

	it("保存前规范化：备注去首尾空格，标签去空格、去空、去重", async () => {
		const record = await createRecord();
		await caller.update({
			id: record.id,
			remark: "  备注  ",
			tags: [" a ", "", "a", "  ", "B", "b"],
		});
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toMatchObject({ remark: "备注", tags: ["a", "B", "b"] });
	});

	it("备注 500 字、10 个 20 字标签可以保存", async () => {
		const record = await createRecord();
		const remark = "备".repeat(REMARK_MAX_LENGTH);
		const tags = Array.from({ length: TAGS_MAX_COUNT }, (_, index) =>
			`${index}`.padEnd(TAG_MAX_LENGTH, "标")
		);
		await caller.update({ id: record.id, remark, tags });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toMatchObject({ remark, tags });
	});

	it("GitHub 字段、添加人、添加时间、同步时间在修改前后完全一致", async () => {
		const record = await createRecord();
		const before = await findUntouchedColumns(record.id);
		await caller.update({ id: record.id, remark: "新备注", tags: ["x"] });
		await expect(findUntouchedColumns(record.id)).resolves.toEqual(before);
	});

	it.each([
		["name", { name: "改名" }],
		["followers", { followers: 0 }],
		["login", { login: "hacker" }],
		["githubId", { githubId: 1 }],
		["avatarUrl", { avatarUrl: "https://example.com/a.png" }],
		["createdById", { createdById: "someone-else" }],
		["syncedAt", { syncedAt: "2030-01-01T00:00:00Z" }],
	])("带 %s 字段返回 BAD_REQUEST，数据库无变化", async (_label, extra) => {
		const record = await createRecord();
		await expect(
			caller.update({
				id: record.id,
				remark: "新备注",
				tags: ["新标签"],
				...extra,
			} as UpdateInput)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toEqual(record);
	});

	it.each([
		["备注 501 字", { remark: "a".repeat(REMARK_MAX_LENGTH + 1) }],
		[
			"11 个标签",
			{
				tags: Array.from(
					{ length: TAGS_MAX_COUNT + 1 },
					(_, index) => `t${index}`
				),
			},
		],
		["单个标签 21 字", { tags: ["a".repeat(TAG_MAX_LENGTH + 1)] }],
		["remark 不是字符串", { remark: 123 }],
		["tags 不是数组", { tags: "a,b" }],
	])("%s 返回 BAD_REQUEST，数据库无变化", async (_label, extra) => {
		const record = await createRecord();
		await expect(
			caller.update({ id: record.id, ...extra } as UpdateInput)
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			db.githubUser.findUniqueOrThrow({ where: { id: record.id } })
		).resolves.toEqual(record);
	});

	it.each([999_999, GITHUB_USER_ID_MAX])(
		"不存在的 ID %i 返回 NOT_FOUND / RECORD_NOT_FOUND",
		async (id) => {
			await expect(caller.update({ id, remark: "备注" })).rejects.toMatchObject(
				{
					cause: { appCode: AppCode.RECORD_NOT_FOUND },
					code: "NOT_FOUND",
				}
			);
		}
	);

	it("记录被删除后再修改返回 NOT_FOUND / RECORD_NOT_FOUND", async () => {
		const record = await createRecord();
		await db.githubUser.delete({ where: { id: record.id } });
		await expect(
			caller.update({ id: record.id, tags: ["a"] })
		).rejects.toMatchObject({
			cause: { appCode: AppCode.RECORD_NOT_FOUND },
			code: "NOT_FOUND",
		});
	});

	it.each([0, -1, 1.5, GITHUB_USER_ID_MAX + 1])(
		"ID %d 返回 BAD_REQUEST",
		async (id) => {
			await expect(caller.update({ id, remark: "x" })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		}
	);

	it("修改后 tags 接口返回新的标签选项", async () => {
		const record = await createRecord();
		await expect(caller.tags()).resolves.toEqual(["原标签"]);
		await caller.update({ id: record.id, tags: ["新标签"] });
		await expect(caller.tags()).resolves.toEqual(["新标签"]);
	});
});
