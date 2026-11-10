// GitHub REST API 客户端：统一请求头、10 秒超时、状态码 → appError 映射、Zod 校验和 60 秒内存缓存。
// 直接抛出带 appCode 的 TRPCError，router 不再做二次映射。
import type { TRPCError } from "@trpc/server";
import type { ZodType } from "zod";

import { AppCode, appError } from "../errors";
import { createTtlCache } from "./cache";
import {
	type GithubProfile,
	type GithubSearchItem,
	githubSearchResponseSchema,
	githubUserResponseSchema,
} from "./schemas";

const GITHUB_API_BASE_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_USER_AGENT = "zyk-aws-admin";
const GITHUB_REQUEST_TIMEOUT_MS = 10_000;
const SEARCH_PER_PAGE = 10;
/** 搜索只要个人账号，不要组织 */
const SEARCH_TYPE_QUALIFIER = " type:user";

export const GITHUB_CACHE_TTL_MS = 60_000;
export const GITHUB_CACHE_MAX_ENTRIES = 500;

/** 限流响应既没有 x-ratelimit-reset 也没有 retry-after 时，按 60 秒后重置处理 */
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;
const MS_PER_SECOND = 1000;

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE_ENTITY = 422;
const HTTP_TOO_MANY_REQUESTS = 429;

export interface GithubClientOptions {
	/** 替换全局 fetch，测试时注入 */
	fetch?: typeof fetch;
	/** 当前时间（毫秒），用于缓存过期和推算限流重置时间，测试时注入 */
	now?: () => number;
	/** GitHub token，只读公开资料；没有时不带 Authorization */
	token?: string;
}

export interface GithubSearchResult {
	items: GithubSearchItem[];
	total: number;
}

export interface GetUserByLoginOptions {
	/** 默认 true；false 时不读也不写缓存（添加时用，保证保存的是最新资料） */
	cache?: boolean;
}

export interface GithubClient {
	/** 按 GitHub 数字 ID 查资料（同步用），不走缓存 */
	getUserById: (id: number) => Promise<GithubProfile>;
	/** 按用户名查资料，默认按「用户名小写」缓存 60 秒 */
	getUserByLogin: (
		login: string,
		options?: GetUserByLoginOptions
	) => Promise<GithubProfile>;
	/** 搜索个人账号，按「关键字小写 + 页码」缓存 60 秒 */
	searchUsers: (input: {
		page: number;
		q: string;
	}) => Promise<GithubSearchResult>;
}

/** search 接口的限流和 422 有单独的错误码，其他接口归为 core */
type GithubEndpoint = "core" | "search";

type CachedValue =
	| { kind: "search"; data: GithubSearchResult }
	| { kind: "user"; data: GithubProfile };

const githubUnavailable = (cause: unknown): TRPCError =>
	appError("BAD_GATEWAY", AppCode.GITHUB_UNAVAILABLE, { cause });

/** 把响应头里的秒数解析成非负数；缺失或不是数字时返回 null */
const parseSeconds = (value: string | null): number | null => {
	if (value === null || value.trim() === "") {
		return null;
	}
	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
};

/** 限流重置时间（毫秒时间戳）：优先 x-ratelimit-reset，其次 retry-after，都没有时取 60 秒后 */
const getRateLimitResetAt = (headers: Headers, now: number): number => {
	const resetSeconds = parseSeconds(headers.get("x-ratelimit-reset"));
	if (resetSeconds !== null) {
		return resetSeconds * MS_PER_SECOND;
	}
	const retryAfterSeconds = parseSeconds(headers.get("retry-after"));
	if (retryAfterSeconds !== null) {
		return now + retryAfterSeconds * MS_PER_SECOND;
	}
	return now + DEFAULT_RATE_LIMIT_RETRY_MS;
};

const isRateLimited = (response: Response): boolean => {
	if (response.status === HTTP_TOO_MANY_REQUESTS) {
		return true;
	}
	// 403 但额度没用完（例如被 GitHub 风控）不算限流，按不可用处理
	return (
		response.status === HTTP_FORBIDDEN &&
		response.headers.get("x-ratelimit-remaining") === "0"
	);
};

