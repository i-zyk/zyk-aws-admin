// 前后端共用的校验规则和 GitHub 响应定义。
// apps/web 会在运行时导入本文件（requirements.md「已确认决策」D2），
// 所以这里只能依赖 zod，不得导入 db、auth、tRPC 等服务端代码。
import z from "zod";

/** 用户名：1~39 位，只含字母、数字和 -，不以 - 开头或结尾，没有连续两个 - */
const GITHUB_USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export const SEARCH_KEYWORD_MAX_LENGTH = 100;
export const REMARK_MAX_LENGTH = 500;
export const TAGS_MAX_COUNT = 10;
export const TAG_MAX_LENGTH = 20;

export const githubUsernameSchema = z
	.string()
	.trim()
	.regex(GITHUB_USERNAME_PATTERN, "用户名格式不正确");

export const searchKeywordSchema = z
	.string()
	.trim()
	.min(1, "请输入搜索关键字")
	.max(
		SEARCH_KEYWORD_MAX_LENGTH,
		`关键字最多 ${SEARCH_KEYWORD_MAX_LENGTH} 个字符`
	);

/** 备注：去掉首尾空格，最多 500 个字符；空字符串和 null 都存为 null */
export const remarkSchema = z
	.string()
	.trim()
	.max(REMARK_MAX_LENGTH, `备注最多 ${REMARK_MAX_LENGTH} 个字符`)
	.nullable()
	.transform((remark) => (remark === "" ? null : remark));

const uniqueNonEmpty = (tags: string[]): string[] =>
	Array.from(new Set(tags.filter((tag) => tag !== "")));

/** 标签：每个去掉首尾空格、去掉空的、去重，之后最多 10 个，每个最多 20 个字符 */
export const tagsSchema = z
	.array(
		z
			.string()
			.trim()
			.max(TAG_MAX_LENGTH, `每个标签最多 ${TAG_MAX_LENGTH} 个字符`)
	)
	.transform(uniqueNonEmpty)
	.pipe(
		z.array(z.string()).max(TAGS_MAX_COUNT, `标签最多 ${TAGS_MAX_COUNT} 个`)
	);

// ---- 名单记录 ID（R06 起）：详情页 URL 参数解析和 byId 等接口输入共用 ----

/** 记录 ID 是 PostgreSQL Int（32 位有符号），超过上限的 ID 一定不存在 */
export const GITHUB_USER_ID_MAX = 2_147_483_647;

/** 名单记录 ID：正整数，不超过 Int 上限 */
export const githubUserIdSchema = z
	.number()
	.int()
	.positive()
	.max(GITHUB_USER_ID_MAX);

// ---- 名单列表（R05）：URL 参数解析和 githubUser.list 输入共用 ----

export const GITHUB_USER_LIST_SORT_FIELDS = [
	"createdAt",
	"followers",
	"syncedAt",
] as const;
export const GITHUB_USER_LIST_ORDERS = ["asc", "desc"] as const;
export const GITHUB_USER_LIST_PAGE_SIZES = [10, 20, 50] as const;
export const GITHUB_USER_LIST_DEFAULT_PAGE_SIZE = 20;

export const githubUserListSortSchema = z.enum(GITHUB_USER_LIST_SORT_FIELDS);
export const githubUserListOrderSchema = z.enum(GITHUB_USER_LIST_ORDERS);
export const githubUserListPageSizeSchema = z.union(
	GITHUB_USER_LIST_PAGE_SIZES.map((size) => z.literal(size))
);

/** 名单列表查询：q、tag 为空字符串时视为不过滤；pageSize 只接受 10/20/50 */
export const githubUserListInputSchema = z.object({
	order: githubUserListOrderSchema.default("desc"),
	page: z.number().int().min(1).default(1),
	pageSize: githubUserListPageSizeSchema.default(
		GITHUB_USER_LIST_DEFAULT_PAGE_SIZE
	),
	q: z
		.string()
		.trim()
		.max(
			SEARCH_KEYWORD_MAX_LENGTH,
			`关键字最多 ${SEARCH_KEYWORD_MAX_LENGTH} 个字符`
		)
		.optional(),
	sort: githubUserListSortSchema.default("createdAt"),
	tag: z
		.string()
		.trim()
		.max(TAG_MAX_LENGTH, `每个标签最多 ${TAG_MAX_LENGTH} 个字符`)
		.optional(),
});

export type GithubUserListInput = z.input<typeof githubUserListInputSchema>;
export type GithubUserListSort = z.infer<typeof githubUserListSortSchema>;
export type GithubUserListOrder = z.infer<typeof githubUserListOrderSchema>;
export type GithubUserListPageSize = z.infer<
	typeof githubUserListPageSizeSchema
>;

// ---- GitHub 响应（只保留需要的字段，其余字段由 zod 默认丢弃） ----

const githubIdSchema = z.int().positive();
const githubCountSchema = z.int().nonnegative();
/** GitHub 对空字段可能返回 null，也可能不返回，统一成 null */
const githubOptionalTextSchema = z
	.string()
	.nullish()
	.transform((value) => value ?? null);

export const githubSearchItemSchema = z.object({
	avatar_url: z.string(),
	html_url: z.string(),
	id: githubIdSchema,
	login: z.string(),
});

export const githubSearchResponseSchema = z.object({
	items: z.array(githubSearchItemSchema),
	total_count: githubCountSchema,
});

export const githubUserResponseSchema = z.object({
	avatar_url: z.string(),
	bio: githubOptionalTextSchema,
	blog: githubOptionalTextSchema,
	company: githubOptionalTextSchema,
	created_at: z.iso.datetime({ offset: true }),
	email: githubOptionalTextSchema,
	followers: githubCountSchema,
	following: githubCountSchema,
	html_url: z.string(),
	id: githubIdSchema,
	location: githubOptionalTextSchema,
	login: z.string(),
	name: githubOptionalTextSchema,
	public_gists: githubCountSchema,
	public_repos: githubCountSchema,
	twitter_username: githubOptionalTextSchema,
	updated_at: z.iso.datetime({ offset: true }),
});

export type GithubSearchItem = z.infer<typeof githubSearchItemSchema>;
export type GithubSearchResponse = z.infer<typeof githubSearchResponseSchema>;
export type GithubProfile = z.infer<typeof githubUserResponseSchema>;
