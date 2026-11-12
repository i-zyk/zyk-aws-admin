"use client";

import { Button } from "@zyk-aws-admin/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@zyk-aws-admin/ui/components/dialog";
import { useCallback, useState } from "react";

import {
	type EditableGithubUser,
	EditGithubUserForm,
} from "./edit-github-user-form";

/**
 * 「编辑」按钮 + 编辑备注和标签的对话框（R07），详情页后台信息区块和列表操作列共用。
 * 对话框关闭时表单卸载，每次打开都从记录当前的备注和标签开始编辑。
 */
export function EditGithubUserDialog({
	record,
}: {
	record: EditableGithubUser;
}) {
	const [open, setOpen] = useState(false);
	const handleOpenChange = useCallback((nextOpen: boolean) => {
		setOpen(nextOpen);
	}, []);
	const handleClose = useCallback(() => {
		setOpen(false);
	}, []);

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogTrigger
				render={<Button size="sm" type="button" variant="outline" />}
			>
				编辑<span className="sr-only">备注和标签：{record.login}</span>
			</DialogTrigger>
			{/* 多行备注加多个长标签时表单可能高于视口：按视口限制高度并允许纵向滚动，保证底部按钮可达 */}
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>编辑备注和标签</DialogTitle>
					<DialogDescription className="break-all">
						{record.login}：GitHub 资料只读，只能通过同步更新
					</DialogDescription>
				</DialogHeader>
				<EditGithubUserForm onClose={handleClose} record={record} />
			</DialogContent>
		</Dialog>
	);
}
