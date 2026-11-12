"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@zyk-aws-admin/ui/components/button";
import { useCallback } from "react";
import { toast } from "sonner";

import { getAppCode, getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

type ButtonProps = Parameters<typeof Button>[0];

/**
 * 「同步」（R08）：按 githubId 从 GitHub 重新拉取资料，列表行和详情页共用。
 * 成功提示「已同步」并让 byId、list 失效；失败按 appCode 提示（GitHub 404 用同步场景文案）。
 * 记录已被删除（RECORD_NOT_FOUND）时也让查询失效，页面随之显示「记录不存在」或刷新列表。
 * 请求进行中和失效查询重新拉取完成前按钮保持禁用，避免连点浪费 GitHub 额度。
 */
export function SyncGithubUserButton({
	id,
	login,
	size,
	variant = "outline",
}: {
	id: number;
	/** 给读屏用户区分是哪一行的按钮 */
	login?: string;
	size?: ButtonProps["size"];
	variant?: ButtonProps["variant"];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const invalidateRecordQueries = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries(trpc.githubUser.byId.queryFilter({ id })),
			queryClient.invalidateQueries(trpc.githubUser.list.pathFilter()),
		]);
	}, [id, queryClient, trpc]);

	const { isPending, mutate } = useMutation(
		trpc.githubUser.sync.mutationOptions({
			onError: async (error) => {
				toast.error(getAppErrorMessage(error, "sync"));
				if (getAppCode(error) === "RECORD_NOT_FOUND") {
					await invalidateRecordQueries();
				}
			},
			onSuccess: async () => {
				toast.success("已同步");
				await invalidateRecordQueries();
			},
		})
	);

	const handleClick = useCallback(() => {
		mutate({ id });
	}, [id, mutate]);

	return (
		<Button
			aria-busy={isPending}
			disabled={isPending}
			onClick={handleClick}
			size={size}
			type="button"
			variant={variant}
		>
			{isPending ? "正在同步…" : "同步"}
			{login ? <span className="sr-only">：{login}</span> : null}
		</Button>
	);
}
