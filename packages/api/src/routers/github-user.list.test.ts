import type { GithubUser } from "@zyk-aws-admin/db";
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
import type { GithubClient } from "../github/client";
import type {
	GithubUserListOrder,
	GithubUserListSort,
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
		email: "list-test@example.com",
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

const MINUTE_MS = 60_000;
const PERFORMANCE_ROW_COUNT = 1000;
const PERFORMANCE_LIMIT_MS = 300;
/** (page - 1) * pageSize 超过 32 位有符号整数上限的页码 */
const HUGE_PAGE = 214_748_366;

/** 测试记录：只需给出 login，其他字段可选，未给出的由 buildUser 补齐 */
type GithubUserSeed = Partial<Omit<GithubUser, "id" | "updatedAt">> & {
	login: string;
};

let nextGithubId = 1;

/** 生成一条测试记录，未指定的时间字段按 githubId 递增，保证互不相同 */
const buildUser = (seed: GithubUserSeed) => {
	const githubId = seed.githubId ?? nextGithubId;
	nextGithubId = Math.max(nextGithubId, githubId) + 1;
	return {
		avatarUrl: `https://avatars.githubusercontent.com/u/${githubId}`,
		createdAt: new Date(now.getTime() + githubId * MINUTE_MS),
		createdById: "test-user",
		githubCreatedAt: now,
		githubUpdatedAt: now,
		htmlUrl: `https://github.com/${seed.login}`,
		syncedAt: new Date(now.getTime() + githubId * MINUTE_MS),
		...seed,
		githubId,
	};
};

const seedUsers = async (seeds: GithubUserSeed[]): Promise<void> => {
	await db.githubUser.createMany({ data: seeds.map(buildUser) });
};

const logins = (items: { login: string }[]): string[] =>
	items.map((item) => item.login);

const expectGithubNotCalled = () => {
	expect(github.getUserById).not.toHaveBeenCalled();
	expect(github.getUserByLogin).not.toHaveBeenCalled();
	expect(github.searchUsers).not.toHaveBeenCalled();
};

beforeEach(async () => {
	await resetTestDatabase(db);
	vi.resetAllMocks();
	nextGithubId = 1;
});

afterEach(() => {
	// 列表和标签只读本地数据库，任何用例都不应请求 GitHub
	expectGithubNotCalled();
});

afterAll(async () => {
	await db.$disconnect();
});

describe("githubUser.list", () => {
	it("未登录时拒绝请求", async () => {
		const anonymous = githubUserRouter.createCaller({
			db,
			github,
			session: null,
		});
		await expect(anonymous.list({})).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
		await expect(anonymous.tags()).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("没有参数时返回默认分页，名单为空时 total 为 0", async () => {
		await expect(caller.list({})).resolves.toEqual({
			items: [],
			page: 1,
			pageSize: 20,
			total: 0,
		});
	});

	it.each([
		["login", { login: "NeedleUser" }],
		["name", { login: "u-name", name: "Mr NEEDLE" }],
		["company", { company: "needle Inc", login: "u-company" }],
		["remark", { login: "u-remark", remark: "认识于 NeEdLe 大会" }],
	] as const)("关键字命中 %s，不区分大小写", async (_field, seed) => {
		await seedUsers([seed, { login: "other", name: "someone" }]);
		const results = await Promise.all(
			["needle", "NEEDLE", "nEeDlE"].map((q) => caller.list({ q }))
		);
		for (const result of results) {
			expect(logins(result.items)).toEqual([seed.login]);
			expect(result.total).toBe(1);
		}
	});

	it("关键字不匹配 bio、所在地、邮箱、博客等其他字段", async () => {
		await seedUsers([
			{
				bio: "needle",
				blog: "https://needle.dev",
				email: "needle@example.com",
				location: "Needle City",
				login: "other-fields",
				twitterUsername: "needle",
			},
		]);
		await expect(caller.list({ q: "needle" })).resolves.toMatchObject({
			items: [],
			total: 0,
		});
	});

	it("关键字同时命中多个字段的同一条记录只返回一次", async () => {
		await seedUsers([
			{ company: "needle", login: "needle", name: "needle", remark: "needle" },
		]);
		const result = await caller.list({ q: "needle" });
		expect(logins(result.items)).toEqual(["needle"]);
		expect(result.total).toBe(1);
	});

	it.each(["", "   "])("关键字 %j 视为不过滤", async (q) => {
		await seedUsers([{ login: "a" }, { login: "b" }]);
		await expect(caller.list({ q })).resolves.toMatchObject({ total: 2 });
	});

	it("关键字首尾空格会被去掉", async () => {
		await seedUsers([{ login: "needle" }, { login: "other" }]);
		const result = await caller.list({ q: "  needle  " });
		expect(logins(result.items)).toEqual(["needle"]);
	});

	it.each([
		["%", "100%-sure", "100-sure"],
		["_", "under_score", "underXscore"],
		["\\", "back\\slash", "backslash"],
	])("关键字含 %j 时按字面匹配", async (keyword, hit, miss) => {
		await seedUsers([
			{ login: "hit", remark: hit },
			{ login: "miss", remark: miss },
		]);
		const result = await caller.list({ q: keyword });
		expect(logins(result.items)).toEqual(["hit"]);
		expect(result.total).toBe(1);
	});

	it("关键字超过 100 个字符返回 BAD_REQUEST", async () => {
		await expect(caller.list({ q: "a".repeat(101) })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	it("按标签过滤，只返回带该标签的记录，区分大小写", async () => {
		await seedUsers([
			{ login: "rust-1", tags: ["rust", "backend"] },
			{ login: "rust-2", tags: ["rust"] },
			{ login: "upper", tags: ["Rust"] },
			{ login: "none", tags: [] },
		]);
		const result = await caller.list({
			order: "asc",
			sort: "createdAt",
			tag: "rust",
		});
		expect(logins(result.items)).toEqual(["rust-1", "rust-2"]);
		expect(result.total).toBe(2);

		await expect(caller.list({ tag: "Rust" })).resolves.toMatchObject({
			items: [expect.objectContaining({ login: "upper" })],
			total: 1,
		});
		await expect(caller.list({ tag: "missing" })).resolves.toMatchObject({
			items: [],
			total: 0,
		});
		await expect(caller.list({ tag: "" })).resolves.toMatchObject({
			total: 4,
		});
	});

	it("标签超过 20 个字符返回 BAD_REQUEST", async () => {
		await expect(caller.list({ tag: "a".repeat(21) })).rejects.toMatchObject({
			code: "BAD_REQUEST",
		});
	});

	describe("排序", () => {
		// 三个字段的大小顺序互不相同，排序结果能区分是按哪个字段排的
		const seeds: GithubUserSeed[] = [
			{
				createdAt: new Date("2026-01-01T00:00:00Z"),
				followers: 30,
				login: "a",
				syncedAt: new Date("2026-03-02T00:00:00Z"),
			},
			{
				createdAt: new Date("2026-01-02T00:00:00Z"),
				followers: 10,
				login: "b",
				syncedAt: new Date("2026-03-03T00:00:00Z"),
			},
			{
				createdAt: new Date("2026-01-03T00:00:00Z"),
				followers: 20,
				login: "c",
				syncedAt: new Date("2026-03-01T00:00:00Z"),
			},
		];
		const ascending: Record<GithubUserListSort, string[]> = {
			createdAt: ["a", "b", "c"],
			followers: ["b", "c", "a"],
			syncedAt: ["c", "a", "b"],
		};
		const cases = (Object.keys(ascending) as GithubUserListSort[]).flatMap(
			(sort) =>
				(["asc", "desc"] as const).map(
					(order): [GithubUserListSort, GithubUserListOrder] => [sort, order]
				)
		);

		it.each(cases)("按 %s %s 排序", async (sort, order) => {
			await seedUsers(seeds);
			const expected =
				order === "asc" ? ascending[sort] : ascending[sort].toReversed();
			const result = await caller.list({ order, sort });
			expect(logins(result.items)).toEqual(expected);
		});

		it("默认按添加时间倒序", async () => {
			await seedUsers(seeds);
			const result = await caller.list({});
			expect(logins(result.items)).toEqual(["c", "b", "a"]);
		});

		it("排序字段相同时按 id 同向排序，翻页不重复不遗漏", async () => {
			const PAGE_SIZE = 10;
			const ROW_COUNT = 25;
			await seedUsers(
				Array.from({ length: ROW_COUNT }, (_, index) => ({
					followers: 5,
					login: `same-${index}`,
				}))
			);
			const orders = ["asc", "desc"] as const;
			const idsByOrder = await Promise.all(
				orders.map(async (order) => {
					const pages = await Promise.all(
						[1, 2, 3].map((page) =>
							caller.list({
								order,
								page,
								pageSize: PAGE_SIZE,
								sort: "followers",
							})
						)
					);
					return pages.flatMap((result) => result.items.map((item) => item.id));
				})
			);
			const [ascendingIds, descendingIds] = idsByOrder;
			expect(ascendingIds).toHaveLength(ROW_COUNT);
			expect(new Set(ascendingIds).size).toBe(ROW_COUNT);
			expect(ascendingIds).toEqual(
				ascendingIds?.toSorted((left, right) => left - right)
			);
			expect(descendingIds).toEqual(ascendingIds?.toReversed());
		});

		it("不支持的排序字段或方向返回 BAD_REQUEST", async () => {
			await expect(
				caller.list({ sort: "login" as GithubUserListSort })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			await expect(
				caller.list({ order: "up" as GithubUserListOrder })
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		});
	});

	describe("分页", () => {
		it.each([10, 20, 50] as const)(
			"pageSize %i 每页返回对应条数",
			async (pageSize) => {
				const ROW_COUNT = 55;
				await seedUsers(
					Array.from({ length: ROW_COUNT }, (_, index) => ({
						login: `user-${index}`,
					}))
				);
				const result = await caller.list({ pageSize });
				expect(result).toMatchObject({ page: 1, pageSize, total: ROW_COUNT });
				expect(result.items).toHaveLength(pageSize);
			}
		);

		it("默认每页 20 条", async () => {
			await seedUsers(
				Array.from({ length: 21 }, (_, index) => ({ login: `user-${index}` }))
			);
			const result = await caller.list({});
			expect(result.pageSize).toBe(20);
			expect(result.items).toHaveLength(20);
			expect(result.total).toBe(21);
		});

		it.each([0, 5, 15, 30, 100, 20.5])(
			"pageSize %d 返回 BAD_REQUEST",
			async (pageSize) => {
				await expect(
					caller.list({ pageSize: pageSize as 20 })
				).rejects.toMatchObject({ code: "BAD_REQUEST" });
			}
		);

		it.each([0, -1, 1.5])("page %d 返回 BAD_REQUEST", async (page) => {
			await expect(caller.list({ page })).rejects.toMatchObject({
				code: "BAD_REQUEST",
			});
		});

		it("最后一页只返回剩余条数", async () => {
			await seedUsers(
				Array.from({ length: 23 }, (_, index) => ({ login: `user-${index}` }))
			);
			const result = await caller.list({ page: 3, pageSize: 10 });
			expect(result.items).toHaveLength(3);
			expect(result.total).toBe(23);
		});

		it("page 超出范围时返回空数组和真实 total", async () => {
			await seedUsers([{ login: "a" }, { login: "b" }, { login: "c" }]);
			await expect(caller.list({ page: 2, pageSize: 10 })).resolves.toEqual({
				items: [],
				page: 2,
				pageSize: 10,
				total: 3,
			});
		});

		it("page 极大（偏移量超过 32 位）时返回空数组和真实 total", async () => {
			await seedUsers([
				{ login: "a", tags: ["x"] },
				{ login: "b", tags: ["x"] },
				{ login: "c" },
			]);
			await expect(
				caller.list({ page: HUGE_PAGE, pageSize: 10 })
			).resolves.toEqual({
				items: [],
				page: HUGE_PAGE,
				pageSize: 10,
				total: 3,
			});
			await expect(
				caller.list({ page: HUGE_PAGE, pageSize: 50, tag: "x" })
			).resolves.toEqual({
				items: [],
				page: HUGE_PAGE,
				pageSize: 50,
				total: 2,
			});
		});
	});

	it("关键字 + 标签 + 排序 + 第 2 页组合使用，total 为过滤后的总数", async () => {
		const MATCH_COUNT = 13;
		await seedUsers([
			// 命中关键字和标签：粉丝数 0~12，用于第 2 页断言
			...Array.from({ length: MATCH_COUNT }, (_, index) => ({
				followers: index,
				login: `dev-${index}`,
				name: index % 2 === 0 ? "Go Dev" : null,
				remark: index % 2 === 0 ? null : "go dev",
				tags: ["go", "team"],
			})),
			// 命中关键字但没有标签
			{ followers: 100, login: "dev-no-tag", tags: ["rust"] },
			// 有标签但不命中关键字
			{ followers: 200, login: "designer", tags: ["go"] },
		]);
		const result = await caller.list({
			order: "desc",
			page: 2,
			pageSize: 10,
			q: "DEV",
			sort: "followers",
			tag: "go",
		});
		expect(result).toMatchObject({ page: 2, pageSize: 10, total: MATCH_COUNT });
		expect(logins(result.items)).toEqual(["dev-2", "dev-1", "dev-0"]);
	});

	it("返回的记录是完整 DTO，时间字段为 ISO 字符串", async () => {
		await seedUsers([
			{ company: "ACME", login: "dto", remark: "备注", tags: ["a"] },
		]);
		const record = await db.githubUser.findFirstOrThrow();
		const result = await caller.list({});
		expect(result.items[0]).toMatchObject({
			company: "ACME",
			createdAt: record.createdAt.toISOString(),
			githubId: record.githubId,
			id: record.id,
			login: "dto",
			remark: "备注",
			syncedAt: record.syncedAt.toISOString(),
			tags: ["a"],
		});
	});

	it(`${PERFORMANCE_ROW_COUNT} 条数据时关键字 + 标签 + 排序单次调用小于 ${PERFORMANCE_LIMIT_MS}ms`, async () => {
		await seedUsers(
			Array.from({ length: PERFORMANCE_ROW_COUNT }, (_, index) => ({
				company: index % 3 === 0 ? "Perf Company" : null,
				followers: (index * 7919) % PERFORMANCE_ROW_COUNT,
				login: `perf-user-${index}`,
				name: `Perf User ${index}`,
				remark: index % 5 === 0 ? "性能测试备注" : null,
				tags: index % 2 === 0 ? ["even", "perf"] : ["odd", "perf"],
			}))
		);
		const input = {
			order: "desc",
			page: 2,
			pageSize: 50,
			q: "perf",
			sort: "followers",
			tag: "even",
		} as const;
		// 预热一次：建立连接、编译查询
		await caller.list(input);

		const start = performance.now();
		const result = await caller.list(input);
		const elapsed = performance.now() - start;

		expect(result.total).toBe(PERFORMANCE_ROW_COUNT / 2);
		expect(result.items).toHaveLength(input.pageSize);
		expect(elapsed).toBeLessThan(PERFORMANCE_LIMIT_MS);
	});
});

describe("githubUser.tags", () => {
	it("名单为空时返回空数组", async () => {
		await expect(caller.tags()).resolves.toEqual([]);
	});

	it("返回所有用过的标签，去重并排序", async () => {
		await seedUsers([
			{ login: "a", tags: ["rust", "backend"] },
			{ login: "b", tags: ["go", "rust"] },
			{ login: "c", tags: [] },
			{ login: "d", tags: ["backend", "cli"] },
		]);
		await expect(caller.tags()).resolves.toEqual([
			"backend",
			"cli",
			"go",
			"rust",
		]);
	});
});
