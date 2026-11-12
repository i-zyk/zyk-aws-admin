import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../prisma/generated/client";
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

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

interface UniqueConstraintMeta {
	driverAdapterError?: {
		cause?: { constraint?: { fields?: unknown; index?: unknown } };
	};
	target?: unknown;
}

/**
 * 判断 P2002 的冲突约束是否涉及 field。不同引擎给出的信息不同：
 * 经典引擎放在 meta.target（字段数组或约束名）；driver adapter（@prisma/adapter-pg）
 * 放在 meta.driverAdapterError.cause.constraint，PostgreSQL 只给出索引名，
 * 形如 `github_user_githubId_key`。拿不到任何约束信息时无法排除，返回 true。
 */
function conflictMayInvolveField(
	meta: UniqueConstraintMeta | undefined,
	field: string
): boolean {
	const constraint = meta?.driverAdapterError?.cause?.constraint;
	const fields = [meta?.target, constraint?.fields].flatMap((value) =>
		Array.isArray(value) ? value.map(String) : []
	);
	const names = [meta?.target, constraint?.index].filter(
		(value): value is string => typeof value === "string"
	);
	if (fields.length === 0 && names.length === 0) {
		return true;
	}
	return (
		fields.includes(field) ||
		names.some((name) => name === field || name.includes(`_${field}_`))
	);
}

/**
 * 是否为唯一约束冲突（Prisma P2002）。传入 field 时还要求冲突约束涉及该字段；
 * 错误里拿不到约束信息时只按错误码判断。
 */
export function isUniqueConstraintError(
	error: unknown,
	field?: string
): boolean {
	if (
		!(
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === UNIQUE_CONSTRAINT_ERROR_CODE
		)
	) {
		return false;
	}
	if (field === undefined) {
		return true;
	}
	return conflictMayInvolveField(
		error.meta as UniqueConstraintMeta | undefined,
		field
	);
}
