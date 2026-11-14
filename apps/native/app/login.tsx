import { Ionicons } from "@expo/vector-icons";
import { Button, useThemeColor } from "heroui-native";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Login() {
	const [signingUp, setSigningUp] = useState(false);
	const accent = useThemeColor("accent");
	const insets = useSafeAreaInsets();
	const switchForm = useCallback(() => setSigningUp((current) => !current), []);
	return (
		<KeyboardAwareScrollView
			bottomOffset={24}
			className="flex-1 bg-background"
			contentContainerStyle={{
				flexGrow: 1,
				gap: 28,
				padding: 28,
				paddingBottom: insets.bottom + 28,
				paddingTop: insets.top + 16,
			}}
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
		>
			<View className="flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<Ionicons color={accent} name="logo-github" size={24} />
					<Text className="font-bold text-foreground text-xl">GitSpace</Text>
				</View>
				<ThemeToggle />
			</View>
			<View className="gap-3 pt-8">
				<Text className="font-medium text-accent text-xs tracking-[2px]">
					YOUR DEVELOPER CIRCLE
				</Text>
				<Text
					accessibilityRole="header"
					className="font-bold text-3xl text-foreground leading-[44px]"
				>
					{signingUp ? "开启你的开发者旅程" : "欢迎回来。"}
				</Text>
				<Text className="text-muted text-sm leading-7">
					{signingUp
						? "创建账号，发现开发者、整理标签，与团队共享名单。"
						: "登录后继续探索，管理你的 GitHub 开发者名单。"}
				</Text>
			</View>
			{signingUp ? <SignUp /> : <SignIn />}
			<Button onPress={switchForm} variant="ghost">
				{signingUp ? "已有账号？返回登录" : "没有账号？创建一个"}
			</Button>
			<Text className="mt-auto pt-6 text-center text-muted text-xs leading-6">
				邮箱密码登录 · 资料来自 GitHub 公开信息
			</Text>
		</KeyboardAwareScrollView>
	);
}
