import { useMutation, useQuery } from "@tanstack/react-query";
import {
	githubUserIdSchema,
	githubUsernameSchema,
} from "@zyk-aws-admin/api/github/schemas";
import { router, useLocalSearchParams } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useCallback } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DataState, QueryProblem } from "@/components/developers/data-state";
import { ProfileSummary } from "@/components/developers/profile-summary";
import { RecordDetails } from "@/components/developers/record-details";
import { getAppErrorMessage } from "@/lib/app-error";
import { refreshGithubUsers } from "@/lib/github-users";
import { trpc } from "@/utils/trpc";

function goBack() {
	if (router.canGoBack()) {
		router.back();
	} else {
		router.replace("/(drawer)/(tabs)");
	}
}

function SavedRecord({ id }: { id: number }) {
	const query = useQuery(trpc.githubUser.byId.queryOptions({ id }));
	const retry = useCallback(async () => {
		await query.refetch();
	}, [query]);
	if (!query.data) {
		return (
			<DataState
				action={query.error ? "重试" : undefined}
				description={
					query.error
						? getAppErrorMessage(query.error)
						: "连接网络后可继续查看。"
				}
				loading={query.isLoading}
				onAction={retry}
				title={query.error ? "暂时无法查看资料" : "正在加载资料…"}
			/>
		);
	}
	return (
		<View className="gap-5">
			{query.error ? (
				<QueryProblem error={query.error} onRetry={retry} />
			) : null}
			<RecordDetails key={id} record={query.data} />
		</View>
	);
}

function Preview({ username }: { username: string }) {
	const query = useQuery(
		trpc.githubUser.lookup.queryOptions({ username }, { staleTime: 60_000 })
	);
	const { toast } = useToast();
	const create = useMutation(
		trpc.githubUser.create.mutationOptions({
			onError: async () => {
				await query.refetch();
			},
			onSuccess: async (record) => {
				await refreshGithubUsers();
				router.replace({ params: { id: record.id }, pathname: "/modal" });
				toast.show({ label: "已加入共享名单", variant: "success" });
			},
		})
	);
	const retry = useCallback(async () => {
		await query.refetch();
	}, [query]);
	const add = useCallback(() => {
		if (!create.isPending) {
			create.mutate({ username });
		}
	}, [create, username]);
	const openSaved = useCallback(() => {
		if (query.data?.savedId) {
			router.replace({
				params: { id: query.data.savedId },
				pathname: "/modal",
			});
		}
	}, [query.data]);
	if (!query.data) {
		return (
			<DataState
				action={query.error ? "重试" : undefined}
				description={
					query.error
						? getAppErrorMessage(query.error)
						: "连接网络后可继续查看。"
				}
				loading={query.isLoading}
				onAction={retry}
				title={query.error ? "暂时无法获取 GitHub 资料" : "正在查询 GitHub…"}
			/>
		);
	}
	return (
		<View className="gap-6">
			{query.error ? (
				<QueryProblem error={query.error} onRetry={retry} />
			) : null}
			<ProfileSummary profile={query.data} />
			{query.data.savedId ? (
				<Button onPress={openSaved} variant="secondary">
					已在名单中 · 查看记录
				</Button>
			) : (
				<Button isDisabled={create.isPending || query.isFetching} onPress={add}>
					{create.isPending ? "正在加入名单…" : "加入共享名单"}
				</Button>
			)}
			{create.error ? (
				<Text
					accessibilityLiveRegion="polite"
					className="text-danger text-sm leading-6"
					selectable
				>
					{getAppErrorMessage(create.error)}
				</Text>
			) : null}
			<Text className="text-center text-muted text-xs leading-6">
				加入时会重新获取 GitHub 最新公开资料。
			</Text>
		</View>
	);
}

export default function DeveloperProfile() {
	const { id, username } = useLocalSearchParams<{
		id?: string;
		username?: string;
	}>();
	const insets = useSafeAreaInsets();
	const parsedId = githubUserIdSchema.safeParse(Number(id));
	const parsedUsername = githubUsernameSchema.safeParse(username);
	let content = (
		<DataState
			action="返回名单"
			description="请从名单或搜索结果重新打开。"
			onAction={goBack}
			title="无效的开发者地址"
		/>
	);
	if (id !== undefined && parsedId.success) {
		content = <SavedRecord id={parsedId.data} key={parsedId.data} />;
	} else if (id === undefined && parsedUsername.success) {
		content = (
			<Preview key={parsedUsername.data} username={parsedUsername.data} />
		);
	}
	return (
		<KeyboardAwareScrollView
			bottomOffset={24}
			className="flex-1 bg-background"
			contentContainerStyle={{
				gap: 24,
				padding: 24,
				paddingBottom: insets.bottom + 32,
			}}
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
		>
			{content}
		</KeyboardAwareScrollView>
	);
}
