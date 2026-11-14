import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, useThemeColor } from "heroui-native";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { QueryProblem } from "@/components/developers/data-state";
import { useAppTheme } from "@/contexts/app-theme-context";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";
import { queryClient, trpc } from "@/utils/trpc";

function about() {
	Alert.alert(
		"关于 GitSpace",
		"GitHub 开发者管理工作台。名单由已登录用户共享，备注和标签保存在数据库中。GitHub 资料由服务端获取，点击同步可更新资料。"
	);
}

export default function Profile() {
	const { isDark, toggleTheme } = useAppTheme();
	const { data: session } = authClient.useSession();
	const [signingOut, setSigningOut] = useState(false);
	const [error, setError] = useState("");
	const [accent, muted] = useThemeColor(["accent", "muted"]);
	const users = useQuery(
		trpc.githubUser.list.queryOptions({ page: 1, pageSize: 10 })
	);
	const tags = useQuery(trpc.githubUser.tags.queryOptions());
	const retry = useCallback(async () => {
		await Promise.all([users.refetch(), tags.refetch()]);
	}, [tags, users]);
	const signOut = useCallback(async () => {
		if (signingOut) {
			return;
		}
		setSigningOut(true);
		setError("");
		try {
			const response = await authClient.signOut();
			if (response.error) {
				setError(getAuthErrorMessage(response.error));
				return;
			}
			await queryClient.cancelQueries();
			queryClient.clear();
		} catch {
			setError("退出失败，请检查网络后重试。");
		} finally {
			setSigningOut(false);
		}
	}, [signingOut]);
	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerStyle={{ gap: 24, padding: 20, paddingBottom: 32 }}
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
		>
			<View className="items-center gap-3 py-5">
				<View className="size-20 items-center justify-center rounded-full bg-accent/10">
					<Ionicons color={accent} name="person-outline" size={34} />
				</View>
				<Text className="font-bold text-2xl text-foreground" selectable>
					{session?.user.name}
				</Text>
				<Text className="text-muted text-sm" selectable>
					{session?.user.email}
				</Text>
			</View>
			<Card className="rounded-3xl p-6 shadow-none">
				<Card.Body className="flex-row">
					<View className="flex-1 items-center gap-2">
						<Text className="font-bold text-3xl text-foreground">
							{users.data?.total ?? "—"}
						</Text>
						<Text className="text-muted text-xs">共享名单中的开发者</Text>
					</View>
					<View className="flex-1 items-center gap-2 border-border border-l">
						<Text className="font-bold text-3xl text-foreground">
							{tags.data?.length ?? "—"}
						</Text>
						<Text className="text-muted text-xs">已使用标签</Text>
					</View>
				</Card.Body>
			</Card>
			{users.error || tags.error ? (
				<QueryProblem error={users.error ?? tags.error} onRetry={retry} />
			) : null}
			<View className="gap-3">
				<Text className="font-semibold text-foreground text-lg">
					偏好与设置
				</Text>
				<Button
					className="justify-between rounded-2xl"
					onPress={toggleTheme}
					variant="secondary"
				>
					<View className="flex-row items-center gap-3">
						<Ionicons
							color={accent}
							name={isDark ? "moon-outline" : "sunny-outline"}
							size={20}
						/>
						<Button.Label>外观模式</Button.Label>
					</View>
					<Text className="text-muted text-sm">
						{isDark ? "深色 · 点击切换" : "浅色 · 点击切换"}
					</Text>
				</Button>
				<Button
					className="justify-between rounded-2xl"
					onPress={about}
					variant="secondary"
				>
					<View className="flex-row items-center gap-3">
						<Ionicons
							color={accent}
							name="information-circle-outline"
							size={20}
						/>
						<Button.Label>关于 GitSpace</Button.Label>
					</View>
					<Ionicons color={muted} name="chevron-forward" size={18} />
				</Button>
			</View>
			{error ? (
				<Text
					accessibilityLiveRegion="polite"
					className="text-danger text-sm"
					selectable
				>
					{error}
				</Text>
			) : null}
			<Button isDisabled={signingOut} onPress={signOut} variant="danger-soft">
				{signingOut ? "正在退出…" : "退出登录"}
			</Button>
			<Text className="text-center text-muted text-xs">
				GitSpace · 连接优秀开发者
			</Text>
		</ScrollView>
	);
}
