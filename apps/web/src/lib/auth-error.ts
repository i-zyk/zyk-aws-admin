// 注册、登录表单的错误提示：把 Better Auth 客户端返回的错误转成中文提示。

/** Better Auth 客户端 onError 回调里 error.error 的结构（只取用到的字段） */
export interface AuthClientError {
	code?: string;
	message?: string;
	status: number;
	statusText: string;
}

const HTTP_TOO_MANY_REQUESTS = 429;

const RATE_LIMITED_MESSAGE = "操作过于频繁，请稍后再试";
const EMAIL_ALREADY_REGISTERED_MESSAGE = "该邮箱已注册";
const DEFAULT_AUTH_ERROR_MESSAGE = "操作失败，请稍后重试";

const EMAIL_ALREADY_REGISTERED_CODES: ReadonlySet<string> = new Set([
	"USER_ALREADY_EXISTS",
	"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

/** 按「限流 → 邮箱已注册 → 原消息」的顺序取提示，限流时不再显示其他提示 */
export const getAuthErrorMessage = (error: AuthClientError): string => {
	if (error.status === HTTP_TOO_MANY_REQUESTS) {
		return RATE_LIMITED_MESSAGE;
	}
	if (error.code && EMAIL_ALREADY_REGISTERED_CODES.has(error.code)) {
		return EMAIL_ALREADY_REGISTERED_MESSAGE;
	}
	return error.message || error.statusText || DEFAULT_AUTH_ERROR_MESSAGE;
};
