import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		// globalSetup 准备测试库，并把测试库地址交给 setupFiles，
		// 测试进程里的 DATABASE_URL 一律指向测试库，避免读写开发库的数据
		globalSetup: ["./vitest.global-setup.ts"],
		include: ["src/**/*.test.ts"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
