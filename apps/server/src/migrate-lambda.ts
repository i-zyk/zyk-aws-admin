import path from "node:path";

import { applyMigrations } from "@zyk-aws-admin/db/migrate";

/**
 * 迁移 Lambda（VPC 内，能连数据库）。两种调用方式：
 * - CloudFormation 自定义资源（infra/api 的 Migrations）：部署时先跑迁移，成功才更新 API 函数；
 *   失败时回复 FAILED，整个部署回滚，线上继续跑旧代码。
 * - 直接调用（aws lambda invoke，事件里没有 ResponseURL）：手动补跑迁移，返回执行结果。
 *
 * 必须给 CloudFormation 回复（成功或失败），否则部署会一直等到自定义资源超时。
 * 所以所有出错路径都会回复，快超时时也先回复 FAILED。
 */

interface CustomResourceEvent {
	LogicalResourceId: string;
	RequestId: string;
	RequestType: "Create" | "Delete" | "Update";
	ResponseURL: string;
	StackId: string;
}

interface LambdaContext {
	getRemainingTimeInMillis: () => number;
}

/** 固定的物理 ID：更新时不会被当成替换，CloudFormation 也就不会再发一次 Delete */
const PHYSICAL_RESOURCE_ID = "prisma-migrations";
/** 构建时把 packages/db/prisma/migrations 复制到 Lambda 包的 migrations/ 下 */
const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");
/** 给回复 CloudFormation 留出的时间 */
const RESPONSE_MARGIN_MS = 10_000;
/** CloudFormation 回复里 Reason 的长度上限（整个回复不能超过 4KB） */
const MAX_REASON_LENGTH = 1000;

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function runMigrations() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("缺少环境变量 DATABASE_URL");
	}
	const result = await applyMigrations({
		databaseUrl,
		log: (message) => console.log(message),
		migrationsDir: MIGRATIONS_DIR,
	});
	console.log(
		`迁移完成：本次执行 ${result.applied.length} 个，已是最新 ${result.upToDate.length} 个`
	);
	return result;
}

async function respond(
	event: CustomResourceEvent,
	status: "FAILED" | "SUCCESS",
	reason: string
): Promise<void> {
	const body = JSON.stringify({
		LogicalResourceId: event.LogicalResourceId,
		PhysicalResourceId: PHYSICAL_RESOURCE_ID,
		Reason: reason.slice(0, MAX_REASON_LENGTH),
		RequestId: event.RequestId,
		StackId: event.StackId,
		Status: status,
	});
	// ResponseURL 是 S3 预签名地址，签名时没有 content-type，这里必须传空值
	const response = await fetch(event.ResponseURL, {
		body,
		headers: { "content-type": "" },
		method: "PUT",
	});
	if (!response.ok) {
		throw new Error(`回复 CloudFormation 失败：HTTP ${response.status}`);
	}
}

async function handleCustomResource(
	event: CustomResourceEvent,
	context: LambdaContext
): Promise<void> {
	// 删除栈或替换资源时不回滚数据库，直接回复成功
	if (event.RequestType === "Delete") {
		await respond(event, "SUCCESS", "删除时不处理数据库");
		return;
	}

	let timer: NodeJS.Timeout | undefined;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(
			() => reject(new Error("迁移超时，请查看迁移函数的日志")),
			Math.max(context.getRemainingTimeInMillis() - RESPONSE_MARGIN_MS, 0)
		);
	});
	try {
		const result = await Promise.race([runMigrations(), timeout]);
		await respond(
			event,
			"SUCCESS",
			`执行 ${result.applied.length} 个，已是最新 ${result.upToDate.length} 个`
		);
	} catch (error) {
		console.error("迁移失败：", errorMessage(error));
		await respond(event, "FAILED", errorMessage(error));
	} finally {
		clearTimeout(timer);
	}
}

export function handler(
	event: Partial<CustomResourceEvent> | undefined,
	context: LambdaContext
) {
	if (event?.ResponseURL) {
		return handleCustomResource(event as CustomResourceEvent, context);
	}
	return runMigrations();
}
