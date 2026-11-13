// 内存 TTL 缓存：条目超过 ttlMs 视为过期（读取时删除）；
// 超过 maxEntries 时按 Map 的插入顺序淘汰最早写入的条目。
// 只适用于单实例部署，多实例需要换成共享缓存（design.md「风险与取舍」第 5 条）。

export interface TtlCacheOptions {
	/** 最多保留的条目数，超出时淘汰最早写入的 */
	maxEntries: number;
	/** 当前时间（毫秒），测试时注入 */
	now?: () => number;
	/** 条目有效期（毫秒） */
	ttlMs: number;
}

export interface TtlCache<V> {
	clear: () => void;
	/** 未命中或已过期时返回 undefined（过期条目会被删除） */
	get: (key: string) => V | undefined;
	/** 写入后该条目视为最新，重新计算有效期 */
	set: (key: string, value: V) => void;
	readonly size: number;
}

interface CacheEntry<V> {
	expiresAt: number;
	value: V;
}

export const createTtlCache = <V>({
	maxEntries,
	now = Date.now,
	ttlMs,
}: TtlCacheOptions): TtlCache<V> => {
	const entries = new Map<string, CacheEntry<V>>();

	return {
		clear() {
			entries.clear();
		},
		get(key) {
			const entry = entries.get(key);
			if (!entry) {
				return;
			}
			if (entry.expiresAt <= now()) {
				entries.delete(key);
				return;
			}
			return entry.value;
		},
		set(key, value) {
			// 先删再写，让重复写入的 key 移到插入顺序的末尾
			entries.delete(key);
			entries.set(key, { expiresAt: now() + ttlMs, value });
			for (const oldestKey of entries.keys()) {
				if (entries.size <= maxEntries) {
					break;
				}
				entries.delete(oldestKey);
			}
		},
		get size() {
			return entries.size;
		},
	};
};
