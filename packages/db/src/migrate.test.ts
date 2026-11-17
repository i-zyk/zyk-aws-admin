/**
 * 对照真正的 `prisma migrate deploy` 验证 applyMigrations 的兼容性：
 * 两个空库分别用 Prisma 和 applyMigrations 迁移，表结构和迁移记录必须一致；
 * 还要能互相接着用（Prisma 迁移过的库 applyMigrations 认为已是最新，反过来 `prisma migrate status` 也认为已是最新）。
 * 升级 Prisma 后这里要能通过，否则线上迁移 Lambda 可能和 Prisma 不兼容。
 */
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyMigrations } from "./migrate";
import { getTestDatabaseUrl } from "./testing";

const DB_PACKAGE_DIR = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(DB_PACKAGE_DIR, "prisma", "migrations");
const PRISMA_BIN = path.join(DB_PACKAGE_DIR, "node_modules", ".bin", "prisma");

const sourceUrl = process.env.DATABASE_URL ?? "";
const prismaDbUrl = getTestDatabaseUrl(sourceUrl, "_migrate_prisma_test");
const customDbUrl = getTestDatabaseUrl(sourceUrl, "_migrate_custom_test");
const failureDbUrl = getTestDatabaseUrl(sourceUrl, "_migrate_failure_test");

function databaseName(url: string): string {
	return new URL(url).pathname.slice(1);
}

/** 连到开发库所在的实例，只做集群级的 DROP / CREATE DATABASE，不读写开发库的表 */
async function recreateDatabases(urls: string[]): Promise<void> {
	const client = new Client({ connectionString: sourceUrl });
	await client.connect();
	try {
		for (const url of urls) {
			const name = databaseName(url);
			// biome-ignore lint/performance/noAwaitInLoops: 同一个连接上的 DROP / CREATE DATABASE 只能串行执行
			await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
			await client.query(`CREATE DATABASE "${name}"`);
		}
	} finally {
		await client.end();
	}
}

async function query<T extends object>(url: string, sql: string): Promise<T[]> {
	const client = new Client({ connectionString: url });
	await client.connect();
	try {
		return (await client.query<T>(sql)).rows;
	} finally {
		await client.end();
	}
}

/** 表结构快照：列、索引、约束（不含迁移记录表） */
async function schemaSnapshot(url: string): Promise<unknown> {
	const columns = await query(
		url,
		`SELECT table_name, column_name, data_type, is_nullable, column_default
		 FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
		 ORDER BY table_name, column_name`
	);
	const indexes = await query(
		url,
		`SELECT tablename, indexname, indexdef FROM pg_indexes
		 WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
		 ORDER BY tablename, indexname`
	);
	const constraints = await query(
		url,
		`SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
		 FROM pg_constraint
		 WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> '"_prisma_migrations"'
		 ORDER BY 1, 2`
	);
	return { columns, constraints, indexes };
}

interface MigrationRecord {
	applied_steps_count: number;
	checksum: string;
	finished: boolean;
	logs: string | null;
	migration_name: string;
}

function migrationRecords(url: string): Promise<MigrationRecord[]> {
	return query<MigrationRecord>(
		url,
		`SELECT migration_name, checksum, applied_steps_count, logs, finished_at IS NOT NULL AS finished
		 FROM "_prisma_migrations" WHERE rolled_back_at IS NULL ORDER BY migration_name`
	);
}

function prisma(args: string[], url: string): string {
	return execFileSync(PRISMA_BIN, args, {
		cwd: DB_PACKAGE_DIR,
		encoding: "utf8",
		env: { ...process.env, DATABASE_URL: url },
		stdio: "pipe",
	});
}

/** 复制一份迁移目录到临时目录，方便构造失败或被改动的场景 */
async function copyMigrations(): Promise<string> {
	const dir = await mkdtemp(path.join(tmpdir(), "migrations-"));
	await cp(MIGRATIONS_DIR, dir, { recursive: true });
	return dir;
}

const tempDirs: string[] = [];

describe("applyMigrations 和 prisma migrate deploy 兼容", () => {
	beforeAll(async () => {
		await recreateDatabases([prismaDbUrl, customDbUrl, failureDbUrl]);
		prisma(["migrate", "deploy"], prismaDbUrl);
	}, 60_000);

	afterAll(async () => {
		await Promise.all(
			tempDirs.map((dir) => rm(dir, { force: true, recursive: true }))
		);
	});

	it("空库迁移后，表结构和迁移记录与 Prisma 一致", async () => {
		const result = await applyMigrations({
			databaseUrl: customDbUrl,
			migrationsDir: MIGRATIONS_DIR,
		});

		expect(result.applied.length).toBeGreaterThan(0);
		expect(result.upToDate).toEqual([]);
		expect(await schemaSnapshot(customDbUrl)).toEqual(
			await schemaSnapshot(prismaDbUrl)
		);
		expect(await migrationRecords(customDbUrl)).toEqual(
			await migrationRecords(prismaDbUrl)
		);
	});

	it("重复执行不做任何事", async () => {
		const result = await applyMigrations({
			databaseUrl: customDbUrl,
			migrationsDir: MIGRATIONS_DIR,
		});

		expect(result.applied).toEqual([]);
		expect(result.upToDate.length).toBeGreaterThan(0);
	});

	it("Prisma 迁移过的库：校验和一致，认为已是最新", async () => {
		const result = await applyMigrations({
			databaseUrl: prismaDbUrl,
			migrationsDir: MIGRATIONS_DIR,
		});

		expect(result.applied).toEqual([]);
	});

	it("applyMigrations 迁移过的库：prisma migrate status 认为已是最新", () => {
		expect(prisma(["migrate", "status"], customDbUrl)).toContain(
			"Database schema is up to date"
		);
	});

	it("已执行的迁移被修改过时报错停下", async () => {
		const dir = await copyMigrations();
		tempDirs.push(dir);
		const [first] = (
			await query<{ migration_name: string }>(
				customDbUrl,
				`SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name LIMIT 1`
			)
		).map((row) => row.migration_name);
		await writeFile(
			path.join(dir, String(first), "migration.sql"),
			"-- changed\n",
			{ flag: "a" }
		);

		await expect(
			applyMigrations({ databaseUrl: customDbUrl, migrationsDir: dir })
		).rejects.toThrow("被修改过");
	});

	it("迁移失败时整体回滚并留下失败记录，之后拒绝继续", async () => {
		const dir = await copyMigrations();
		tempDirs.push(dir);
		const broken = path.join(dir, "99999999999999_broken");
		await mkdir(broken);
		await writeFile(
			path.join(broken, "migration.sql"),
			'CREATE TABLE "half_done" ("id" INTEGER);\nSELECT * FROM "no_such_table";\n'
		);

		await expect(
			applyMigrations({ databaseUrl: failureDbUrl, migrationsDir: dir })
		).rejects.toThrow("99999999999999_broken 执行失败");

		// 同一个迁移文件里先执行成功的语句也被回滚
		const halfDone = await query(
			failureDbUrl,
			`SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'half_done'`
		);
		expect(halfDone).toEqual([]);
		const [record] = await query<{ finished: boolean; logs: string | null }>(
			failureDbUrl,
			`SELECT finished_at IS NOT NULL AS finished, logs FROM "_prisma_migrations"
			 WHERE migration_name = '99999999999999_broken'`
		);
		expect(record?.finished).toBe(false);
		expect(record?.logs).toContain("no_such_table");

		await expect(
			applyMigrations({ databaseUrl: failureDbUrl, migrationsDir: dir })
		).rejects.toThrow("上次执行失败");
	});
});
