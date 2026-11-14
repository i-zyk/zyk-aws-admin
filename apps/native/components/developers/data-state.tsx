import { Ionicons } from "@expo/vector-icons";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { Text, View } from "react-native";

import { getAppErrorMessage } from "@/lib/app-error";

export function DataState({
	title,
	description,
	loading = false,
	action,
	onAction,
}: {
	title: string;
	description?: string;
	loading?: boolean;
	action?: string;
	onAction?: () => void;
}) {
	const muted = useThemeColor("muted");
	return (
		<View className="items-center gap-4 rounded-3xl bg-surface px-6 py-10">
			{loading ? (
				<Spinner />
			) : (
				<Ionicons color={muted} name="people-outline" size={36} />
			)}
			<Text
				accessibilityRole="header"
				className="text-center font-semibold text-foreground text-lg"
				selectable
			>
				{title}
			</Text>
			{description ? (
				<Text className="text-center text-muted text-sm leading-6" selectable>
					{description}
				</Text>
			) : null}
			{action && onAction ? (
				<Button onPress={onAction} variant="secondary">
					{action}
				</Button>
			) : null}
		</View>
	);
}

export function QueryProblem({
	error,
	onRetry,
}: {
	error: unknown;
	onRetry: () => void;
}) {
	return (
		<View
			accessibilityLiveRegion="polite"
			className="gap-3 rounded-2xl bg-danger/10 p-4"
		>
			<Text className="text-danger text-sm leading-6" selectable>
				{getAppErrorMessage(error)}
			</Text>
			<Button onPress={onRetry} size="sm" variant="danger-soft">
				重试
			</Button>
		</View>
	);
}
