import "@/global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "expo-router/react-navigation";
import { StatusBar } from "expo-status-bar";
import { setBackgroundColorAsync } from "expo-system-ui";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { DataState } from "@/components/developers/data-state";
import { AppThemeProvider, useAppTheme } from "@/contexts/app-theme-context";
import { getTrpcCode } from "@/lib/app-error";
import { authClient } from "@/lib/auth-client";
import { isUnauthorizedSession, resolveSession } from "@/lib/session-state";
import { useAppLifecycle } from "@/lib/use-app-lifecycle";
import { queryClient } from "@/utils/trpc";

export const unstable_settings = {
	anchor: "(drawer)",
};

function StackLayout() {
	const [background, foreground, accent, border] = useThemeColor([
		"background",
		"foreground",
		"accent",
		"border",
	]);
	const { isDark } = useAppTheme();
	const baseTheme = isDark ? DarkTheme : DefaultTheme;
	const session = authClient.useSession();
	// A transport error must not remove the authenticated stack or discard open drafts.
	// A successful null session still removes protected screens immediately.
	const [lastSession, setLastSession] = useState(session.data);
	const confirmedSession = isUnauthorizedSession(session.error)
		? null
		: session.data;
	if (
		!session.isPending &&
		(!session.error || isUnauthorizedSession(session.error)) &&
		lastSession !== confirmedSession
	) {
		setLastSession(confirmedSession);
	}
	const activeSession = resolveSession(
		session.data,
		lastSession,
		session.isPending,
		session.error
	);
	const previousUser = useRef<string | null>(null);
	const userId = activeSession?.user.id ?? null;
	const { refetch: refetchSession } = session;
	const revalidateSession = useCallback(async () => {
		await refetchSession();
	}, [refetchSession]);
	useAppLifecycle(revalidateSession);
	useEffect(() => {
		if (session.isPending) {
			return;
		}
		if (previousUser.current && !userId) {
			async function clearPrivateCache() {
				await queryClient.cancelQueries();
				queryClient.clear();
			}
			clearPrivateCache();
		}
		previousUser.current = userId;
	}, [session.isPending, userId]);
	useEffect(() => {
		const queryUnsubscribe = queryClient.getQueryCache().subscribe((event) => {
			if (
				event.type === "updated" &&
				event.action.type === "error" &&
				getTrpcCode(event.query.state.error) === "UNAUTHORIZED"
			) {
				revalidateSession();
			}
		});
		const mutationUnsubscribe = queryClient
			.getMutationCache()
			.subscribe((event) => {
				if (
					event.type === "updated" &&
					event.action.type === "error" &&
					getTrpcCode(event.mutation.state.error) === "UNAUTHORIZED"
				) {
					revalidateSession();
				}
			});
		return () => {
			queryUnsubscribe();
			mutationUnsubscribe();
		};
	}, [revalidateSession]);
	useEffect(() => {
		async function updateWindowBackground() {
			await setBackgroundColorAsync(background);
		}
		updateWindowBackground();
	}, [background]);
	return (
		<ThemeProvider
			value={{
				...baseTheme,
				colors: {
					...baseTheme.colors,
					background,
					border,
					card: background,
					primary: accent,
					text: foreground,
				},
			}}
		>
			<View style={{ backgroundColor: background, flex: 1 }}>
				<StatusBar style={isDark ? "light" : "dark"} />
				{!activeSession && (session.isPending || session.error) ? (
					<View className="flex-1 justify-center bg-background p-6">
						<DataState
							action={session.error ? "重试" : undefined}
							description={session.error ? "请检查网络后重试。" : undefined}
							loading={session.isPending}
							onAction={revalidateSession}
							title={
								session.isPending ? "正在恢复登录状态…" : "暂时无法确认登录状态"
							}
						/>
					</View>
				) : (
					<Stack
						screenOptions={{
							contentStyle: { backgroundColor: background },
							headerShadowVisible: false,
							headerStyle: { backgroundColor: background },
							headerTintColor: foreground,
						}}
					>
						<Stack.Protected guard={!!activeSession}>
							<Stack.Screen name="(drawer)" options={{ headerShown: false }} />
							<Stack.Screen
								name="modal"
								options={{ presentation: "card", title: "开发者资料" }}
							/>
						</Stack.Protected>
						<Stack.Protected guard={!activeSession}>
							<Stack.Screen name="login" options={{ headerShown: false }} />
						</Stack.Protected>
					</Stack>
				)}
			</View>
		</ThemeProvider>
	);
}

export default function Layout() {
	return (
		<QueryClientProvider client={queryClient}>
			<GestureHandlerRootView style={{ flex: 1 }}>
				<KeyboardProvider>
					<AppThemeProvider>
						<HeroUINativeProvider>
							<StackLayout />
						</HeroUINativeProvider>
					</AppThemeProvider>
				</KeyboardProvider>
			</GestureHandlerRootView>
		</QueryClientProvider>
	);
}
