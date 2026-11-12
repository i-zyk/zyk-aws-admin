import {
	isRecordNotFoundError,
	isUniqueConstraintError,
} from "@zyk-aws-admin/db";
import z from "zod";

import { AppCode, appError } from "../errors";
import {
	type GithubProfileDto,
	type GithubUserRecordDto,
	toGithubUserData,
	toProfileDto,
	toRecordDto,
} from "../github/mapper";
import {
	githubUserIdSchema,
	githubUserListInputSchema,
	githubUsernameSchema,
	githubUserUpdateInputSchema,
	searchKeywordSchema,
} from "../github/schemas";
import { protectedProcedure, router } from "../index";

const SEARCH_PAGE_SIZE = 10;
const SEARCH_MAX_RESULTS = 1000;
const SEARCH_MAX_PAGE = SEARCH_MAX_RESULTS / SEARCH_PAGE_SIZE;

/** 关键字匹配的字段：用户名、昵称、公司、备注（不含 bio 等其他字段） */
const LIST_KEYWORD_FIELDS = ["login", "name", "company", "remark"] as const;

/** PostgreSQL LIKE 的元字符（默认转义符为反斜杠）；Prisma 的 contains 不会转义，需要自己转义才能按字面匹配 */
const LIKE_METACHARACTER_PATTERN = /[\\%_]/g;
const escapeLikePattern = (keyword: string): string =>
	keyword.replace(LIKE_METACHARACTER_PATTERN, "\\$&");

/**
 * Prisma 查询编译器会把超过 32 位无符号整数的 OFFSET 回绕成小值（返回前面的记录）。
 * 偏移量超过这个保守上限时一定超出数据范围，不发 findMany，直接返回空 items。
 */
const LIST_MAX_OFFSET = 2 ** 31 - 1;

const alreadySavedError = (cause?: unknown) =>
	appError("CONFLICT", AppCode.GITHUB_USER_ALREADY_SAVED, { cause });

