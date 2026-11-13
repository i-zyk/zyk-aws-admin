import {
	createTestDatabase,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../context";
import type { GithubClient } from "../github/client";
import {
	GITHUB_USER_DELETE_MANY_MAX,
	GITHUB_USER_ID_MAX,
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
		userId: "test-user",
	},
	user: {
		createdAt: now,
		email: "delete-many-test@example.com",
		emailVerified: false,
		id: "test-user",
		name: "测试用户",
		updatedAt: now,
	},
};

const github: GithubClient = {
	getUserById: vi.fn<GithubClient["getUserById"]>(),
	getUserByLogin: vi.fn<GithubClient["getUserByLogin"]>(),
	searchUsers: vi.fn<GithubClient["searchUsers"]>(),
};
const caller = githubUserRouter.createCaller({ db, github, session });

/** 一个不会和测试记录冲突的 ID（测试库每次重置，自增 ID 远小于它） */
const MISSING_ID = 999_999;

/** 创建一条带备注和标签的记录，githubId / login 按序号区分 */
const createRecord = (index: number) =>
	db.githubUser.create({
		data: {
			avatarUrl: `https://avatars.githubusercontent.com/u/${index}`,
			createdById: session.user.id,
			githubCreatedAt: now,
			githubId: index,
			githubUpdatedAt: now,
			htmlUrl: `https://github.com/user-${index}`,
			login: `user-${index}`,
			remark: `备注 ${index}`,
			syncedAt: now,
			tags: ["bulk", `tag-${index}`],
		},
	});

/** 创建 count 条记录，返回顺序和序号 1～count 一致（自增 ID 的大小顺序不保证） */
const createRecords = (count: number) =>
	Promise.all(
		Array.from({ length: count }, (_, index) => createRecord(index + 1))
	);

const remainingIds = async () =>
	(
		await db.githubUser.findMany({
			orderBy: { id: "asc" },
			select: { id: true },
		})
	).map(({ id }) => id);

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.deleteMany", () => {
	it("未登录时拒绝请求，记录不受影响", async () => {
		const records = await createRecords(2);
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(
			anonymous.deleteMany({ ids: records.map(({ id }) => id) })
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(db.githubUser.count()).resolves.toBe(2);
	});

	it("删除 3 条返回 { count: 3 }，未勾选的记录不受影响，不请求 GitHub", async () => {
		const records = await createRecords(5);
		const [first, second, third, fourth, fifth] = records;
		const targets = [first, third, fifth].map((record) => record?.id ?? 0);

		await expect(caller.deleteMany({ ids: targets })).resolves.toEqual({
			count: 3,
		});
		await expect(
			db.githubUser.count({ where: { id: { in: targets } } })
		).resolves.toBe(0);
		await expect(remainingIds()).resolves.toEqual(
			[second?.id ?? 0, fourth?.id ?? 0].sort((a, b) => a - b)
		);
		// 留下的记录备注和标签没变
		await expect(
			db.githubUser.findUnique({ where: { id: second?.id ?? 0 } })
		).resolves.toMatchObject({ remark: "备注 2", tags: ["bulk", "tag-2"] });
		expect(github.getUserById).not.toHaveBeenCalled();
		expect(github.getUserByLogin).not.toHaveBeenCalled();
		expect(github.searchUsers).not.toHaveBeenCalled();
	});

	it("混入不存在的 ID 时忽略它，count 为实际删除数", async () => {
		const records = await createRecords(3);
		const ids = [...records.map(({ id }) => id), MISSING_ID];

		await expect(caller.deleteMany({ ids })).resolves.toEqual({ count: 3 });
		await expect(db.githubUser.count()).resolves.toBe(0);
	});

	it("全部 ID 都不存在时返回 { count: 0 }", async () => {
		await createRecords(1);
		await expect(
			caller.deleteMany({ ids: [MISSING_ID, GITHUB_USER_ID_MAX] })
		).resolves.toEqual({ count: 0 });
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it("重复 ID 只算一次", async () => {
		const [first, second] = await createRecords(3);
		const firstId = first?.id ?? 0;
		const secondId = second?.id ?? 0;

		await expect(
			caller.deleteMany({ ids: [firstId, firstId, secondId, firstId] })
		).resolves.toEqual({ count: 2 });
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it("已被删掉的记录再删一次返回 { count: 0 }", async () => {
		const records = await createRecords(2);
		const ids = records.map(({ id }) => id);
		await caller.deleteMany({ ids });
		await expect(caller.deleteMany({ ids })).resolves.toEqual({ count: 0 });
	});

	it(`正好 ${GITHUB_USER_DELETE_MANY_MAX} 个 ID 时可以提交`, async () => {
		const records = await createRecords(2);
		const ids = [
			...records.map(({ id }) => id),
			...Array.from(
				{ length: GITHUB_USER_DELETE_MANY_MAX - records.length },
				(_, index) => MISSING_ID + index
			),
		];
		expect(ids).toHaveLength(GITHUB_USER_DELETE_MANY_MAX);
		await expect(caller.deleteMany({ ids })).resolves.toEqual({ count: 2 });
	});

	it("空数组返回 BAD_REQUEST", async () => {
		await createRecords(1);
		await expect(caller.deleteMany({ ids: [] })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it(`${GITHUB_USER_DELETE_MANY_MAX + 1} 个 ID 返回 BAD_REQUEST，不删除任何记录`, async () => {
		const records = await createRecords(2);
		const ids = [
			...records.map(({ id }) => id),
			...Array.from(
				{ length: GITHUB_USER_DELETE_MANY_MAX + 1 - records.length },
				(_, index) => MISSING_ID + index
			),
		];
		expect(ids).toHaveLength(GITHUB_USER_DELETE_MANY_MAX + 1);
		await expect(caller.deleteMany({ ids })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
		await expect(db.githubUser.count()).resolves.toBe(2);
	});

	it.each([0, -1, 1.5, GITHUB_USER_ID_MAX + 1, Number.NaN])(
		"含非法 ID %d 时返回 BAD_REQUEST，不删除任何记录",
		async (badId) => {
			const [record] = await createRecords(1);
			await expect(
				caller.deleteMany({ ids: [record?.id ?? 0, badId] })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(db.githubUser.count()).resolves.toBe(1);
		}
	);

	it("ids 不是数字数组时返回 BAD_REQUEST", async () => {
		await expect(
			caller.deleteMany({ ids: ["1"] as unknown as number[] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.deleteMany({ ids: 1 as unknown as number[] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			caller.deleteMany({} as unknown as { ids: number[] })
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});
