"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GithubUserRecordDto } from "@zyk-aws-admin/api/github/mapper";
import {
	REMARK_MAX_LENGTH,
	remarkTextSchema,
	TAG_MAX_LENGTH,
	TAGS_MAX_COUNT,
	tagsSchema,
} from "@zyk-aws-admin/api/github/schemas";
import { Badge } from "@zyk-aws-admin/ui/components/badge";
import { Button } from "@zyk-aws-admin/ui/components/button";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@zyk-aws-admin/ui/components/field";
import { Input } from "@zyk-aws-admin/ui/components/input";
import { Textarea } from "@zyk-aws-admin/ui/components/textarea";
import { XIcon } from "lucide-react";
import {
	type ChangeEvent,
	type FormEvent,
	type KeyboardEvent,
	useCallback,
	useState,
} from "react";
import { toast } from "sonner";

import { getAppCode, getAppErrorMessage } from "@/lib/app-error";
import { useTRPC } from "@/utils/trpc";

/** 编辑表单需要的记录字段：列表行和详情页的数据都满足 */
export type EditableGithubUser = Pick<
	GithubUserRecordDto,
	"id" | "login" | "remark" | "tags"
>;

type FieldErrors = ({ message?: string } | undefined)[];

/** 半角、全角逗号都作为标签分隔符 */
const TAG_SEPARATOR_PATTERN = /[,，]/;
const selectIsSubmitting = (state: { isSubmitting: boolean }): boolean =>
	state.isSubmitting;
const BAD_REQUEST_MESSAGE = "输入不符合要求，请检查后重试";

/** 把输入框里的文字按逗号拆开追加到标签末尾：去掉首尾空格、去空、去重（区分大小写） */
const appendTags = (tags: readonly string[], text: string): string[] => {
	const additions = text
		.split(TAG_SEPARATOR_PATTERN)
		.map((tag) => tag.trim())
		.filter((tag) => tag !== "");
	return Array.from(new Set([...tags, ...additions]));
};

const isBadRequest = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	"data" in error &&
	typeof error.data === "object" &&
	error.data !== null &&
	"code" in error.data &&
	error.data.code === "BAD_REQUEST";

/** 保存失败的提示：记录不存在等业务错误按 appCode；接口校验失败时不展示原始校验信息 */
const updateErrorMessage = (error: unknown): string => {
	if (getAppCode(error) === null && isBadRequest(error)) {
		return BAD_REQUEST_MESSAGE;
	}
	return getAppErrorMessage(error);
};

function RemarkInput({
	value,
	onValueChange,
	onBlur,
	errors,
}: {
	value: string;
	onValueChange: (value: string) => void;
	onBlur: () => void;
	errors: FieldErrors;
}) {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);
	const invalid = errors.length > 0;
	return (
		<Field data-invalid={invalid}>
			<FieldLabel htmlFor="edit-github-user-remark">备注</FieldLabel>
			<Textarea
				aria-describedby="edit-github-user-remark-count edit-github-user-remark-error"
				aria-invalid={invalid}
				className="max-h-60 min-h-24"
				id="edit-github-user-remark"
				name="remark"
				onBlur={onBlur}
				onChange={handleChange}
				placeholder="给这个用户写点备注"
				value={value}
			/>
			<FieldDescription
				className="tabular-nums"
				id="edit-github-user-remark-count"
			>
				{value.trim().length} / {REMARK_MAX_LENGTH} 字
			</FieldDescription>
			<FieldError errors={errors} id="edit-github-user-remark-error" />
		</Field>
	);
}

function TagChip({
	tag,
	onRemove,
}: {
	tag: string;
	onRemove: (tag: string) => void;
}) {
	const handleClick = useCallback(() => {
		onRemove(tag);
	}, [onRemove, tag]);
	const tooLong = tag.length > TAG_MAX_LENGTH;
	return (
		<li>
			<Badge
				aria-invalid={tooLong}
				className="h-6 pr-0.5"
				variant={tooLong ? "destructive" : "secondary"}
			>
				{tag}
				<Button
					aria-label={`删除标签：${tag}`}
					className="size-5"
					onClick={handleClick}
					size="icon-xs"
					type="button"
					variant="ghost"
				>
					<XIcon />
				</Button>
			</Badge>
		</li>
	);
}

/**
 * 标签输入：回车或输入逗号（半角、全角）把文字添加为徽标，徽标上的 × 删除；
 * 输入框为空时按退格删除最后一个。超过 10 个、单个超过 20 字时由共享规则在下方提示。
 */