/** GitHub 用户名单相关接口，具体 procedure 在 R02～R10 中逐个加入 */
export const githubUserRouter = router({
	/**
	 * 名单记录详情：只读本地数据库，不请求 GitHub。
	 * createdById 不建外键（不能给 Better Auth 的 user 表加反向关联），添加人单独查；
	 * 添加人账号已删除时 createdBy 为 null。
	 */
	byId: protectedProcedure
		.input(z.object({ id: githubUserIdSchema }))
		.query(
			async ({
				ctx,
				input,
			}): Promise<
				GithubUserRecordDto & { createdBy: { id: string; name: string } | null }
			> => {
				const record = await ctx.db.githubUser.findUnique({
					where: { id: input.id },
				});
				if (!record) {
					throw appError("NOT_FOUND", AppCode.RECORD_NOT_FOUND);
				}
				const createdBy = await ctx.db.user.findUnique({
					select: { id: true, name: true },
					where: { id: record.createdById },
				});
				return { ...toRecordDto(record), createdBy };
			}
		),
	/**
	 * 把 GitHub 用户加入名单：不走缓存重新拉取最新资料，按 githubId 判重后写库。
	 * 先查后插之间的并发由 githubId 唯一约束兜底（P2002 → CONFLICT）；GitHub 出错时不写库。
	 */
	create: protectedProcedure
		.input(z.object({ username: githubUsernameSchema }))
		.mutation(async ({ ctx, input }): Promise<GithubUserRecordDto> => {
			const profile = await ctx.github.getUserByLogin(input.username, {
				cache: false,
			});
			const existing = await ctx.db.githubUser.findUnique({
				select: { id: true },
				where: { githubId: profile.id },
			});
			if (existing) {
				throw alreadySavedError();
			}
			try {
				const record = await ctx.db.githubUser.create({
					data: {
						...toGithubUserData(profile),
						createdById: ctx.session.user.id,
						syncedAt: new Date(),
					},
				});
				return toRecordDto(record);
			} catch (error) {
				if (isUniqueConstraintError(error, "githubId")) {
					throw alreadySavedError(error);
				}
				throw error;
			}
		}),

	/**
	 * 物理删除一条名单记录（R09，D2：不做回收站），备注和标签随记录一起删除，githubId 唯一约束随之释放。
	 * 用 deleteMany 按删除行数判断记录是否存在：单条 DELETE 语句，并发删除同一条时后到的删到 0 行，
	 * 不依赖驱动适配器下 P2025 的错误细节。
	 */
	delete: protectedProcedure
		.input(z.object({ id: githubUserIdSchema }))
		.mutation(async ({ ctx, input }): Promise<{ id: number }> => {
			const { count } = await ctx.db.githubUser.deleteMany({
				where: { id: input.id },
			});
			if (count === 0) {
				throw appError("NOT_FOUND", AppCode.RECORD_NOT_FOUND);
			}
			return { id: input.id };
		}),

	/**
	 * 名单列表：关键字（4 个字段包含匹配、不区分大小写）、标签、排序、分页组合查询，只读本地数据库。
	 * 关键字里的 %、_、反斜杠按字面匹配；排序后再按 id 同向排序，保证排序字段相同时翻页顺序稳定；
	 * page 超出范围时返回空 items 和真实 total。
	 */
	list: protectedProcedure.input(githubUserListInputSchema).query(
		async ({
			ctx,
			input,
		}): Promise<{
			items: GithubUserRecordDto[];
			page: number;
			pageSize: number;
			total: number;
		}> => {
			const { order, page, pageSize, q, sort, tag } = input;
			const where = {
				AND: [
					q
						? {
								OR: LIST_KEYWORD_FIELDS.map((field) => ({
									[field]: {
										contains: escapeLikePattern(q),
										mode: "insensitive" as const,
									},
								})),
							}
						: {},
					tag ? { tags: { has: tag } } : {},
				],
			};
			const skip = (page - 1) * pageSize;
			if (skip > LIST_MAX_OFFSET) {
				const total = await ctx.db.githubUser.count({ where });
				return { items: [], page, pageSize, total };
			}
			const [records, total] = await ctx.db.$transaction([
				ctx.db.githubUser.findMany({
					orderBy: [{ [sort]: order }, { id: order }],
					skip,
					take: pageSize,
					where,
				}),
				ctx.db.githubUser.count({ where }),
			]);
			return { items: records.map(toRecordDto), page, pageSize, total };
		}
	),

	/**
	 * 按用户名查看 GitHub 完整公开资料（添加前预览），只读不写数据库。
	 * 用不会变的 githubId 判断是否已在名单中，GitHub 错误原样透传。
	 */
	lookup: protectedProcedure
		.input(z.object({ username: githubUsernameSchema }))
		.query(
			async ({
				ctx,
				input,
			}): Promise<GithubProfileDto & { savedId: number | null }> => {
				const profile = await ctx.github.getUserByLogin(input.username);
				const saved = await ctx.db.githubUser.findUnique({
					select: { id: true },
					where: { githubId: profile.id },
				});
				return { ...toProfileDto(profile), savedId: saved?.id ?? null };
			}
		),

	search: protectedProcedure
		.input(
			z.object({
				page: z.number().int().min(1).max(SEARCH_MAX_PAGE).default(1),
				q: searchKeywordSchema,
			})
		)
		.query(async ({ ctx, input }) => {
			const { items, total } = await ctx.github.searchUsers(input);
			const savedUsers = await ctx.db.githubUser.findMany({
				select: { githubId: true, id: true },
				where: { githubId: { in: items.map((item) => item.id) } },
			});
			const savedIds = new Map(
				savedUsers.map((user) => [user.githubId, user.id])
			);
			const keyword = input.q.toLowerCase();
			const results = items.map((item) => ({
				avatarUrl: item.avatar_url,
				exactMatch: item.login.toLowerCase() === keyword,
				githubId: item.id,
				htmlUrl: item.html_url,
				login: item.login,
				savedId: savedIds.get(item.id) ?? null,
			}));

			return {
				hasMore:
					input.page * SEARCH_PAGE_SIZE < Math.min(total, SEARCH_MAX_RESULTS),
				items: results.toSorted(
					(left, right) => Number(right.exactMatch) - Number(left.exactMatch)
				),
				page: input.page,
				total,
			};
		}),

	/**
	 * 从 GitHub 同步一条记录：先查本地（不存在时不消耗 GitHub 额度），再按不会变的 githubId
	 * 不走缓存拉取最新资料（对方改名也能同步到），只覆盖 GitHub 字段和 syncedAt，备注、标签、添加人不变。
	 * GitHub 错误原样透传、不写库；同步过程中记录被删除（P2025）→ RECORD_NOT_FOUND。
	 */
	sync: protectedProcedure
		.input(z.object({ id: githubUserIdSchema }))
		.mutation(async ({ ctx, input }): Promise<GithubUserRecordDto> => {
			const record = await ctx.db.githubUser.findUnique({
				select: { githubId: true },
				where: { id: input.id },
			});
			if (!record) {
				throw appError("NOT_FOUND", AppCode.RECORD_NOT_FOUND);
			}
			const profile = await ctx.github.getUserById(record.githubId);
			if (profile.id !== record.githubId) {
				// 理论上不会发生；防御性处理，不把别人的资料写进这条记录
				throw appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE, {
					message: `GitHub 返回的 id ${profile.id} 与记录的 githubId ${record.githubId} 不一致`,
				});
			}
			try {
				const updated = await ctx.db.githubUser.update({
					data: { ...toGithubUserData(profile), syncedAt: new Date() },
					where: { id: input.id },
				});
				return toRecordDto(updated);
			} catch (error) {
				if (isRecordNotFoundError(error)) {
					throw appError("NOT_FOUND", AppCode.RECORD_NOT_FOUND, {
						cause: error,
					});
				}
				throw error;
			}
		}),

	/** 所有用过的标签，去重后按字母顺序排列（Prisma 没有数组展开去重的 API，用原生 SQL） */
	tags: protectedProcedure.query(async ({ ctx }): Promise<string[]> => {
		const rows = await ctx.db.$queryRaw<{ tag: string }[]>`
			SELECT DISTINCT unnest(tags) AS tag FROM github_user ORDER BY tag
		`;
		return rows.map((row) => row.tag);
	}),

	/**
	 * 修改备注和标签：只写 remark、tags 两个后台字段，GitHub 字段只能通过同步更新。
	 * 输入已由共享规则规范化（trim、空备注转 null、标签去空去重）；不传的字段为 undefined，Prisma 不更新。
	 * 记录不存在（P2025）→ NOT_FOUND / RECORD_NOT_FOUND；并发修改后写覆盖先写。
	 */
	update: protectedProcedure
		.input(githubUserUpdateInputSchema)
		.mutation(async ({ ctx, input }): Promise<GithubUserRecordDto> => {
			const { id, remark, tags } = input;
			try {
				const record = await ctx.db.githubUser.update({
					data: { remark, tags },
					where: { id },
				});
				return toRecordDto(record);
			} catch (error) {
				if (isRecordNotFoundError(error)) {
					throw appError("NOT_FOUND", AppCode.RECORD_NOT_FOUND, {
						cause: error,
					});
				}
				throw error;
			}
		}),
});
