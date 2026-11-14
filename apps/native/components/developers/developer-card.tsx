import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Avatar, Button, Card, Chip, useThemeColor } from "heroui-native";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";

import { compactNumber, type GithubRecord } from "@/lib/github-users";

export function DeveloperAvatar({
	login,
	src,
	large = false,
}: {
	login: string;
	src: string;
	large?: boolean;
}) {
	return (
		<Avatar alt={`${login} 的头像`} className={large ? "size-24" : "size-14"}>
			<Avatar.Image source={{ uri: src }} />
			<Avatar.Fallback>{login.slice(0, 2).toUpperCase()}</Avatar.Fallback>
		</Avatar>
	);
}

export function DeveloperCard({
	developer,
	selecting,
	selected,
	onToggle,
	disabled = false,
}: {
	developer: GithubRecord;
	selecting: boolean;
	selected: boolean;
	onToggle: (id: number) => void;
	disabled?: boolean;
}) {
	const [muted, accent] = useThemeColor(["muted", "accent"]);
	const openDetails = useCallback(() => {
		if (disabled) {
			return;
		}
		if (selecting) {
			onToggle(developer.id);
			return;
		}
		router.push({ params: { id: developer.id }, pathname: "/modal" });
	}, [developer.id, disabled, onToggle, selecting]);
	const toggle = useCallback(() => {
		if (!disabled) {
			onToggle(developer.id);
		}
	}, [developer.id, disabled, onToggle]);
	const selectionIcon = selected ? "checkbox" : "square-outline";
	return (
		<Card className="gap-4 rounded-3xl border border-border/60 p-5 shadow-none">
			<Card.Body className="gap-4">
				<View className="flex-row items-center gap-3">
					<Pressable
						accessibilityLabel={`查看 ${developer.login} 的资料`}
						accessibilityRole="button"
						disabled={disabled}
						onLongPress={toggle}
						onPress={openDetails}
					>
						<DeveloperAvatar
							login={developer.login}
							src={developer.avatarUrl}
						/>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						className="flex-1 gap-1"
						disabled={disabled}
						onLongPress={toggle}
						onPress={openDetails}
					>
						<Card.Title className="text-lg">
							{developer.name || developer.login}
						</Card.Title>
						<Text className="text-muted text-xs">@{developer.login}</Text>
					</Pressable>
					<Button
						accessibilityLabel={
							selecting
								? `${selected ? "取消选择" : "选择"} ${developer.login}`
								: `查看 ${developer.login} 的资料`
						}
						accessibilityRole={selecting ? "checkbox" : "button"}
						accessibilityState={selecting ? { checked: selected } : undefined}
						isDisabled={disabled}
						isIconOnly
						onPress={openDetails}
						size="sm"
						variant={selected ? "secondary" : "ghost"}
					>
						<Ionicons
							color={selected ? accent : muted}
							name={selecting ? selectionIcon : "chevron-forward"}
							size={21}
						/>
					</Button>
				</View>
				<Card.Description className="text-sm leading-6" numberOfLines={2}>
					{developer.bio || "这位开发者暂未填写简介。"}
				</Card.Description>
				<View className="flex-row flex-wrap items-center gap-4">
					<View className="flex-row items-center gap-1.5">
						<Ionicons color={muted} name="people-outline" size={14} />
						<Text className="text-muted text-xs">
							<Text className="font-semibold text-foreground">
								{compactNumber.format(developer.followers)}
							</Text>{" "}
							粉丝
						</Text>
					</View>
					<View className="min-w-0 flex-row items-center gap-1.5">
						<Ionicons color={muted} name="location-outline" size={14} />
						<Text className="text-muted text-xs">
							{developer.location || "所在地未填写"}
						</Text>
					</View>
				</View>
			</Card.Body>
			{developer.tags.length || developer.remark ? (
				<Card.Footer className="flex-row flex-wrap gap-2 border-border/60 border-t pt-4">
					{developer.tags.map((tag) => (
						<Chip key={tag} size="sm" variant="soft">
							<Chip.Label>{tag}</Chip.Label>
						</Chip>
					))}
					{developer.remark ? (
						<View className="ml-auto flex-row items-center gap-1 self-center">
							<Ionicons color={muted} name="document-text-outline" size={12} />
							<Text className="text-[10px] text-muted">已备注</Text>
						</View>
					) : null}
				</Card.Footer>
			) : null}
		</Card>
	);
}
