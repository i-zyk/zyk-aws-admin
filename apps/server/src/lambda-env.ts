import { z } from "zod";

import type { ServerConfig } from "./create-services";

/** 空字符串当作没配置：SAM 模板里可选参数留空时，环境变量会是 "" */
const optionalString = z
	.string()
	.optional()
	.transform((value) => (value ? value : undefined));

/**
 * Lambda 的环境变量校验。Lambda 上没有 .env 文件和 varlock CLI，不能用 varlock/auto-load，
 * 这里按 apps/server/.env.schema 的同一套规则用 zod 校验；两边的变量要保持一致。
 * 校验失败时抛错，函数初始化失败，比带着错误配置处理请求更容易发现。
 */
const lambdaEnvSchema = z.object({
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.url(),
	CORS_ORIGIN: z.url(),
	DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
	DATABASE_URL: z.string().min(1),
	GITHUB_TOKEN: optionalString,
});

export function parseLambdaEnv(
	env: Record<string, string | undefined>
): ServerConfig {
	const result = lambdaEnvSchema.safeParse(env);
	if (!result.success) {
		// 只报出错的变量名和原因，不打印值，避免把密钥写进日志
		const problems = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new Error(`Lambda 环境变量不合法：${problems}`);
	}
	return result.data;
}
