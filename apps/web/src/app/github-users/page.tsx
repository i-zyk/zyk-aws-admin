import { buttonVariants } from "@zyk-aws-admin/ui/components/button";
import { Plus } from "lucide-react";
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
		<div className="mx-auto flex max-w-[1600px] flex-col gap-7 px-5 py-8 sm:px-9 sm:py-10">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<p className="mb-2 text-[10px] text-muted-foreground tracking-[0.2em]">
						YOUR DEVELOPER NETWORK
					</p>
					<h1 className="font-semibold text-3xl tracking-tight">
						用户名单<span className="text-primary">.</span>
					</h1>
					<p className="mt-3 text-muted-foreground text-sm">
						把值得关注的开发者，整理在一个地方。
					</p>
				</div>
				<Link
					className={buttonVariants({ size: "lg" })}
					href="/github-users/new"
				>
					<Plus data-icon="inline-start" />
					添加用户
				</Link>
			</div>
			<GithubUserList params={params} />
		</div>
	);
}
