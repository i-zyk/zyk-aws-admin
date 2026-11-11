import z from "zod";

import { type GithubProfileDto, toProfileDto } from "../github/mapper";
import { githubUsernameSchema, searchKeywordSchema } from "../github/schemas";
import { protectedProcedure, router } from "../index";

const SEARCH_PAGE_SIZE = 10;
const SEARCH_MAX_RESULTS = 1000;
const SEARCH_MAX_PAGE = SEARCH_MAX_RESULTS / SEARCH_PAGE_SIZE;

/** GitHub 用户名单相关接口，具体 procedure 在 R02～R10 中逐个加入 */
export const githubUserRouter = router({
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
});
