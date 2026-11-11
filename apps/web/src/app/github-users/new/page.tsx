import { requireSession } from "@/lib/require-session";

// 占位页：R02、R03 替换为 GitHub 用户搜索和资料预览，保留页面级会话校验。
export default async function NewGithubUserPage() {
	await requireSession();

	return (
		<div className="container mx-auto max-w-3xl px-4 py-6">
			<h1 className="font-bold text-2xl">添加 GitHub 用户</h1>
			<p className="mt-2 text-muted-foreground">搜索功能开发中。</p>
		</div>
	);
}
