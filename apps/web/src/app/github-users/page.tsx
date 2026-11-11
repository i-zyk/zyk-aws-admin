import { requireSession } from "@/lib/require-session";

// 占位页：R05 替换为 GitHub 用户名单列表，保留页面级会话校验。
export default async function GithubUsersPage() {
	await requireSession();

	return (
		<div className="container mx-auto max-w-3xl px-4 py-6">
			<h1 className="font-bold text-2xl">GitHub 用户</h1>
			<p className="mt-2 text-muted-foreground">名单功能开发中。</p>
		</div>
	);
}
