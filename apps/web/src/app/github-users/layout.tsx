import { requireSession } from "@/lib/require-session";

// 布局和各 page 都校验：共享布局在客户端切换页面时不会重新渲染。
export default async function GithubUsersLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	await requireSession();

	return children;
}
