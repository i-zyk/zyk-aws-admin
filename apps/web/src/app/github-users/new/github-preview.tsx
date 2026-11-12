"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { githubUsernameSchema } from "@zyk-aws-admin/api/github/schemas";
import type { AppRouter } from "@zyk-aws-admin/api/routers/index";
import { Alert, AlertDescription } from "@zyk-aws-admin/ui/components/alert";
import { Badge } from "@zyk-aws-admin/ui/components/badge";
import { Button, buttonVariants } from "@zyk-aws-admin/ui/components/button";
import { Skeleton } from "@zyk-aws-admin/ui/components/skeleton";
import type { Route } from "next";
import Link from "next/link";
import { useCallback } from "react";
import { toast } from "sonner";

import { GithubProfileCard } from "@/components/github-users/github-profile-card";
import { getAppCode, getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

const LOOKUP_STALE_TIME_MS = 60_000;
type LookupResult = inferRouterOutputs<AppRouter>["githubUser"]["lookup"];

/**
 * 「加入数据库」（R04）：只提交用户名，服务端重新拉取 GitHub 资料后保存。
 * 成功后让 githubUser 下所有查询（lookup/search/list/tags）失效；已在名单中（CONFLICT）时
 * 让 lookup 失效，卡片切换为「已在名单中」。失效的查询重新拉取完成前按钮保持禁用，防止重复提交。
 */
function AddToListButton({ username }: { username: string }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { isPending, mutate } = useMutation(
		trpc.githubUser.create.mutationOptions({
			onError: async (error) => {
				toast.error(getAppErrorMessage(error));
				if (getAppCode(error) === "GITHUB_USER_ALREADY_SAVED") {
					await queryClient.invalidateQueries(
						trpc.githubUser.lookup.pathFilter()
					);
				}
			},
			onSuccess: async () => {
				toast.success("已添加");
				await queryClient.invalidateQueries(trpc.githubUser.pathFilter());
			},
		})
	);

	const handleClick = useCallback(() => {
		mutate({ username });
	}, [mutate, username]);

	return (
		<Button disabled={isPending} onClick={handleClick} type="button">
			{isPending ? "正在加入…" : "加入数据库"}
		</Button>
	);
}

/** 卡片操作区：已在名单中显示「已在名单中」+「查看」，否则是「加入数据库」 */
function PreviewActions({
	login,
	savedId,
}: {
	login: string;
	savedId: LookupResult["savedId"];
}) {
	if (savedId !== null) {
		return (
			<>
				<Badge variant="secondary">已在名单中</Badge>
				<Link
					className={buttonVariants({ variant: "outline" })}
					href={`/github-users/${savedId}`}
				>
					查看
				</Link>
			</>
		);
	}
	return <AddToListButton username={login} />;
}

function PreviewBody({
	data,
	error,
	invalidMessage,
}: {
	data: LookupResult | undefined;
	error: unknown;
	invalidMessage: string | null;
}) {
	if (invalidMessage !== null) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{invalidMessage}</AlertDescription>
			</Alert>
		);
	}
	if (error) {
		return (
			<Alert variant="destructive">
				<AlertDescription>{getAppErrorMessage(error)}</AlertDescription>
			</Alert>
		);
	}
	if (!data) {
		return (
			<div aria-label="正在加载 GitHub 用户资料" role="status">
				<Skeleton className="h-80 w-full" />
			</div>
		);
	}
	return (
		<GithubProfileCard profile={data}>
			<PreviewActions login={data.login} savedId={data.savedId} />
		</GithubProfileCard>
	);
}

/**
 * 添加前预览 GitHub 用户资料（R03）：先用共享规则校验用户名，不合法时不发请求；
 * 合法时查询 githubUser.lookup，只读不写数据库。
 */
export function GithubPreview({
	username,
	backHref,
}: {
	username: string;
	backHref: Route;
}) {
	const trpc = useTRPC();
	const parsed = githubUsernameSchema.safeParse(username);
	const query = useQuery(
		trpc.githubUser.lookup.queryOptions(
			{ username: parsed.success ? parsed.data : "" },
			{
				enabled: parsed.success,
				meta: { skipGlobalErrorToast: true },
				refetchOnWindowFocus: false,
				retry: false,
				staleTime: LOOKUP_STALE_TIME_MS,
			}
		)
	);
	const invalidMessage = parsed.success
		? null
		: (parsed.error.issues[0]?.message ?? "用户名格式不正确");

	return (
		<section
			aria-busy={query.isFetching}
			aria-label="GitHub 用户资料预览"
			className="mt-6 flex flex-col gap-4"
		>
			<Link
				className="self-start text-sm underline underline-offset-4"
				href={backHref}
			>
				返回搜索结果
			</Link>
			<PreviewBody
				data={query.data}
				error={query.error}
				invalidMessage={invalidMessage}
			/>
		</section>
	);
}