/** 非 2xx 响应 → 带 appCode 的 TRPCError */
const mapErrorResponse = (
	response: Response,
	endpoint: GithubEndpoint,
	now: number
): TRPCError => {
	const cause = new Error(
		`GitHub ${endpoint} API responded with HTTP ${response.status}`
	);
	if (response.status === HTTP_NOT_FOUND) {
		return appError("NOT_FOUND", AppCode.GITHUB_USER_NOT_FOUND, { cause });
	}
	if (isRateLimited(response)) {
		return appError(
			"TOO_MANY_REQUESTS",
			endpoint === "search"
				? AppCode.GITHUB_SEARCH_RATE_LIMITED
				: AppCode.GITHUB_RATE_LIMITED,
			{ cause, resetAt: getRateLimitResetAt(response.headers, now) }
		);
	}
	if (endpoint === "search" && response.status === HTTP_UNPROCESSABLE_ENTITY) {
		return appError("BAD_REQUEST", AppCode.GITHUB_SEARCH_INVALID, { cause });
	}
	// 5xx 以及其他意料之外的状态码（401 token 失效等）
	return githubUnavailable(cause);
};

export const createGithubClient = ({
	fetch: fetchImpl = fetch,
	now = Date.now,
	token,
}: GithubClientOptions = {}): GithubClient => {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": GITHUB_USER_AGENT,
		"X-GitHub-Api-Version": GITHUB_API_VERSION,
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const cache = createTtlCache<CachedValue>({
		maxEntries: GITHUB_CACHE_MAX_ENTRIES,
		now,
		ttlMs: GITHUB_CACHE_TTL_MS,
	});

	/** 发请求并用 schema 校验响应；网络错误、超时、非 2xx、数据格式不符都转成 TRPCError */
	const request = async <T>(
		path: string,
		endpoint: GithubEndpoint,
		schema: ZodType<T>
	): Promise<T> => {
		// 超时信号同时覆盖读取响应体；超时抛 TimeoutError，网络错误抛 TypeError
		let response: Response;
		try {
			response = await fetchImpl(`${GITHUB_API_BASE_URL}${path}`, {
				headers,
				signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			throw githubUnavailable(error);
		}
		if (!response.ok) {
			throw mapErrorResponse(response, endpoint, now());
		}

		let body: unknown;
		try {
			body = await response.json();
		} catch (error) {
			throw githubUnavailable(error);
		}

		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			throw githubUnavailable(parsed.error);
		}
		return parsed.data;
	};

	const fetchProfile = (path: string): Promise<GithubProfile> =>
		request(path, "core", githubUserResponseSchema);

	return {
		getUserById: (id) => fetchProfile(`/user/${encodeURIComponent(id)}`),

		getUserByLogin: async (login, { cache: useCache = true } = {}) => {
			const path = `/users/${encodeURIComponent(login)}`;
			if (!useCache) {
				return await fetchProfile(path);
			}
			const key = `user:${login.toLowerCase()}`;
			const cached = cache.get(key);
			if (cached?.kind === "user") {
				return cached.data;
			}
			const profile = await fetchProfile(path);
			cache.set(key, { data: profile, kind: "user" });
			return profile;
		},

		searchUsers: async ({ page, q }) => {
			const key = `search:${page}:${q.toLowerCase()}`;
			const cached = cache.get(key);
			if (cached?.kind === "search") {
				return cached.data;
			}
			const params = new URLSearchParams({
				page: String(page),
				per_page: String(SEARCH_PER_PAGE),
			});
			const query = encodeURIComponent(`${q}${SEARCH_TYPE_QUALIFIER}`);
			const response = await request(
				`/search/users?q=${query}&${params.toString()}`,
				"search",
				githubSearchResponseSchema
			);
			const result: GithubSearchResult = {
				items: response.items,
				total: response.total_count,
			};
			cache.set(key, { data: result, kind: "search" });
			return result;
		},
	};
};
