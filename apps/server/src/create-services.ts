import { createGithubClient } from "@zyk-aws-admin/api/github/client";
import { type AuthConfig, createAuth } from "@zyk-aws-admin/auth";
import { createPrismaClient } from "@zyk-aws-admin/db";
import type { DatabaseConfig } from "@zyk-aws-admin/db/config";

/** 本地 Node 服务和 Lambda 共用的配置；两边各自负责读取和校验 */
export interface ServerConfig extends AuthConfig, DatabaseConfig {
	/** 数据库连接池上限，不传用 pg 默认值；Lambda 要设小，见 PrismaClientOptions */
	DATABASE_POOL_MAX?: number;
	/** GitHub token，只在服务端使用，不进入任何响应 */
	GITHUB_TOKEN?: string;
}

export function createServices(config: ServerConfig) {
	const db = createPrismaClient(config, {
		maxConnections: config.DATABASE_POOL_MAX,
	});
	return {
		auth: createAuth(config, db),
		db,
		github: createGithubClient({ token: config.GITHUB_TOKEN }),
	};
}

export type Services = ReturnType<typeof createServices>;
