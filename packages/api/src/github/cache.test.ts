import { describe, expect, it, vi } from "vitest";

import { createTtlCache } from "./cache";
import {
	createGithubClient,
	GITHUB_CACHE_MAX_ENTRIES,
	GITHUB_CACHE_TTL_MS,
	type GithubClient,
} from "./client";

const NOW = Date.UTC(2026, 10, 10, 8, 0, 0);
const MS_PER_SECOND = 1000;
const JUST_BEFORE_EXPIRY_MS = 59 * MS_PER_SECOND;
const AFTER_EXPIRY_MS = 61 * MS_PER_SECOND;

const searchBody = {
	incomplete_results: false,
	items: [
		{
			avatar_url: "https://avatars.githubusercontent.com/u/1",
			html_url: "https://github.com/octocat",
			id: 1,
			login: "octocat",
			type: "User",
		},
	],
	total_count: 1,
};

const userBody = {
	avatar_url: "https://avatars.githubusercontent.com/u/1",
	bio: null,
	blog: "https://github.blog",
	company: "@github",
	created_at: "2011-01-25T18:44:36Z",
	email: null,
	followers: 100,
	following: 9,
	html_url: "https://github.com/octocat",
	id: 1,
	location: "San Francisco",
	login: "octocat",
	name: "The Octocat",
	public_gists: 8,
	public_repos: 8,
	site_admin: false,
	updated_at: "2026-01-01T00:00:00Z",
};

const jsonResponse = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), {
		headers: { "content-type": "application/json" },
		status,
	});

/** 按请求路径返回搜索或资料的成功响应 */
const respondByPath = (input: string | URL | Request): Response => {
	const url = new URL(String(input));
	return jsonResponse(url.pathname === "/search/users" ? searchBody : userBody);
};

/** 可控时钟 + 模拟 fetch 的客户端；handler 默认按路径返回成功响应 */
const setup = (
	handler: (input: string | URL | Request) => Response = respondByPath
) => {
	const clock = { current: NOW };
	const fakeFetch = vi.fn<typeof fetch>(async (input) => await handler(input));
	const client = createGithubClient({
		fetch: fakeFetch,
		now: () => clock.current,
	});
	const advance = (ms: number) => {
		clock.current += ms;
	};
	return { advance, client, fakeFetch };
};

/** 依次搜索 user0、user1…，每条搜索结果按顺序写入缓存 */
const searchInOrder = async (client: GithubClient, count: number) => {
	for (let index = 0; index < count; index += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: 淘汰顺序取决于写入顺序，必须逐条串行写入
		await client.searchUsers({ page: 1, q: `user${index}` });
	}
};

describe("createTtlCache", () => {
	const createClockedCache = (maxEntries = 3, ttlMs = 1000) => {
		const clock = { current: NOW };
		const cache = createTtlCache<string>({
			maxEntries,
			now: () => clock.current,
			ttlMs,
		});
		return { cache, clock };
	};

	it("有效期内命中，到期后返回 undefined 并删除条目", () => {
		const { cache, clock } = createClockedCache();
		cache.set("a", "A");

		clock.current += 999;
		expect(cache.get("a")).toBe("A");

		clock.current += 1;
		expect(cache.get("a")).toBeUndefined();
		expect(cache.size).toBe(0);
	});

	it("超过 maxEntries 时淘汰最早写入的条目", () => {
		const { cache } = createClockedCache();
		cache.set("a", "A");
		cache.set("b", "B");
		cache.set("c", "C");
		cache.set("d", "D");

		expect(cache.size).toBe(3);
		expect(cache.get("a")).toBeUndefined();
		expect(cache.get("b")).toBe("B");
		expect(cache.get("d")).toBe("D");
	});

	it("重复写入同一个 key 会移到最新位置并重新计算有效期", () => {
		const { cache, clock } = createClockedCache();
		cache.set("a", "A");
		cache.set("b", "B");
		cache.set("c", "C");

		clock.current += 500;
		cache.set("a", "A2");
		cache.set("d", "D");

		// 最早的变成 b，a 因为重新写入而保留
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("a")).toBe("A2");

		// a 从第二次写入起算有效期
		clock.current += 600;
		expect(cache.get("a")).toBe("A2");
		expect(cache.get("c")).toBeUndefined();
	});

	it("clear 清空所有条目", () => {
		const { cache } = createClockedCache();
		cache.set("a", "A");
		cache.set("b", "B");

		cache.clear();

		expect(cache.size).toBe(0);
		expect(cache.get("a")).toBeUndefined();
	});
});

