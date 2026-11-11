import { requireSession } from "@/lib/require-session";

import { GithubPreview } from "./github-preview";
import { GithubSearch } from "./github-search";
import { parseSearchPage, searchHref } from "./search-params";

export default async function NewGithubUserPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const params = await searchParams;
	const q = typeof params.q === "string" ? params.q : "";
	const page = parseSearchPage(params.page);
	const username = typeof params.username === "string" ? params.username : "";

	return (
		<div className="container mx-auto max-w-3xl px-4 py-6">
			<h1 className="font-bold text-2xl">添加 GitHub 用户</h1>
			{username ? (
				<GithubPreview
					backHref={q ? searchHref(q, page) : "/github-users/new"}
					key={username}
					username={username}
				/>
			) : (
				<GithubSearch key={`${q}:${page}`} page={page} q={q} />
			)}
		</div>
	);
}
