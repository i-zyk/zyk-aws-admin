"use client";

import { cn } from "@zyk-aws-admin/ui/lib/utils";
import {
	ArrowUpRight,
	BookOpen,
	ChevronRight,
	CodeXml,
	Search,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

const navigation = [
	{ href: "/github-users", icon: Users, label: "用户名单" },
	{ href: "/github-users/new", icon: Search, label: "发现用户" },
] as const;

export default function AppShell({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	if (pathname === "/login") {
		return <main id="main-content">{children}</main>;
	}
	const discovering = pathname.startsWith("/github-users/new");
	return (
		<div className="min-h-svh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
			<a
				className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:p-3"
				href="#main-content"
			>
				跳到主要内容
			</a>
			<aside className="flex flex-col border-sidebar-border border-r bg-sidebar px-5 py-6 lg:sticky lg:top-0 lg:h-svh">
				<Link className="flex items-center gap-3 px-2" href="/github-users">
					<span className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background">
						<CodeXml className="size-5" />
					</span>
					<span className="font-semibold text-lg tracking-tight">
						GitSpace
						<span className="mt-0.5 block font-normal text-[10px] text-muted-foreground tracking-[0.18em]">
							USER WORKSPACE
						</span>
					</span>
				</Link>
				<p className="mt-10 mb-3 hidden px-3 text-[10px] text-muted-foreground tracking-[0.16em] lg:block">
					工作空间
				</p>
				<nav
					aria-label="主导航"
					className="mt-5 flex gap-2 lg:mt-0 lg:flex-col"
				>
					{navigation.map(({ href, label, icon: Icon }) => {
						const active =
							href === "/github-users/new" ? discovering : !discovering;
						return (
							<Link
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors hover:bg-sidebar-accent",
									active
										? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
										: "text-muted-foreground"
								)}
								href={href}
								key={href}
							>
								<Icon className="size-4" />
								{label}
								{active ? (
									<ChevronRight className="ml-auto hidden size-3.5 lg:block" />
								) : null}
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto hidden flex-col gap-5 pt-8 lg:flex">
					<div className="rounded-xl border border-sidebar-border p-4">
						<BookOpen className="mb-3 size-5 text-primary" />
						<p className="font-medium text-sm">让每一次发现都有迹可循</p>
						<p className="mt-2 text-muted-foreground text-xs leading-6">
							收藏开发者，用标签和备注整理你的 GitHub 人脉。
						</p>
						<Link
							className="mt-3 flex items-center gap-2 font-medium text-primary text-xs"
							href="/github-users/new"
						>
							发现更多开发者
							<ArrowUpRight className="size-3.5" />
						</Link>
					</div>
					<div className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
						<CodeXml className="size-3.5" />
						GitHub 用户管理后台
					</div>
				</div>
			</aside>
			<div className="min-w-0">
				<header className="flex h-18 items-center justify-between gap-3 border-b bg-card px-5 sm:px-9">
					<div className="flex items-center gap-3 text-xs">
						<span className="text-muted-foreground">工作空间</span>
						<ChevronRight className="size-3 text-muted-foreground" />
						<span>{discovering ? "发现用户" : "用户名单"}</span>
					</div>
					<div className="flex items-center gap-3">
						<ModeToggle />
						<UserMenu />
					</div>
				</header>
				<main id="main-content">{children}</main>
			</div>
		</div>
	);
}
