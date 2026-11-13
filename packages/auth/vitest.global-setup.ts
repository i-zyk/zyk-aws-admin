import { prepareTestDatabase } from "@zyk-aws-admin/db/testing";
import type { TestProject } from "vitest/node";

declare module "vitest" {
	export interface ProvidedContext {
		testDatabaseUrl: string;
	}
}

/**
 * auth 用独立的测试库（`<库名>_auth_test`）：`turbo run test` 会和 api 的测试并行，
 * 共用一个库时双方清空数据会互相干扰。
 */
const AUTH_TEST_DATABASE_SUFFIX = "_auth_test";

export default async function setup(project: TestProject): Promise<void> {
	const testDatabaseUrl = await prepareTestDatabase(
		process.env.DATABASE_URL,
		AUTH_TEST_DATABASE_SUFFIX
	);
	project.provide("testDatabaseUrl", testDatabaseUrl);
}
