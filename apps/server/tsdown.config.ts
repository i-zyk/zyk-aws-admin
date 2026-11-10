import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: [/@zyk-aws-admin\/.*/],
	},
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
});
