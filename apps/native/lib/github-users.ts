import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zyk-aws-admin/api/routers/index";

import { queryClient, trpc } from "@/utils/trpc";

export type GithubOutputs = inferRouterOutputs<AppRouter>["githubUser"];
export type GithubRecord = GithubOutputs["list"]["items"][number];
export type GithubProfile = GithubOutputs["lookup"];
export type GithubSearchItem = GithubOutputs["search"]["items"][number];

export const compactNumber = new Intl.NumberFormat("zh-CN", {
	maximumFractionDigits: 1,
	notation: "compact",
});
const dateFormat = new Intl.DateTimeFormat("zh-CN", {
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	month: "2-digit",
	year: "numeric",
});
export function formatDate(value: string) {
	return dateFormat.format(new Date(value));
}

export async function refreshGithubUsers() {
	await queryClient.invalidateQueries(trpc.githubUser.pathFilter());
}

export async function refreshAfterDelete() {
	await queryClient.invalidateQueries({
		...trpc.githubUser.pathFilter(),
		refetchType: "none",
	});
	await Promise.all([
		queryClient.invalidateQueries(trpc.githubUser.list.pathFilter()),
		queryClient.invalidateQueries(trpc.githubUser.tags.pathFilter()),
		queryClient.invalidateQueries(trpc.githubUser.search.pathFilter()),
		queryClient.invalidateQueries(trpc.githubUser.lookup.pathFilter()),
	]);
}
