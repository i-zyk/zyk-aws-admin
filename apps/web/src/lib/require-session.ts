import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { authClient } from "@/lib/auth-client";

// 只在本次服务端渲染内复用，页面导航时重新检查，避免共享布局复用旧会话。
export const requireSession = cache(async () => {
	const session = await authClient.getSession({
		fetchOptions: {
			cache: "no-store",
			headers: await headers(),
			throw: true,
		},
	});

	if (!session?.user) {
		redirect("/login");
	}

	return session;
});
