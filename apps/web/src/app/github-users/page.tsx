import { buttonVariants } from "@zyk-aws-admin/ui/components/button";
import Link from "next/link";

import { requireSession } from "@/lib/require-session";

import { GithubUserList } from "./github-user-list";
import { parseListParams } from "./list-params";

export default async function GithubUsersPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	await requireSession();
	const params = parseListParams(await searchParams);

	return (
		<div className="container mx-auto max-w-7xl px-4 py-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="font-bold text-2xl">GitHub 用户</h1>
				<Link className={buttonVariants()} href="/github-users/new">
					添加用户
				</Link>
			</div>
			<GithubUserList params={params} />
		</div>
	);
}
