import { Ionicons } from "@expo/vector-icons";
import { SEARCH_KEYWORD_MAX_LENGTH } from "@zyk-aws-admin/api/github/schemas";
import { Button, Input, useThemeColor } from "heroui-native";
import { View } from "react-native";

export function SearchField({
	value,
	onChange,
	onSubmit,
	placeholder,
	busy = false,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	placeholder: string;
	busy?: boolean;
}) {
	const muted = useThemeColor("muted");
	return (
		<View className="flex-row items-center gap-2 rounded-2xl border border-border bg-surface px-3">
			<Ionicons color={muted} name="search-outline" size={20} />
			<Input
				accessibilityLabel="搜索开发者"
				autoCapitalize="none"
				autoCorrect={false}
				className="min-w-0 flex-1 bg-transparent px-0 shadow-none"
				maxLength={SEARCH_KEYWORD_MAX_LENGTH}
				onChangeText={onChange}
				onSubmitEditing={onSubmit}
				placeholder={placeholder}
				returnKeyType="search"
				style={{ backgroundColor: "transparent" }}
				underlineColorAndroid="transparent"
				value={value}
				variant="secondary"
			/>
			<Button
				isDisabled={busy}
				onPress={onSubmit}
				size="sm"
				variant="secondary"
			>
				搜索
			</Button>
		</View>
	);
}
