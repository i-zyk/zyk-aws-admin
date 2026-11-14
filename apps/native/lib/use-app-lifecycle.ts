import { focusManager, onlineManager } from "@tanstack/react-query";
import {
	addNetworkStateListener,
	getNetworkStateAsync,
	type NetworkState,
} from "expo-network";
import { useEffect } from "react";
import { AppState } from "react-native";

function updateConnection(state: NetworkState) {
	onlineManager.setOnline(state.isConnected !== false);
}

export function useAppLifecycle(revalidateSession: () => void) {
	useEffect(() => {
		const app = AppState.addEventListener("change", (state) => {
			focusManager.setFocused(state === "active");
			if (state === "active") {
				revalidateSession();
			}
		});
		const network = addNetworkStateListener(updateConnection);
		async function checkConnection() {
			try {
				updateConnection(await getNetworkStateAsync());
			} catch {
				onlineManager.setOnline(true);
			}
		}
		checkConnection();
		return () => {
			app.remove();
			network.remove();
		};
	}, [revalidateSession]);
}
