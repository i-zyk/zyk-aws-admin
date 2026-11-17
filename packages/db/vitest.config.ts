import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// 迁移测试自己创建和删除 *_migrate_*_test 库，不用 globalSetup 准备的共用测试库
		include: ["src/**/*.test.ts"],
		testTimeout: 30_000,
	},
});
