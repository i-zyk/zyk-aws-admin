"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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

import { getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

/**
 * 批量删除名单记录（R10）：点「批量删除（N）」先弹确认框，只有确认后才发 githubUser.deleteMany；
 * 取消不发请求，进行中不能关闭、按钮禁用。
 *
 * 打开确认框时记下当时勾选的 ID，确认框里的数量和实际提交的 ID 都以它为准，
 * 打开期间父组件的勾选变化（例如列表刷新）不影响本次删除。
 * 成功后先调用 onDeleted（父组件清空勾选，并在列表刷新后按新的总数纠正页码），再让 githubUser 下的查询
 * （list/tags/byId/lookup/search）失效，等列表刷新完成再关闭确认框。
 *
 * 没有勾选时不显示按钮，但确认框一直挂载：删除成功后勾选先被清空，确认框仍能正常走完关闭流程。
 */
export function BulkDeleteGithubUsersDialog({
	ids,
	onDeleted,
}: {
	ids: readonly number[];
	onDeleted: (count: number) => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [targetIds, setTargetIds] = useState<readonly number[]>([]);
	// 同一帧内连点两次时 disabled 还没渲染出来，用 ref 保证只发一次请求
	const submittingRef = useRef<boolean>(false);

	const { isPending, mutate } = useMutation(
		trpc.githubUser.deleteMany.mutationOptions({
			onError: (error) => {
				// 网络、未登录等错误保留确认框，可以再试一次
				toast.error(getAppErrorMessage(error));
			},
			onSettled: () => {
				submittingRef.current = false;
			},
			onSuccess: async ({ count: deletedCount }) => {
				toast.success(`已删除 ${deletedCount} 条`);
				onDeleted(deletedCount);
				await queryClient.invalidateQueries(trpc.githubUser.pathFilter());
				setOpen(false);
			},
		})
	);

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (isPending || nextOpen === open) {
				return;
			}
			if (nextOpen) {
				setTargetIds(ids);
			}
			setOpen(nextOpen);
		},
		[ids, isPending, open]
	);
	const handleConfirm = useCallback(() => {
		if (submittingRef.current || targetIds.length === 0) {
			return;
		}
		submittingRef.current = true;
		mutate({ ids: [...targetIds] });
	}, [mutate, targetIds]);

	return (
		<AlertDialog onOpenChange={handleOpenChange} open={open}>
			{ids.length > 0 ? (
				<AlertDialogTrigger
					render={<Button type="button" variant="destructive" />}
				>
					批量删除（{ids.length}）
				</AlertDialogTrigger>
			) : null}
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						删除选中的 {targetIds.length} 条记录？
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