describe("GitHub 客户端缓存", () => {
	it("缓存配置为 60 秒、最多 500 条", () => {
		expect(GITHUB_CACHE_TTL_MS).toBe(60_000);
		expect(GITHUB_CACHE_MAX_ENTRIES).toBe(500);
	});

	it("同一关键字不同大小写，第二次搜索不发请求", async () => {
		const { client, fakeFetch } = setup();

		const first = await client.searchUsers({ page: 1, q: "Octo" });
		const second = await client.searchUsers({ page: 1, q: "oCTO" });

		expect(fakeFetch).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
	});

	it("同一关键字不同页码分别缓存", async () => {
		const { client, fakeFetch } = setup();

		await client.searchUsers({ page: 1, q: "octo" });
		await client.searchUsers({ page: 2, q: "octo" });
		await client.searchUsers({ page: 2, q: "OCTO" });

		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it("同一用户名不同大小写，第二次资料查询不发请求", async () => {
		const { client, fakeFetch } = setup();

		const first = await client.getUserByLogin("OctoCat");
		const second = await client.getUserByLogin("octocat");

		expect(fakeFetch).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
	});

	it("59 秒内命中缓存，61 秒后重新请求", async () => {
		const { advance, client, fakeFetch } = setup();

		await client.searchUsers({ page: 1, q: "octo" });
		await client.getUserByLogin("octocat");

		advance(JUST_BEFORE_EXPIRY_MS);
		await client.searchUsers({ page: 1, q: "octo" });
		await client.getUserByLogin("octocat");
		expect(fakeFetch).toHaveBeenCalledTimes(2);

		advance(AFTER_EXPIRY_MS - JUST_BEFORE_EXPIRY_MS);
		await client.searchUsers({ page: 1, q: "octo" });
		await client.getUserByLogin("octocat");
		expect(fakeFetch).toHaveBeenCalledTimes(4);
	});

	it("第 501 条写入后最早的条目被淘汰，其余条目仍命中", async () => {
		const { client, fakeFetch } = setup();

		await searchInOrder(client, GITHUB_CACHE_MAX_ENTRIES + 1);
		expect(fakeFetch).toHaveBeenCalledTimes(GITHUB_CACHE_MAX_ENTRIES + 1);

		// 第 2 条和第 501 条还在缓存里
		await client.searchUsers({ page: 1, q: "user1" });
		await client.searchUsers({ page: 1, q: `user${GITHUB_CACHE_MAX_ENTRIES}` });
		expect(fakeFetch).toHaveBeenCalledTimes(GITHUB_CACHE_MAX_ENTRIES + 1);

		// 第 1 条已被淘汰，重新请求
		await client.searchUsers({ page: 1, q: "user0" });
		expect(fakeFetch).toHaveBeenCalledTimes(GITHUB_CACHE_MAX_ENTRIES + 2);
	});

	it("搜索和资料查询共用 500 条上限", async () => {
		const { client, fakeFetch } = setup();

		await client.getUserByLogin("octocat");
		await searchInOrder(client, GITHUB_CACHE_MAX_ENTRIES);
		const callsAfterFill = fakeFetch.mock.calls.length;

		// 资料条目最早写入，已被第 500 条搜索挤掉
		await client.getUserByLogin("octocat");
		expect(fakeFetch).toHaveBeenCalledTimes(callsAfterFill + 1);
	});

	it("getUserById 每次都发请求", async () => {
		const { client, fakeFetch } = setup();

		await client.getUserById(1);
		await client.getUserById(1);

		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it("getUserByLogin(…, { cache: false }) 每次都发请求，也不写缓存", async () => {
		const { client, fakeFetch } = setup();

		await client.getUserByLogin("octocat", { cache: false });
		await client.getUserByLogin("octocat", { cache: false });
		expect(fakeFetch).toHaveBeenCalledTimes(2);

		// 前两次没写缓存，默认调用仍要发请求
		await client.getUserByLogin("octocat");
		expect(fakeFetch).toHaveBeenCalledTimes(3);
	});

	it("getUserByLogin(…, { cache: false }) 不读已有缓存", async () => {
		const { client, fakeFetch } = setup();

		await client.getUserByLogin("octocat");
		await client.getUserByLogin("octocat", { cache: false });

		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it("getUserById 不写缓存，之后按用户名查询仍发请求", async () => {
		const { client, fakeFetch } = setup();

		await client.getUserById(1);
		await client.getUserByLogin("octocat");

		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it.each([
		{
			name: "404",
			response: () => jsonResponse({ message: "Not Found" }, 404),
		},
		{ name: "500", response: () => jsonResponse({ message: "Error" }, 500) },
		{ name: "字段不符", response: () => jsonResponse({ items: [] }) },
	])("错误响应（$name）不进缓存", async ({ response }) => {
		let failNext = true;
		const { client, fakeFetch } = setup((input) => {
			if (failNext) {
				failNext = false;
				return response();
			}
			return respondByPath(input);
		});

		await expect(client.searchUsers({ page: 1, q: "octo" })).rejects.toThrow();
		await client.searchUsers({ page: 1, q: "octo" });
		await client.searchUsers({ page: 1, q: "octo" });

		// 第 1 次失败没写缓存，第 2 次重新请求成功后写入，第 3 次命中
		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it("资料查询的错误响应不进缓存", async () => {
		let failNext = true;
		const { client, fakeFetch } = setup((input) => {
			if (failNext) {
				failNext = false;
				return jsonResponse({ message: "Not Found" }, 404);
			}
			return respondByPath(input);
		});

		await expect(client.getUserByLogin("octocat")).rejects.toThrow();
		await client.getUserByLogin("octocat");
		await client.getUserByLogin("octocat");

		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it("网络错误不进缓存", async () => {
		let failNext = true;
		const { client, fakeFetch } = setup((input) => {
			if (failNext) {
				failNext = false;
				throw new TypeError("fetch failed");
			}
			return respondByPath(input);
		});

		await expect(client.getUserByLogin("octocat")).rejects.toThrow();
		await client.getUserByLogin("octocat");
		await client.getUserByLogin("octocat");

		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});
});
