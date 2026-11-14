// 前端统一的业务错误提示：把 tRPC 错误里的 error.data.appCode 转成中文提示。
// 只从 api 导入类型，不在运行时导入服务端代码。
import type { AppCode } from "@zyk-aws-admin/api/errors";

/** 提示场景：同一个错误码在不同场景下文案不同（目前只有同步场景特殊） */
export type AppErrorScene = "default" | "sync";

const TIME_PART_LENGTH = 2;

const pad = (value: number): string =>
	String(value).padStart(TIME_PART_LENGTH, "0");

/** 把毫秒时间戳按浏览器本地时区格式化为 HH:mm 或 HH:mm:ss */
export const formatResetTime = (
	resetAt: number,
	withSeconds: boolean
): string => {
	const date = new Date(resetAt);
	const hoursAndMinutes = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
	return withSeconds
		? `${hoursAndMinutes}:${pad(date.getSeconds())}`
		: hoursAndMinutes;
};

type MessageBuilder = (resetAt: number | null, scene: AppErrorScene) => string;

const rateLimitedMessage = (
	subject: string,
	resetAt: number | null,
	withSeconds: boolean
): string =>
	resetAt === null
		? `${subject}过于频繁，请稍后重试`
		: `${subject}过于频繁，请在 ${formatResetTime(resetAt, withSeconds)} 之后重试`;

const APP_ERROR_MESSAGES: Record<AppCode, MessageBuilder> = {
	GITHUB_RATE_LIMITED: (resetAt) =>
		rateLimitedMessage("GitHub 请求", resetAt, false),
	GITHUB_SEARCH_INVALID: () => "搜索关键字不合法，请修改后重试",
	GITHUB_SEARCH_RATE_LIMITED: (resetAt) =>
		rateLimitedMessage("GitHub 搜索", resetAt, true),
	GITHUB_UNAVAILABLE: () => "GitHub 暂时无法访问，请稍后重试",
	GITHUB_USER_ALREADY_SAVED: () => "该用户已在名单中",
	GITHUB_USER_NOT_FOUND: (_resetAt, scene) =>
		scene === "sync" ? "该账号在 GitHub 上已不存在" : "GitHub 上没有找到该用户",
	RECORD_NOT_FOUND: () => "记录不存在",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isAppCode = (value: unknown): value is AppCode =>
	typeof value === "string" && Object.hasOwn(APP_ERROR_MESSAGES, value);

const getErrorData = (error: unknown): Record<string, unknown> | null => {
	if (!isRecord(error)) {
		return null;
	}
	const { data } = error;
	return isRecord(data) ? data : null;
};

/** 取出 tRPC 错误里的业务错误码；没有或无法识别时为 null */
export const getAppCode = (error: unknown): AppCode | null => {
	const appCode = getErrorData(error)?.appCode;
	return isAppCode(appCode) ? appCode : null;
};

/** 取出限流错误的重置时间（毫秒时间戳）；没有时为 null */
export const getResetAt = (error: unknown): number | null => {
	const resetAt = getErrorData(error)?.resetAt;
	return typeof resetAt === "number" && Number.isFinite(resetAt)
		? resetAt
		: null;
};

export const getTrpcCode = (error: unknown): string | null => {
	const code = getErrorData(error)?.code;
	return typeof code === "string" ? code : null;
};
const NETWORK_ERROR_PATTERN = /network|fetch|connection/i;
const DEFAULT_ERROR_MESSAGE = "操作失败，请稍后重试";

/** 把错误转成给用户看的中文提示；没有业务错误码时用 error.message */
export const getAppErrorMessage = (
	error: unknown,
	scene: AppErrorScene = "default"
): string => {
	const appCode = getAppCode(error);
	if (appCode !== null) {
		return APP_ERROR_MESSAGES[appCode](getResetAt(error), scene);
	}
	if (getTrpcCode(error) === "UNAUTHORIZED") {
		return "登录已过期，请重新登录";
	}
	if (error instanceof Error && error.message) {
		if (NETWORK_ERROR_PATTERN.test(error.message)) {
			return "无法连接服务，请检查网络后重试";
		}
		return error.message;
	}
	return DEFAULT_ERROR_MESSAGE;
};
