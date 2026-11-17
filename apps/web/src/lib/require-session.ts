import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authClient } from "@/lib/auth-client";
import { type BackendEnv, forwardToBackend } from "@/lib/backend-proxy";

/**
 * 线上（Cloudflare Worker）直接签名调用后端，不请求自己的域名绕一圈；
 * 本地 `next dev` 没有 Cloudflare 上下文，返回 undefined，沿用默认 fetch 直连 NEXT_PUBLIC_SERVER_URL。
 */
function getBackendFetch(): typeof fetch | undefined {
	let env: BackendEnv;
	try {
		env = getCloudflareContext().env as BackendEnv;
	} catch {
		return;
	}
	return (input, init) => forwardToBackend(new Request(input, init), env);
}

// 只在本次服务端渲染内复用，页面导航时重新检查，避免共享布局复用旧会话。
export const requireSession = cache(async () => {
	const session = await authClient.getSession({
		fetchOptions: {
			cache: "no-store",
			customFetchImpl: getBackendFetch(),
			// 带上浏览器的请求头：Cookie 用来识别会话，CF-Connecting-IP 由转发函数写成 x-client-ip
			headers: await headers(),
			throw: true,
		},
	});

	if (!session?.user) {
		redirect("/login");
	}

	return session;
});
