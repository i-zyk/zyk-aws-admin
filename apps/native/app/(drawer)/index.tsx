import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Card, Chip, useThemeColor } from "heroui-native";
import { Pressable, Text, View } from "react-native";

import { Container } from "@/components/container";
import { SignIn } from "@/components/sign-in";
import { SignUp } from "@/components/sign-up";
import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

type ConnectionStatus = "checking" | "connected" | "disconnected";

const CONNECTION_DESCRIPTIONS: Record<ConnectionStatus, string> = {
	checking: "Checking connection...",
	connected: "Connected to API",
	disconnected: "API Disconnected",
};

function getConnectionStatus(
	isLoading: boolean,
	isConnected: boolean
): ConnectionStatus {
	if (isLoading) {
		return "checking";
	}
	return isConnected ? "connected" : "disconnected";
}

function handleSignOut() {
	authClient.signOut();
	queryClient.invalidateQueries();
}

function ConnectionStatusIcon({ status }: { status: ConnectionStatus }) {
	const mutedColor = useThemeColor("muted");
	const successColor = useThemeColor("success");
	const dangerColor = useThemeColor("danger");

	if (status === "checking") {
		return <Ionicons color={mutedColor} name="hourglass-outline" size={20} />;
	}
	if (status === "connected") {
		return <Ionicons color={successColor} name="checkmark-circle" size={20} />;
	}
	return <Ionicons color={dangerColor} name="close-circle" size={20} />;
}

export default function Home() {
	const healthCheck = useQuery(trpc.healthCheck.queryOptions());
	const privateData = useQuery(trpc.privateData.queryOptions());
	const isConnected = healthCheck?.data === "OK";
	const connectionStatus = getConnectionStatus(
		healthCheck.isLoading,
		isConnected
	);
	const { data: session } = authClient.useSession();

	return (
		<Container className="p-6">
			<View className="mb-6 py-4">
				<Text className="mb-2 font-bold text-4xl text-foreground">
					BETTER T STACK
				</Text>
			</View>

			{session?.user ? (
				<Card className="mb-6 p-4" variant="secondary">
					<Text className="mb-2 text-base text-foreground">
						Welcome, <Text className="font-medium">{session.user.name}</Text>
					</Text>
					<Text className="mb-4 text-muted text-sm">{session.user.email}</Text>
					<Pressable
						className="self-start rounded-lg bg-danger px-4 py-3 active:opacity-70"
						onPress={handleSignOut}
					>
						<Text className="font-medium text-foreground">Sign Out</Text>
					</Pressable>
				</Card>
			) : null}

			<Card className="p-6" variant="secondary">
				<View className="mb-4 flex-row items-center justify-between">
					<Card.Title>System Status</Card.Title>
					<Chip
						color={isConnected ? "success" : "danger"}
						size="sm"
						variant="secondary"
					>
						<Chip.Label>{isConnected ? "LIVE" : "OFFLINE"}</Chip.Label>
					</Chip>
				</View>

				<Card className="p-4">
					<View className="flex-row items-center">
						<View
							className={`mr-3 h-3 w-3 rounded-full ${isConnected ? "bg-success" : "bg-muted"}`}
						/>
						<View className="flex-1">
							<Text className="mb-1 font-medium text-foreground">
								TRPC Backend
							</Text>
							<Card.Description>
								{CONNECTION_DESCRIPTIONS[connectionStatus]}
							</Card.Description>
						</View>
						<ConnectionStatusIcon status={connectionStatus} />
					</View>
				</Card>
			</Card>

			<Card className="mt-6 p-4" variant="secondary">
				<Card.Title className="mb-3">Private Data</Card.Title>
				{privateData && (
					<Card.Description>{privateData.data?.message}</Card.Description>
				)}
			</Card>

			{!session?.user && (
				<>
					<SignIn />
					<SignUp />
				</>
			)}
		</Container>
	);
}
