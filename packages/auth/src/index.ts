import { expo } from "@better-auth/expo";
import type { Database } from "@zyk-aws-admin/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export interface AuthConfig {
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
	CORS_ORIGIN: string;
}

/** 注册、登录限流窗口（秒） */
export const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;
/** 注册、登录每个窗口内同一 IP 允许的请求次数 */
export const AUTH_RATE_LIMIT_MAX_REQUESTS = 5;

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = []
) {
	return betterAuth({
		advanced: {
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "none",
				secure: true,
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		database: prismaAdapter(database, {
			provider: "postgresql",
		}),
		emailAndPassword: { enabled: true },
		plugins: [expo()],
		// 开发环境也开启限流（默认只在生产开启）；注册、登录各自按 IP 计数，内存存储
		rateLimit: {
			customRules: {
				"/sign-in/email": {
					max: AUTH_RATE_LIMIT_MAX_REQUESTS,
					window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
				},
				"/sign-up/email": {
					max: AUTH_RATE_LIMIT_MAX_REQUESTS,
					window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
				},
			},
			enabled: true,
		},
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [
			env.CORS_ORIGIN,
			...desktopOrigins,
			"zyk-aws-admin://",
			"exp://",
			"http://localhost:8081",
		],
	});
}

export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
