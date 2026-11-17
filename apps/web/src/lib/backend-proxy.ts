import { AwsClient } from "aws4fetch";

/**
 * 把 Better Auth（/api/auth/*）和 tRPC（/trpc/*）请求签名后转发给 AWS 上的后端。
 *
 * 后端 API Gateway 只接受 SigV4 签名的请求（AWS_IAM 鉴权），签名用 Worker 专用 IAM 用户的访问密钥，
 * 这个用户只有调用这个接口的权限。浏览器的请求由自定义 Worker 入口（apps/web/worker.ts）转发，
 * 服务端渲染检查登录（require-session.ts）也直接调用这里，不绕回自己的域名。
 */

/** Worker 的配置：BACKEND_URL 写在 wrangler.jsonc 的 vars，两个密钥是 Worker secrets */
export interface BackendEnv {
	AWS_ACCESS_KEY_ID?: string;
	AWS_SECRET_ACCESS_KEY?: string;
	BACKEND_URL?: string;
}

const BACKEND_PATH = /^\/(?:api\/auth|trpc)(?:\/|$)/;

/** 真实客户端 IP 的请求头，和 packages/auth 的 CLIENT_IP_HEADER 一致；后端注册和登录限流按它计数 */
const CLIENT_IP_HEADER = "x-client-ip";

/**
 * 只转发后端用得到的请求头。不整体复制：
 * - Cloudflare 运行时会改写部分请求头（比如 accept-encoding），被签名的头一旦被改，签名就对不上；
 * - cf-*、x-forwarded-* 等内部头和客户端自带的 x-client-ip 不应该传到后端。
 * content-type 和 user-agent 不参与签名（aws4fetch 的规则），user-agent 后端会记进会话表。
 */
const FORWARDED_HEADERS = [
	"accept",
	"content-type",
	"cookie",
	"origin",
	"user-agent",
] as const;

const EXECUTE_API_HOST = /\.execute-api\.([a-z0-9-]+)\.amazonaws\.com$/;

export function isBackendPath(pathname: string): boolean {
	return BACKEND_PATH.test(pathname);
}

/**
 * 签名后把请求转发给后端，响应原样返回（状态码、Set-Cookie、流式响应体）。
 * 客户端 IP 只取 Cloudflare 写入的 CF-Connecting-IP（客户端无法伪造），覆盖客户端自带的 x-client-ip。
 */
export async function forwardToBackend(
	request: Request,
	env: BackendEnv
): Promise<Response> {
	const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BACKEND_URL } = env;
	const region = BACKEND_URL
		? EXECUTE_API_HOST.exec(new URL(BACKEND_URL).hostname)?.[1]
		: undefined;
	if (!(AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && region)) {
		// 只说缺了什么，不打印任何值
		console.error(
			"后端转发未配置：需要 BACKEND_URL（execute-api 地址）、AWS_ACCESS_KEY_ID、AWS_SECRET_ACCESS_KEY"
		);
		return Response.json(
			{ message: "Backend is not configured" },
			{ status: 502 }
		);
	}

	const { pathname, search } = new URL(request.url);
	const target = new URL(pathname + search, BACKEND_URL);

	const headers = new Headers();
	for (const name of FORWARDED_HEADERS) {
		const value = request.headers.get(name);
		if (value) {
			headers.set(name, value);
		}
	}
	const clientIp = request.headers.get("cf-connecting-ip");
	if (clientIp) {
		headers.set(CLIENT_IP_HEADER, clientIp);
	}

	const aws = new AwsClient({
		accessKeyId: AWS_ACCESS_KEY_ID,
		region,
		// 默认会对 5xx 和 429 自动重试 10 次：会打乱登录限流（429）并放大请求量，这里关掉
		retries: 0,
		secretAccessKey: AWS_SECRET_ACCESS_KEY,
		service: "execute-api",
	});

	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	return aws.fetch(target, {
		// 签名要对请求体算哈希，所以先读成完整的字节；接口请求体都很小
		body: hasBody ? await request.arrayBuffer() : undefined,
		headers,
		method: request.method,
		// 后端的重定向原样交给浏览器处理
		redirect: "manual",
	});
}
