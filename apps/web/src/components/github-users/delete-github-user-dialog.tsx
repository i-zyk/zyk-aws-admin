"use client";

import { hashKey, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@zyk-aws-admin/ui/components/alert-dialog";
import { Button } from "@zyk-aws-admin/ui/components/button";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { getAppCode, getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

type TriggerSize = "default" | "sm" | "xs";

/**
 * 删除名单记录（R09）：点「删除」先弹确认框，只有确认后才发 githubUser.delete；进行中不能关闭、按钮禁用。
 *
 * 成功或记录已不存在（RECORD_NOT_FOUND）时，先调用 onDeleted（详情页回到列表、列表删空当前页时退一页），
 * 再让 githubUser 下的查询失效（list/tags/lookup/search 等），等列表刷新完成再关闭确认框。
 * 被删记录自己的 byId 只标记过期、不立即重新请求，避免详情页跳走前闪一下「记录不存在」。
 */
export function DeleteGithubUserDialog({
	id,
	login,
	onDeleted,
	size = "default",
}: {
	id: number;
	login: string;
	onDeleted?: () => void;
	size?: TriggerSize;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	// 同一帧内连点两次时 disabled 还没渲染出来，用 ref 保证只发一次请求（R09-AC6）
	const submittingRef = useRef<boolean>(false);

	const refreshAfterDelete = useCallback(async () => {
		onDeleted?.();
		const deletedRecordKey = trpc.githubUser.byId.queryKey({ id });
		const deletedRecordHash = hashKey(deletedRecordKey);
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: deletedRecordKey,
				refetchType: "none",
			}),
			queryClient.invalidateQueries({
				...trpc.githubUser.pathFilter(),
				predicate: (query) => query.queryHash !== deletedRecordHash,
			}),
		]);
		setOpen(false);
	}, [id, onDeleted, queryClient, trpc]);

	const { isPending, mutate } = useMutation(
		trpc.githubUser.delete.mutationOptions({
			onError: async (error) => {
				if (getAppCode(error) === "RECORD_NOT_FOUND") {
					toast.error("记录不存在");
					await refreshAfterDelete();
					return;
				}
				// 其他错误（网络、未登录等）保留确认框，可以再试一次
				toast.error(getAppErrorMessage(error));
			},
			onSettled: () => {
				submittingRef.current = false;
			},
			onSuccess: async () => {
				toast.success("已删除");
				await refreshAfterDelete();
			},
		})
	);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!(isPending || nextOpen === open)) {
				setOpen(nextOpen);
			}
		},
		[isPending, open]
	);
	const handleConfirm = useCallback(() => {
		if (submittingRef.current) {
			return;
		}
		submittingRef.current = true;
		mutate({ id });
	}, [id, mutate]);

	return (
		<AlertDialog onOpenChange={handleOpenChange} open={open}>
			<AlertDialogTrigger
				render={<Button size={size} type="button" variant="destructive" />}
			>
				删除<span className="sr-only">：{login}</span>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="break-all">
						删除 {login}？
					</AlertDialogTitle>
					<AlertDialogDescription>
						删除后无法恢复，备注和标签会一起删除
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
					<AlertDialogAction
						disabled={isPending}
						onClick={handleConfirm}
						type="button"
						variant="destructive"
					>
						{isPending ? "正在删除…" : "删除"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
