import type { ReactNode } from "react";

// 只有 http:// 或 https:// 开头的地址才渲染成链接，其余（javascript:、data:、无协议）按纯文本显示（R03-AC10）
const SAFE_URL_PATTERN = /^https?:\/\//i;

export function isSafeExternalUrl(url: string): boolean {
	return SAFE_URL_PATTERN.test(url.trim());
}

/** 新窗口打开的外链；地址不安全时只显示文字，不渲染 `<a>` */
export function ExternalLink({
	href,
	children,
	className,
}: {
	href: string;
	children?: ReactNode;
	className?: string;
}) {
	const content = children ?? href;
	if (!isSafeExternalUrl(href)) {
		return <span className={className}>{content}</span>;
	}
	return (
		<a
			className={className ?? "break-all underline underline-offset-4"}
			href={href.trim()}
			rel="noopener noreferrer"
			target="_blank"
		>
			{content}
		</a>
	);
}
