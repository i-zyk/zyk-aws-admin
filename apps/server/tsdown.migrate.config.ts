import { defineConfig } from "tsdown";

/**
 * 迁移 Lambda 的部署包：src/migrate-lambda.ts 连同 pg 打进一个 ESM 文件，
 * 再把 packages/db/prisma/migrations 原样复制到 migrations/。
 * 产物 dist-migrate/index.mjs，Handler 为 index.handler。
 */
export default defineConfig({
	clean: true,
	// 复制整个目录，产物里是 dist-migrate/migrations/<迁移名>/migration.sql
	copy: [{ from: "../../packages/db/prisma/migrations", to: "./dist-migrate" }],
	deps: {
		alwaysBundle: [/.*/],
	},
	entry: { index: "./src/migrate-lambda.ts" },
	format: "esm",
	outDir: "./dist-migrate",
	platform: "node",
	sourcemap: true,
	target: "node24",
});
