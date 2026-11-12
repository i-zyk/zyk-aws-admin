import { requireSession } from "@/lib/require-session";

import { GithubUserDetail } from "./github-user-detail";
import { parseGithubUserIdParam } from "./id-param";
import { RecordNotFound } from "./record-not-found";

export default async function GithubUserDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await requireSession();
	const id = parseGithubUserIdParam((await params).id);

	return (
		<div className="container mx-auto max-w-3xl px-4 py-6">
			{/* ID 不合法直接显示「记录不存在」，不发请求（R06-AC4）；key 让切换记录时重置查询状态 */}
			{id === null ? <RecordNotFound /> : <GithubUserDetail id={id} key={id} />}
		</div>
	);
}
