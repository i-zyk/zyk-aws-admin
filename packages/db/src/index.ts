import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../prisma/generated/client";
import type { DatabaseConfig } from "./config";

/** github_user 表的记录类型，供 api 的 mapper 使用 */
export type { GithubUser } from "../prisma/generated/client";

export function createPrismaClient(env: DatabaseConfig) {
	const adapter = new PrismaPg({
		connectionString: env.DATABASE_URL,
	});
	return new PrismaClient({ adapter });
}

export type Database = ReturnType<typeof createPrismaClient>;
