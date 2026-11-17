/**
 * 执行数据库迁移，和 `prisma migrate deploy` 兼容：读 `prisma/migrations/<名称>/migration.sql`，
 * 按目录名顺序执行还没执行过的迁移，记录写在 Prisma 的 `_prisma_migrations` 表里（同样的表结构和校验和）。
 *
 * 为什么不直接跑 Prisma：Prisma 7 的 `migrate deploy` 依赖原生迁移引擎（每个平台一个约 25MB 的二进制），
 * 打进 Lambda 很麻烦。这里只依赖 pg，在 VPC 内的迁移 Lambda 里运行（apps/server/src/migrate-lambda.ts）。
 * 和 Prisma 的兼容性由 migrate.test.ts 对照真正的 `prisma migrate deploy` 验证，升级 Prisma 后要重跑。
 *
 * 和 Prisma 一致的规则：
 * - 有上次失败、没处理的迁移（finished_at 和 rolled_back_at 都为空）时拒绝继续，要先人工处理；
 * - 每个 migration.sql 作为一个整体执行（PostgreSQL 把一次提交的多条语句放在同一个隐式事务里），失败整体回滚；
 * - 执行期间持有和 Prisma 相同编号的咨询锁，不会和手动跑的 Prisma 同时迁移。
 * 比 Prisma 更严：已执行的迁移文件被改过（校验和不一致）时报错停下，不再执行后面的迁移。
 */
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "pg";

/** Prisma 迁移用的 PostgreSQL 咨询锁编号（和 prisma migrate deploy 相同） */
const PRISMA_ADVISORY_LOCK_ID = 72_707_369;

/** 和 Prisma 创建的 _prisma_migrations 表结构一致 */
const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
)`;

const PROVIDER_LINE = /^\s*provider\s*=\s*"([^"]+)"/m;

interface MigrationFile {
	checksum: string;
	name: string;
	sql: string;
}

interface MigrationRow {
	checksum: string;
	finished_at: Date | null;
	migration_name: string;
	rolled_back_at: Date | null;
}

export interface ApplyMigrationsOptions {
	databaseUrl: string;
	/** 输出进度；不会收到连接串等敏感信息 */
	log?: (message: string) => void;
	/** prisma/migrations 目录 */
	migrationsDir: string;
}

export interface ApplyMigrationsResult {
	/** 本次执行的迁移 */
	applied: string[];
	/** 之前已经执行过、校验和一致的迁移 */
	upToDate: string[];
}

function checksumOf(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

async function readMigrations(migrationsDir: string): Promise<MigrationFile[]> {
	const lock = await readFile(
		path.join(migrationsDir, "migration_lock.toml"),
		"utf8"
	);
	const provider = PROVIDER_LINE.exec(lock)?.[1];
	if (provider !== "postgresql") {
		throw new Error(
			`migration_lock.toml 的 provider 是「${provider ?? "未知"}」，只支持 postgresql`
		);
	}

	const entries = await readdir(migrationsDir, { withFileTypes: true });
	const names = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();

	const migrations = await Promise.all(
		names.map(async (name): Promise<MigrationFile | null> => {
			try {
				const sql = await readFile(
					path.join(migrationsDir, name, "migration.sql"),
					"utf8"
				);
				return { checksum: checksumOf(sql), name, sql };
			} catch {
				// 和 Prisma 一样跳过没有 migration.sql 的目录
				return null;
			}
		})
	);
	return migrations.filter((migration) => migration !== null);
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export async function applyMigrations({
	databaseUrl,
	log = () => undefined,
	migrationsDir,
}: ApplyMigrationsOptions): Promise<ApplyMigrationsResult> {
	const migrations = await readMigrations(migrationsDir);
	const client = new Client({ connectionString: databaseUrl });
	await client.connect();
	try {
		await client.query("SELECT pg_advisory_lock($1)", [
			PRISMA_ADVISORY_LOCK_ID,
		]);
		await client.query(CREATE_MIGRATIONS_TABLE);

		const { rows } = await client.query<MigrationRow>(
			`SELECT migration_name, checksum, finished_at, rolled_back_at
			 FROM "_prisma_migrations" ORDER BY started_at`
		);
		const failed = rows.find(
			(row) => row.finished_at === null && row.rolled_back_at === null
		);
		if (failed) {
			throw new Error(
				`迁移 ${failed.migration_name} 上次执行失败，需要先人工处理（修复数据库后用 prisma migrate resolve 标记），再重新部署`
			);
		}
		const applied = new Map(
			rows
				.filter((row) => row.rolled_back_at === null)
				.map((row) => [row.migration_name, row.checksum])
		);

		const localNames = new Set(migrations.map((migration) => migration.name));
		for (const name of applied.keys()) {
			if (!localNames.has(name)) {
				log(`警告：数据库里有迁移 ${name}，但本地迁移目录里没有`);
			}
		}

		const result: ApplyMigrationsResult = { applied: [], upToDate: [] };
		for (const migration of migrations) {
			// biome-ignore-start lint/performance/noAwaitInLoops: 迁移必须按顺序逐个执行，前一个失败就停下
			const appliedChecksum = applied.get(migration.name);
			if (appliedChecksum !== undefined) {
				if (appliedChecksum !== migration.checksum) {
					throw new Error(
						`迁移 ${migration.name} 执行后被修改过（校验和不一致），已停止；不要修改已上线的迁移，改动请写成新的迁移`
					);
				}
				result.upToDate.push(migration.name);
				continue;
			}

			const id = randomUUID();
			await client.query(
				`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count)
				 VALUES ($1, $2, $3, now(), 0)`,
				[id, migration.checksum, migration.name]
			);
			log(`执行迁移 ${migration.name}`);
			try {
				// 不带参数的 query 走简单查询协议：多条语句在同一个隐式事务里，失败整体回滚
				await client.query(migration.sql);
			} catch (error) {
				await client.query(
					`UPDATE "_prisma_migrations" SET logs = $2 WHERE id = $1`,
					[id, errorMessage(error)]
				);
				throw new Error(
					`迁移 ${migration.name} 执行失败：${errorMessage(error)}`,
					{ cause: error }
				);
			}
			await client.query(
				`UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`,
				[id]
			);
			result.applied.push(migration.name);
			// biome-ignore-end lint/performance/noAwaitInLoops: 同上
		}
		return result;
	} finally {
		await client.end();
	}
}
