import {
	environmentManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@zyk-aws-admin/api/routers/index";
import { toast } from "sonner";

import { getAppErrorMessage } from "@/lib/app-error";

const TRAILING_SLASH = /\/$/;

/** 查询的 meta：skipGlobalErrorToast 为 true 时错误在页面内展示，不弹全局 toast */
type AppQueryMeta = Record<string, unknown> & {
	skipGlobalErrorToast?: boolean;
};

declare module "@tanstack/react-query" {
	interface Register {
		queryMeta: AppQueryMeta;
	}
}

export const { TRPCProvider, useTRPC, useTRPCClient } =
	createTRPCContext<AppRouter>();

function makeQueryClient() {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				if (query.meta?.skipGlobalErrorToast) {
					return;
				}
				toast.error(getAppErrorMessage(error), {
					action: {
						label: "retry",
						onClick: () => {
							query.invalidate();
						},
					},
				});
			},
		}),
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
	if (environmentManager.isServer()) {
		return makeQueryClient();
	}

	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}

export function makeTRPCClient() {
	return createTRPCClient<AppRouter>({
		links: [
			httpBatchLink({
				fetch: (url, options) =>
					fetch(url, {
						...options,
						credentials: "include",
					}),
				url: `${(process.env.NEXT_PUBLIC_SERVER_URL ?? "").replace(TRAILING_SLASH, "")}/trpc`,
			}),
		],
	});
}
