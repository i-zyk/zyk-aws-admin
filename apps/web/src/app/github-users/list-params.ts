// 名单列表（R05）的 URL 参数：解析（不合法回退默认值）和生成链接（默认值不写进 URL）。
// 服务端 page.tsx 和客户端组件共用，所以只依赖 zod 和共享 schemas。
import {
	GITHUB_USER_LIST_DEFAULT_PAGE_SIZE,
	type GithubUserListOrder,
	type GithubUserListPageSize,
	type GithubUserListSort,
	githubUserListOrderSchema,
	githubUserListPageSizeSchema,
	githubUserListSortSchema,
	SEARCH_KEYWORD_MAX_LENGTH,
	TAG_MAX_LENGTH,
} from "@zyk-aws-admin/api/github/schemas";
import z from "zod";

export interface GithubUserListParams {
	order: GithubUserListOrder;
	page: number;
	pageSize: GithubUserListPageSize;
	q: string;
	sort: GithubUserListSort;
	tag: string;
}

export const DEFAULT_LIST_PARAMS = {
	order: "desc",
	page: 1,
	pageSize: GITHUB_USER_LIST_DEFAULT_PAGE_SIZE,
	q: "",
	sort: "createdAt",
	tag: "",
} as const satisfies GithubUserListParams;

// 每个字段单独 .catch：缺失、重复（数组）或不合法时只回退该字段，不影响其他字段
const listParamsSchema = z.object({
	order: githubUserListOrderSchema.catch(DEFAULT_LIST_PARAMS.order),
	page: z.coerce.number().int().min(1).catch(DEFAULT_LIST_PARAMS.page),
	pageSize: z.coerce
		.number()
		.pipe(githubUserListPageSizeSchema)
		.catch(DEFAULT_LIST_PARAMS.pageSize),
	q: z
		.string()
		.trim()
		.max(SEARCH_KEYWORD_MAX_LENGTH)
		.catch(DEFAULT_LIST_PARAMS.q),
	sort: githubUserListSortSchema.catch(DEFAULT_LIST_PARAMS.sort),
	tag: z.string().trim().max(TAG_MAX_LENGTH).catch(DEFAULT_LIST_PARAMS.tag),
});

export function parseListParams(
	searchParams: Record<string, string | string[] | undefined>
): GithubUserListParams {
	return listParamsSchema.parse(searchParams);
}

const LIST_PARAM_KEYS = [
	"q",
	"tag",
	"sort",
	"order",
	"page",
	"pageSize",
] as const satisfies readonly (keyof GithubUserListParams)[];

/** 生成名单列表链接：只写和默认值不同的参数 */
export function listHref(params: GithubUserListParams) {
	const search = new URLSearchParams();
	for (const key of LIST_PARAM_KEYS) {
		const value = params[key];
		if (value !== DEFAULT_LIST_PARAMS[key]) {
			search.set(key, String(value));
		}
	}
	const query = search.toString();
	return query === "" ? "/github-users" : (`/github-users?${query}` as const);
}

export function hasListFilters(params: GithubUserListParams): boolean {
	return params.q !== "" || params.tag !== "";
}
