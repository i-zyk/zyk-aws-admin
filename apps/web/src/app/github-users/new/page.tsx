import Link from "next/link";

import { requireSession } from "@/lib/require-session";

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
				<section className="mt-6 flex flex-col gap-4">
					<h2 className="font-semibold text-lg">{username}</h2>
					<p className="text-muted-foreground">资料预览功能开发中。</p>
					<Link
						className="underline underline-offset-4"
						href={searchHref(q, page)}
					>
						返回搜索结果
					</Link>
				</section>
			) : (
				<GithubSearch key={`${q}:${page}`} page={page} q={q} />
			)}
		</div>
	);
}
