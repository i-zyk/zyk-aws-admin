import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

type IncrementalCache = Pick<
	typeof staticAssetsIncrementalCache,
	"delete" | "get" | "name" | "set"
>;

/**
 * 页面都依赖登录会话、按请求动态渲染，不用 ISR：预渲染产物随静态资源一起发布，无需 R2。
 * 静态资源缓存是只读的，原实现的 set/delete 每次请求都会打 ERROR 日志（Next 16 会写 route-cache），
 * 这里改成静默忽略写入，读取仍走原实现。
 */
const readOnlyStaticAssetsCache: IncrementalCache = {
	delete: async () => undefined,
	get: (key, cacheType) => staticAssetsIncrementalCache.get(key, cacheType),
	name: staticAssetsIncrementalCache.name,
	set: async () => undefined,
};

export default defineCloudflareConfig({
	incrementalCache: readOnlyStaticAssetsCache,
});
