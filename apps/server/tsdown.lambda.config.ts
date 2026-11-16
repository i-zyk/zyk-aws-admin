import { defineConfig } from "tsdown";

/**
 * Lambda 部署包：所有依赖（包括 Prisma 生成的客户端和查询引擎）打进一个 ESM 文件，
 * 部署时不需要 node_modules。产物 dist-lambda/index.mjs，Handler 为 index.handler。
 */
export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: [/.*/],
	},
	entry: { index: "./src/lambda.ts" },
	format: "esm",
	outDir: "./dist-lambda",
	platform: "node",
	sourcemap: true,
	target: "node24",
});
