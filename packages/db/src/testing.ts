/**
 * 测试专用：只在测试环境（Vitest 的 globalSetup 和测试文件）中使用，业务代码不要导入。
 *
 * 测试库和开发库在同一个 PostgreSQL 实例上，库名为开发库名加 `_test` 后缀
 * （开发库 `zyk_aws_admin` → 测试库 `zyk_aws_admin_test`）。
 * `turbo run test` 会并行跑多个包的测试，各包清空数据的时机互不知晓，
 * 因此除 api 外的包传入自己的后缀（如 `_auth_test`），用各自独立的测试库。
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import { Client } from "pg";

import type { Database } from "./index";
import { createPrismaClient } from "./index";

const TEST_DATABASE_SUFFIX = "_test";
const DATABASE_NAME_PATTERN = /^[A-Za-z0-9_]+$/;
const PRISMA_MIGRATIONS_TABLE = "_prisma_migrations";
const DB_PACKAGE_DIR = path.resolve(import.meta.dirname, "..");
const PRISMA_BIN = path.join(DB_PACKAGE_DIR, "node_modules", ".bin", "prisma");

function getDatabaseName(databaseUrl: string): string {
	const name = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
	if (!DATABASE_NAME_PATTERN.test(name)) {
		throw new Error(
			`数据库名「${name}」只能包含字母、数字和下划线，无法推导测试库`
		);
	}
	return name;
}

function isTestDatabaseName(name: string): boolean {
	return name.endsWith(TEST_DATABASE_SUFFIX);
}

function assertTestDatabaseUrl(databaseUrl: string): void {
	const name = getDatabaseName(databaseUrl);
	if (!isTestDatabaseName(name)) {
		throw new Error(
			`拒绝在非测试库「${name}」上执行测试操作，测试库名必须以 ${TEST_DATABASE_SUFFIX} 结尾`
		);
	}
}

function requireDatabaseUrl(databaseUrl: string | undefined): string {
	if (!databaseUrl) {
		throw new Error(
			"缺少 DATABASE_URL：请通过 `varlock run --path ../db/ -- vitest run` 运行测试"
		);
	}
	return databaseUrl;
}

function requireTestSuffix(suffix: string): string {
	if (!(isTestDatabaseName(suffix) && DATABASE_NAME_PATTERN.test(suffix))) {
		throw new Error(
			`测试库后缀「${suffix}」只能包含字母、数字和下划线，并且必须以 ${TEST_DATABASE_SUFFIX} 结尾`
		);
	}
	return suffix;
}

/**
 * 根据开发库地址推导测试库地址：只把库名改成 `<库名><suffix>`（默认 `<库名>_test`），
 * 主机、端口、账号、密码、参数不变。库名已经以该后缀结尾时原样返回。
 */
export function getTestDatabaseUrl(
	databaseUrl: string,
	suffix: string = TEST_DATABASE_SUFFIX
): string {
	const testSuffix = requireTestSuffix(suffix);
	const name = getDatabaseName(databaseUrl);
	if (name.endsWith(testSuffix)) {
		return databaseUrl;
	}
	const url = new URL(databaseUrl);
	url.pathname = `/${name}${testSuffix}`;
	return url.toString();
}

async function ensureDatabaseExists(
	databaseUrl: string,
	testDatabaseName: string
): Promise<void> {
	// 连到配置的库只为执行集群级的 CREATE DATABASE，不读写该库里的任何表。
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		const { rowCount } = await client.query(
			"SELECT 1 FROM pg_database WHERE datname = $1",
			[testDatabaseName]
		);
		if (!rowCount) {
			await client.query(`CREATE DATABASE "${testDatabaseName}"`);
		}
	} finally {
		await client.end();
	}
}

function migrateTestDatabase(testDatabaseUrl: string): void {
	execFileSync(PRISMA_BIN, ["migrate", "deploy"], {
		cwd: DB_PACKAGE_DIR,
		env: { ...process.env, DATABASE_URL: testDatabaseUrl },
		stdio: "pipe",
	});
}

/**
 * 准备测试库（在 Vitest 的 globalSetup 里调用一次）：
 * 推导测试库地址（后缀见 `getTestDatabaseUrl`）→ 不存在就创建 → 执行 `prisma migrate deploy`。
 * 返回测试库地址。
 */
export async function prepareTestDatabase(
	databaseUrl: string | undefined,
	suffix: string = TEST_DATABASE_SUFFIX
): Promise<string> {
	const sourceUrl = requireDatabaseUrl(databaseUrl);
	const testDatabaseUrl = getTestDatabaseUrl(sourceUrl, suffix);
	await ensureDatabaseExists(sourceUrl, getDatabaseName(testDatabaseUrl));
	migrateTestDatabase(testDatabaseUrl);
	return testDatabaseUrl;
}

/**
 * 创建连到测试库的 Prisma 客户端。默认读取 `DATABASE_URL`（Vitest 配置已把它指向测试库），
 * 地址不是测试库时直接报错，避免误连开发库。
 */
export function createTestDatabase(
	databaseUrl: string | undefined = process.env.DATABASE_URL
): Database {
	const testDatabaseUrl = requireDatabaseUrl(databaseUrl);
	assertTestDatabaseUrl(testDatabaseUrl);
	return createPrismaClient({ DATABASE_URL: testDatabaseUrl });
}

/**
 * 清空测试库 public schema 下除迁移记录外的所有表（包括 `github_user` 和 auth 表），自增序列归零。
 * 当前连接的库不是测试库时直接报错。
 */
export async function resetTestDatabase(db: Database): Promise<void> {
	const [current] = await db.$queryRaw<
		{ name: string }[]
	>`SELECT current_database() AS name`;
	if (!(current && isTestDatabaseName(current.name))) {
		throw new Error(
			`拒绝清空非测试库「${current?.name ?? "未知"}」，测试库名必须以 ${TEST_DATABASE_SUFFIX} 结尾`
		);
	}
	const tables = await db.$queryRaw<{ tablename: string }[]>`
		SELECT tablename FROM pg_tables
		WHERE schemaname = 'public' AND tablename <> ${PRISMA_MIGRATIONS_TABLE}
	`;
	if (tables.length === 0) {
		return;
	}
	const tableList = tables
		.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`)
		.join(", ");
	await db.$executeRawUnsafe(
		`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
	);
}
