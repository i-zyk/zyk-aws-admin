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
/**
 * 生产环境由 Cloudflare Worker 写入的真实客户端 IP（取自 CF-Connecting-IP，会覆盖客户端自带的同名请求头）。
 * 经过 Worker 和 API Gateway 后，x-forwarded-for 只剩 Cloudflare 的出口 IP，不能用来区分用户。
 * 没有这个请求头时（本地开发、测试）退回 x-forwarded-for。
 */
export const CLIENT_IP_HEADER = "x-client-ip";

export function createAuth(
	env: AuthConfig,
	database: Database,
	desktopOrigins: readonly string[] = []
) {
	return betterAuth({
		advanced: {
			// 页面和接口同一个域名（Worker 统一入口），Cookie 是第一方的，用 lax 即可
			defaultCookieAttributes: {
				httpOnly: true,
				sameSite: "lax",
				secure: true,
			},
			ipAddress: {
				ipAddressHeaders: [CLIENT_IP_HEADER, "x-forwarded-for"],
			},
		},
		baseURL: env.BETTER_AUTH_URL,
		database: prismaAdapter(database, {
			provider: "postgresql",
		}),
		emailAndPassword: { enabled: true },
		plugins: [expo()],
		// 开发环境也开启限流（默认只在生产开启）；注册、登录各自按 IP 计数。
		// 计数存数据库：Lambda 多个实例、实例重启之间都共享同一份计数
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
			storage: "database",
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
