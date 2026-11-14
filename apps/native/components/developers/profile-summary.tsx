import { Ionicons } from "@expo/vector-icons";
import { Button, Card, useThemeColor, useToast } from "heroui-native";
import { useCallback } from "react";
import { Linking, Text, View } from "react-native";

import {
	compactNumber,
	formatDate,
	type GithubProfile,
} from "@/lib/github-users";
import { DeveloperAvatar } from "./developer-card";

type Profile = Omit<GithubProfile, "savedId">;

export function ProfileSummary({ profile }: { profile: Profile }) {
	const [accent, muted] = useThemeColor(["accent", "muted"]);
	const { toast } = useToast();
	const openGithub = useCallback(async () => {
		try {
			await Linking.openURL(profile.htmlUrl);
		} catch {
			toast.show({
				label: "无法打开 GitHub 主页，请稍后重试",
				variant: "danger",
			});
		}
	}, [profile.htmlUrl, toast]);
	const openBlog = useCallback(async () => {
		if (!profile.blog) {
			return;
		}
		try {
			const url = new URL(
				profile.blog.includes("://") ? profile.blog : `https://${profile.blog}`
			);
			if (!["http:", "https:"].includes(url.protocol)) {
				throw new Error("Invalid URL");
			}
			await Linking.openURL(url.toString());
		} catch {
			toast.show({ label: "个人网站地址无效或无法打开", variant: "danger" });
		}
	}, [profile.blog, toast]);
	return (
		<View className="gap-6">
			<View className="items-center gap-3 py-3">
				<DeveloperAvatar large login={profile.login} src={profile.avatarUrl} />
				<Text
					className="text-center font-bold text-3xl text-foreground"
					selectable
				>
					{profile.name || profile.login}
				</Text>
				<Text className="text-muted" selectable>
					@{profile.login}
				</Text>
				{profile.location ? (
					<View className="flex-row items-center gap-1">
						<Ionicons color={muted} name="location-outline" size={15} />
						<Text className="text-muted text-sm" selectable>
							{profile.location}
						</Text>
					</View>
				) : null}
				<Text
					className="pt-2 text-center text-foreground text-sm leading-7"
					selectable
				>
					{profile.bio || "这位开发者暂未填写简介。"}
				</Text>
			</View>
			<Card className="rounded-3xl p-5 shadow-none">
				<Card.Body className="flex-row flex-wrap gap-y-5">
					{[
						{ label: "粉丝", value: profile.followers },
						{ label: "关注", value: profile.following },
						{ label: "仓库", value: profile.publicRepos },
						{ label: "Gists", value: profile.publicGists },
					].map((item) => (
						<View className="w-1/2 items-center gap-2" key={item.label}>
							<Text className="font-bold text-2xl text-foreground" selectable>
								{compactNumber.format(item.value)}
							</Text>
							<Text className="text-muted text-xs">{item.label}</Text>
						</View>
					))}
				</Card.Body>
			</Card>
			<View className="gap-3">
				{[
					{ label: "公司", value: profile.company },
					{ label: "公开邮箱", value: profile.email },
					{ label: "Twitter", value: profile.twitterUsername },
					{ label: "GitHub ID", value: String(profile.githubId) },
					{ label: "GitHub 注册", value: formatDate(profile.githubCreatedAt) },
					{ label: "GitHub 更新", value: formatDate(profile.githubUpdatedAt) },
				].map((item) => (
					<View className="flex-row gap-4" key={item.label}>
						<Text className="w-24 text-muted text-sm">{item.label}</Text>
						<Text className="flex-1 text-foreground text-sm" selectable>
							{item.value || "未填写"}
						</Text>
					</View>
				))}
			</View>
			<View className="flex-row flex-wrap gap-3">
				<Button onPress={openGithub} variant="outline">
					<Ionicons color={accent} name="logo-github" size={20} />
					<Button.Label>GitHub 主页</Button.Label>
				</Button>
				{profile.blog ? (
					<Button onPress={openBlog} variant="secondary">
						个人网站 ↗
					</Button>
				) : null}
			</View>
		</View>
	);
}
