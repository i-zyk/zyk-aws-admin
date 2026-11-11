import z from "zod";

import { searchKeywordSchema } from "../github/schemas";
import { protectedProcedure, router } from "../index";

const SEARCH_PAGE_SIZE = 10;
const SEARCH_MAX_RESULTS = 1000;
const SEARCH_MAX_PAGE = SEARCH_MAX_RESULTS / SEARCH_PAGE_SIZE;

/** GitHub 用户名单相关接口，具体 procedure 在 R02～R10 中逐个加入 */
export const githubUserRouter = router({
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
