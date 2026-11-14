import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useThemeColor } from "heroui-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeToggle } from "@/components/theme-toggle";

export default function TabLayout() {
	const insets = useSafeAreaInsets();
	const [foreground, background, surface, accent, muted, border] =
		useThemeColor([
			"foreground",
			"background",
			"surface",
			"accent",
			"muted",
			"border",
		]);
	return (
		<Tabs
			screenOptions={{
				headerRight: () => <ThemeToggle />,
				headerShadowVisible: false,
				headerStyle: { backgroundColor: background },
				headerTintColor: foreground,
				headerTitleStyle: { fontSize: 20, fontWeight: "700" },
				tabBarActiveTintColor: accent,
				tabBarInactiveTintColor: muted,
				tabBarItemStyle: { paddingVertical: 6 },
				tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
				tabBarStyle: {
					backgroundColor: surface,
					borderTopColor: border,
					height: 64 + Math.max(insets.bottom, 12),
					paddingBottom: Math.max(insets.bottom, 12),
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							color={color}
							name={focused ? "people" : "people-outline"}
							size={size}
						/>
					),
					tabBarLabel: "名单",
					title: "GitSpace",
				}}
			/>
			<Tabs.Screen
				name="two"
				options={{
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							color={color}
							name={focused ? "compass" : "compass-outline"}
							size={size}
						/>
					),
					tabBarLabel: "发现",
					title: "发现开发者",
				}}
			/>
			<Tabs.Screen
				name="profile"
				options={{
					tabBarIcon: ({ color, size, focused }) => (
						<Ionicons
							color={color}
							name={focused ? "person-circle" : "person-circle-outline"}
							size={size}
						/>
					),
					tabBarLabel: "我的",
					title: "个人中心",
				}}
			/>
		</Tabs>
	);
}
