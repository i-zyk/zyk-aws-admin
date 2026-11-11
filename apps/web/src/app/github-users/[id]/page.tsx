import { requireSession } from "@/lib/require-session";

// 占位页：R06 替换为已保存的 GitHub 用户详情，保留页面级会话校验。
export default async function GithubUserDetailPage() {
	await requireSession();

	return (
		<div className="container mx-auto max-w-3xl px-4 py-6">
			<h1 className="font-bold text-2xl">GitHub 用户详情</h1>
			<p className="mt-2 text-muted-foreground">详情功能开发中。</p>
		</div>
	);
}
