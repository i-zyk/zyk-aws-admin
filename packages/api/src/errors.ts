// 业务错误码：放进 TRPCError.cause，由 index.ts 的 errorFormatter 取出，
// 写进 error.data.appCode / error.data.resetAt，前端按 appCode 显示中文提示。
import { TRPCError } from "@trpc/server";

export const AppCode = {
	GITHUB_RATE_LIMITED: "GITHUB_RATE_LIMITED",
	GITHUB_SEARCH_INVALID: "GITHUB_SEARCH_INVALID",
	GITHUB_SEARCH_RATE_LIMITED: "GITHUB_SEARCH_RATE_LIMITED",
	GITHUB_UNAVAILABLE: "GITHUB_UNAVAILABLE",
	GITHUB_USER_ALREADY_SAVED: "GITHUB_USER_ALREADY_SAVED",
	GITHUB_USER_NOT_FOUND: "GITHUB_USER_NOT_FOUND",
	RECORD_NOT_FOUND: "RECORD_NOT_FOUND",
} as const;

export type AppCode = (typeof AppCode)[keyof typeof AppCode];

export type TrpcErrorCode = TRPCError["code"];

export interface AppErrorExtra {
	/** 原始错误，只用于服务端排查，不返回给前端 */
	cause?: unknown;
	/** 错误信息，默认用 appCode；前端优先按 appCode 显示中文提示 */
	message?: string;
	/** 限流错误的重置时间，毫秒时间戳 */
	resetAt?: number;
}

/** 承载业务错误码的 cause，errorFormatter 通过 instanceof 识别 */
export class AppErrorCause extends Error {
	readonly appCode: AppCode;
	readonly resetAt: number | null;

	constructor(appCode: AppCode, resetAt: number | null, cause?: unknown) {
		super(appCode, cause === undefined ? undefined : { cause });
		this.name = "AppErrorCause";
		this.appCode = appCode;
		this.resetAt = resetAt;
	}
}

/** 创建带业务错误码的 TRPCError */
export const appError = (
	code: TrpcErrorCode,
	appCode: AppCode,
	extra: AppErrorExtra = {}
): TRPCError =>
	new TRPCError({
		cause: new AppErrorCause(appCode, extra.resetAt ?? null, extra.cause),
		code,
		message: extra.message ?? appCode,
	});

export interface AppErrorData {
	appCode: AppCode | null;
	resetAt: number | null;
}

/** 从 TRPCError 中取出业务错误码；没有时都为 null */
export const getAppErrorData = (error: TRPCError): AppErrorData => {
	const { cause } = error;
	if (cause instanceof AppErrorCause) {
		return { appCode: cause.appCode, resetAt: cause.resetAt };
	}
	return { appCode: null, resetAt: null };
};
