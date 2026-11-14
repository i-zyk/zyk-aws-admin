import { useMutation } from "@tanstack/react-query";
import {
	githubUserUpdateInputSchema,
	REMARK_MAX_LENGTH,
	TAG_MAX_LENGTH,
	TAGS_MAX_COUNT,
} from "@zyk-aws-admin/api/github/schemas";
import { router } from "expo-router";
import { Button, Input, Label, TextField, useToast } from "heroui-native";
import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";

import { getAppCode, getAppErrorMessage } from "@/lib/app-error";
import {
	formatDate,
	type GithubOutputs,
	refreshAfterDelete,
	refreshGithubUsers,
} from "@/lib/github-users";
import { trpc } from "@/utils/trpc";
import { ProfileSummary } from "./profile-summary";

const TAG_SEPARATOR = /[,，]/;

export function RecordDetails({ record }: { record: GithubOutputs["byId"] }) {
	const [remark, setRemark] = useState(record.remark ?? "");
	const [tags, setTags] = useState(record.tags.join("，"));
	const [validation, setValidation] = useState("");
	const locked = useRef<boolean>(false);
	const { toast } = useToast();
	const unlock = useCallback(() => {
		locked.current = false;
	}, []);
	const update = useMutation(
		trpc.githubUser.update.mutationOptions({
			onSettled: unlock,
			onSuccess: async (updated) => {
				setRemark(updated.remark ?? "");
				setTags(updated.tags.join("，"));
				await refreshGithubUsers();
				toast.show({ label: "备注和标签已保存", variant: "success" });
			},
		})
	);
	const sync = useMutation(
		trpc.githubUser.sync.mutationOptions({
			onSettled: unlock,
			onSuccess: async () => {
				await refreshGithubUsers();
				toast.show({ label: "GitHub 资料已同步", variant: "success" });
			},
		})
	);
	const leaveAfterDelete = useCallback(async () => {
		router.replace("/(drawer)/(tabs)");
		await refreshAfterDelete();
	}, []);
	const deletion = useMutation(
		trpc.githubUser.delete.mutationOptions({
			onError: async (error) => {
				if (getAppCode(error) === "RECORD_NOT_FOUND") {
					await leaveAfterDelete();
				}
			},
			onSettled: unlock,
			onSuccess: async () => {
				await leaveAfterDelete();
				toast.show({ label: "已从名单删除", variant: "success" });
			},
		})
	);
	const busy = update.isPending || sync.isPending || deletion.isPending;
	const save = useCallback(() => {
		if (locked.current) {
			return;
		}
		const parsed = githubUserUpdateInputSchema.safeParse({
			id: record.id,
			remark,
			tags: tags.split(TAG_SEPARATOR),
		});
		if (!parsed.success) {
			setValidation(parsed.error.issues[0]?.message ?? "请检查备注和标签");
			return;
		}
		setValidation("");
		locked.current = true;
		update.mutate(parsed.data);
	}, [record.id, remark, tags, update]);
	const synchronize = useCallback(() => {
		if (!locked.current) {
			locked.current = true;
			sync.mutate({ id: record.id });
		}
	}, [record.id, sync]);
	const remove = useCallback(() => {
		if (locked.current) {
			return;
		}
		Alert.alert(
			`删除 ${record.login}？`,
			"删除后无法恢复，备注和标签会一起删除。",
			[
				{ style: "cancel", text: "取消" },
				{
					onPress: () => {
						if (!locked.current) {
							locked.current = true;
							deletion.mutate({ id: record.id });
						}
					},
					style: "destructive",
					text: "删除",
				},
			]
		);
	}, [deletion, record.id, record.login]);
	return (
		<View className="gap-6">
			<ProfileSummary profile={record} />
			<View className="gap-2 rounded-2xl bg-accent/10 p-4">
				<Text className="font-medium text-accent text-sm">
					已保存到共享名单
				</Text>
				<Text className="text-muted text-xs leading-6" selectable>
					添加人：{record.createdBy?.name ?? "已删除的用户"}
					{"\n"}添加时间：{formatDate(record.createdAt)}
					{"\n"}最后同步：{formatDate(record.syncedAt)}
				</Text>
			</View>
			<Button isDisabled={busy} onPress={synchronize} variant="secondary">
				{sync.isPending ? "正在同步 GitHub…" : "从 GitHub 同步资料"}
			</Button>
			{sync.error ? (
				<Text
					accessibilityLiveRegion="polite"
					className="text-danger text-sm leading-6"
					selectable
				>
					{getAppErrorMessage(sync.error, "sync")}
				</Text>
			) : null}
			<View className="gap-5">
				<Text
					accessibilityRole="header"
					className="font-semibold text-foreground text-lg"
				>
					备注与标签
				</Text>
				<TextField isDisabled={busy}>
					<Label>标签</Label>
					<Input
						accessibilityLabel="标签，用逗号分隔"
						maxLength={TAGS_MAX_COUNT * (TAG_MAX_LENGTH + 1)}
						onChangeText={setTags}
						placeholder="例如：前端，开源"
						value={tags}
					/>
					<Text className="mt-2 text-muted text-xs">
						用逗号分隔，最多 {TAGS_MAX_COUNT} 个，每个最多 {TAG_MAX_LENGTH} 字。
					</Text>
				</TextField>
				<TextField isDisabled={busy}>
					<Label>备注</Label>
					<Input
						accessibilityLabel="开发者备注"
						className="min-h-28"
						maxLength={REMARK_MAX_LENGTH}
						multiline
						onChangeText={setRemark}
						placeholder="记下你关注这位开发者的原因…"
						style={{ textAlignVertical: "top" }}
						value={remark}
					/>
					<Text className="mt-2 text-muted text-xs">
						{remark.length} / {REMARK_MAX_LENGTH}
					</Text>
				</TextField>
				{validation || update.error ? (
					<Text
						accessibilityLiveRegion="polite"
						className="text-danger text-sm leading-6"
						selectable
					>
						{validation || getAppErrorMessage(update.error)}
					</Text>
				) : null}
				<Button isDisabled={busy} onPress={save}>
					{update.isPending ? "正在保存…" : "保存备注和标签"}
				</Button>
			</View>
			{deletion.error ? (
				<Text
					accessibilityLiveRegion="polite"
					className="text-danger text-sm leading-6"
					selectable
				>
					{getAppErrorMessage(deletion.error)}
				</Text>
			) : null}
			<Button isDisabled={busy} onPress={remove} variant="danger-soft">
				{deletion.isPending ? "正在删除…" : "从名单删除"}
			</Button>
		</View>
	);
}
