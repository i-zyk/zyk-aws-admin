import {
	createTestDatabase,
	getTestDatabaseUrl,
	resetTestDatabase,
} from "@zyk-aws-admin/db/testing";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const TEST_DATABASE_NAME_PATTERN = /_test$/;
const NON_TEST_DATABASE_ERROR_PATTERN = /非测试库/;

const db = createTestDatabase();

beforeEach(async () => {
	await resetTestDatabase(db);
});

afterAll(async () => {
	await db.$disconnect();
});

describe("测试库", () => {
	it("测试进程的 DATABASE_URL 指向 _test 库", async () => {
		const [current] = await db.$queryRaw<
			{ name: string }[]
		>`SELECT current_database() AS name`;
		expect(current?.name).toMatch(TEST_DATABASE_NAME_PATTERN);
		expect(new URL(process.env.DATABASE_URL ?? "").pathname).toMatch(
			TEST_DATABASE_NAME_PATTERN
		);
	});

	it("已执行迁移，可以读写 github_user 表", async () => {
		await db.githubUser.create({
			data: {
				avatarUrl: "https://avatars.githubusercontent.com/u/1",
				createdById: "user-1",
				githubCreatedAt: new Date("2020-01-01T00:00:00Z"),
				githubId: 1,
				githubUpdatedAt: new Date("2020-01-02T00:00:00Z"),
				htmlUrl: "https://github.com/octocat",
				login: "octocat",
				syncedAt: new Date(),
			},
		});
		await expect(db.githubUser.count()).resolves.toBe(1);
	});

	it("resetTestDatabase 清空所有业务表", async () => {
		await expect(db.githubUser.count()).resolves.toBe(0);
		await expect(db.user.count()).resolves.toBe(0);
	});

	it("getTestDatabaseUrl 只把库名改成 <库名>_test", () => {
		expect(
			getTestDatabaseUrl("postgresql://u:p@localhost:5432/app?schema=public")
		).toBe("postgresql://u:p@localhost:5432/app_test?schema=public");
		expect(getTestDatabaseUrl("postgresql://u:p@localhost:5432/app_test")).toBe(
			"postgresql://u:p@localhost:5432/app_test"
		);
	});

	it("createTestDatabase 拒绝连接非测试库", () => {
		expect(() =>
			createTestDatabase("postgresql://u:p@localhost:5432/app")
		).toThrow(NON_TEST_DATABASE_ERROR_PATTERN);
	});
});