function TagsInput({
	tags,
	draft,
	onTagsChange,
	onDraftChange,
	onBlur,
	errors,
}: {
	tags: string[];
	draft: string;
	onTagsChange: (tags: string[]) => void;
	onDraftChange: (draft: string) => void;
	onBlur: () => void;
	errors: FieldErrors;
}) {
	const handleRemove = useCallback(
		(removed: string) => {
			onTagsChange(tags.filter((tag) => tag !== removed));
		},
		[onTagsChange, tags]
	);
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const parts = event.target.value.split(TAG_SEPARATOR_PATTERN);
			if (parts.length === 1) {
				onDraftChange(event.target.value);
				return;
			}
			// 输入或粘贴了逗号：逗号前的部分添加为标签，最后一个逗号之后的留在输入框
			const rest = parts.pop() ?? "";
			onTagsChange(appendTags(tags, parts.join(",")));
			onDraftChange(rest);
		},
		[onDraftChange, onTagsChange, tags]
	);
	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			// 输入法组字时的回车用于上屏，不添加标签
			if (event.nativeEvent.isComposing) {
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				if (draft.trim() !== "") {
					onTagsChange(appendTags(tags, draft));
				}
				onDraftChange("");
				return;
			}
			if (event.key === "Backspace" && draft === "" && tags.length > 0) {
				event.preventDefault();
				onTagsChange(tags.slice(0, -1));
			}
		},
		[draft, onDraftChange, onTagsChange, tags]
	);
	const invalid = errors.length > 0;
	return (
		<Field data-invalid={invalid}>
			<FieldLabel htmlFor="edit-github-user-tags">标签</FieldLabel>
			{tags.length > 0 ? (
				<ul aria-label="已添加的标签" className="flex flex-wrap gap-1">
					{tags.map((tag) => (
						<TagChip key={tag} onRemove={handleRemove} tag={tag} />
					))}
				</ul>
			) : null}
			<Input
				aria-describedby="edit-github-user-tags-hint edit-github-user-tags-error"
				aria-invalid={invalid}
				autoComplete="off"
				enterKeyHint="enter"
				id="edit-github-user-tags"
				name="tags"
				onBlur={onBlur}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder="输入标签后按回车或逗号添加"
				value={draft}
			/>
			<FieldDescription
				className="tabular-nums"
				id="edit-github-user-tags-hint"
			>
				已添加 {tags.length} / {TAGS_MAX_COUNT} 个，每个最多 {TAG_MAX_LENGTH} 字
			</FieldDescription>
			<FieldError errors={errors} id="edit-github-user-tags-error" />
		</Field>
	);
}

/**
 * 修改备注和标签（R07）：用和接口相同的共享 Zod 规则校验，不通过时就地提示。
 * 保存成功后提示「已保存」，让 byId、list、tags 查询失效；记录不存在时提示「记录不存在」并刷新数据。
 * GitHub 字段不在表单里，只能通过同步更新。
 */
export function EditGithubUserForm({
	record,
	onClose,
}: {
	record: EditableGithubUser;
	/** 取消、保存成功、记录不存在时调用，由外层关闭对话框 */
	onClose: () => void;
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const [tagDraft, setTagDraft] = useState("");

	const invalidateRecordQueries = useCallback(
		() =>
			Promise.all([
				queryClient.invalidateQueries(trpc.githubUser.byId.pathFilter()),
				queryClient.invalidateQueries(trpc.githubUser.list.pathFilter()),
				queryClient.invalidateQueries(trpc.githubUser.tags.pathFilter()),
			]),
		[queryClient, trpc]
	);

	const { mutateAsync } = useMutation(
		trpc.githubUser.update.mutationOptions({
			onError: async (error) => {
				toast.error(updateErrorMessage(error));
				if (getAppCode(error) === "RECORD_NOT_FOUND") {
					onClose();
					await invalidateRecordQueries();
				}
			},
			onSuccess: async () => {
				toast.success("已保存");
				onClose();
				await invalidateRecordQueries();
			},
		})
	);

	const form = useForm({
		defaultValues: { remark: record.remark ?? "", tags: record.tags },
		onSubmit: async ({ value }) => {
			try {
				await mutateAsync({
					id: record.id,
					remark: remarkTextSchema.parse(value.remark),
					tags: tagsSchema.parse(value.tags),
				});
			} catch {
				// 失败已在 onError 中提示，表单保持打开，可以修改后重试
			}
		},
	});

	const handleSubmit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			// 输入框里还没按回车的文字也作为标签一起保存
			if (tagDraft.trim() !== "") {
				form.setFieldValue("tags", (tags) => appendTags(tags, tagDraft));
				setTagDraft("");
			}
			await form.handleSubmit();
		},
		[form, tagDraft]
	);

	return (
		<form noValidate onSubmit={handleSubmit}>
			<FieldGroup>
				<form.Field name="remark" validators={{ onChange: remarkTextSchema }}>
					{(field) => (
						<RemarkInput
							errors={field.state.meta.errors}
							onBlur={field.handleBlur}
							onValueChange={field.handleChange}
							value={field.state.value}
						/>
					)}
				</form.Field>
				<form.Field name="tags" validators={{ onChange: tagsSchema }}>
					{(field) => (
						<TagsInput
							draft={tagDraft}
							errors={field.state.meta.errors}
							onBlur={field.handleBlur}
							onDraftChange={setTagDraft}
							onTagsChange={field.handleChange}
							tags={field.state.value}
						/>
					)}
				</form.Field>
				<form.Subscribe selector={selectIsSubmitting}>
					{(isSubmitting) => (
						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
							<Button
								disabled={isSubmitting}
								onClick={onClose}
								type="button"
								variant="outline"
							>
								取消
							</Button>
							<Button disabled={isSubmitting} type="submit">
								{isSubmitting ? "正在保存…" : "保存"}
							</Button>
						</div>
					)}
				</form.Subscribe>
			</FieldGroup>
		</form>
	);
}
