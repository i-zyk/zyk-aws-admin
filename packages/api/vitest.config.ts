import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// 同包的数据库测试共享测试库，防止 resetTestDatabase 与其他文件的用例并发。
		fileParallelism: false,
		// globalSetup 准备测试库，并把测试库地址交给 setupFiles，
		// 测试进程里的 DATABASE_URL 一律指向测试库，避免读写开发库的数据
		globalSetup: ["./vitest.global-setup.ts"],
		include: ["src/**/*.test.ts"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
