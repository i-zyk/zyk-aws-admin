/**
 * 自定义 Worker 入口（wrangler.jsonc 的 main）：admin.izyk.online 的统一入口。
 * - /api/auth/*、/trpc/*：签名后转发给 AWS 上的后端，不经过 Next.js；
 * - 其他路径：交给 OpenNext 生成的 Next.js 处理程序。
 * 写法见 https://opennext.js.org/cloudflare/howtos/custom-worker
 *
 * .open-next/worker.js 是 `opennextjs-cloudflare build` 的产物，Next.js 编译时还不存在，
 * 所以这个文件不在 tsconfig 里做类型检查（tsconfig.json 的 exclude）；转发逻辑在 src/lib/backend-proxy.ts，正常检查。
 */
import nextHandler from "./.open-next/worker.js";
import {
	type BackendEnv,
	forwardToBackend,
	isBackendPath,
} from "./src/lib/backend-proxy";

export default {
	fetch(request: Request, env: BackendEnv, ctx: unknown) {
		if (isBackendPath(new URL(request.url).pathname)) {
			return forwardToBackend(request, env);
		}
		return nextHandler.fetch(request, env, ctx);
	},
};
