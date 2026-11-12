import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import {
	getItem,
	getItemAsync,
	setItem,
	setItemAsync,
} from "expo-secure-store";

import { ENV } from "../src/env";

export const authClient = createAuthClient({
	baseURL: ENV.EXPO_PUBLIC_SERVER_URL,
	plugins: [
		expoClient({
			scheme: Constants.expoConfig?.scheme as string,
			storage: { getItem, getItemAsync, setItem, setItemAsync },
			storagePrefix: Constants.expoConfig?.scheme as string,
		}),
	],
});
