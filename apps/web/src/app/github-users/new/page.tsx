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
		<div className="mx-auto max-w-3xl px-5 py-10 sm:px-9">
			<p className="mb-2 text-[10px] text-muted-foreground tracking-[0.2em]">
				DISCOVER DEVELOPERS
			</p>
			<h1 className="font-semibold text-3xl tracking-tight">
				发现下一位，值得关注的人<span className="text-primary">。</span>
			</h1>
			<p className="mt-3 mb-8 text-muted-foreground text-sm leading-7">
				从 GitHub 搜索开发者，查看资料并加入你的专属名单。
			</p>
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
