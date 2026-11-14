"use client";

import { ArrowUpRight, Check, CodeXml, Users } from "lucide-react";
import { useCallback, useState } from "react";

import { ModeToggle } from "@/components/mode-toggle";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export default function LoginPage() {
	const [showSignIn, setShowSignIn] = useState(true);
	const handleSwitchToSignUp = useCallback(() => {
		setShowSignIn(false);
	}, []);
	const handleSwitchToSignIn = useCallback(() => {
		setShowSignIn(true);
	}, []);

	return (
		<div className="grid min-h-svh lg:grid-cols-2">
			<section className="relative hidden flex-col justify-between overflow-hidden bg-sidebar-accent px-14 py-12 text-sidebar-accent-foreground lg:flex">
				<div className="flex items-center gap-3 font-semibold text-xl">
					<CodeXml className="size-7" />
					GitSpace
				</div>
				<div className="relative mx-auto w-full max-w-lg py-16">
					<div
						aria-hidden="true"
						className="mb-12 flex size-20 items-center justify-center rounded-3xl border border-primary/20 bg-card/70 shadow-sm"
					>
						<Users className="size-9" />
					</div>
					<p className="mb-5 text-xs tracking-[0.2em]">
						A SPACE FOR YOUR CONNECTIONS
					</p>
					<h2 className="font-semibold text-5xl leading-[1.3] tracking-tight">
						连接优秀开发者，
						<br />
						让发现成为积累。
					</h2>
					<p className="mt-6 max-w-sm text-sm leading-8">
						属于你的 GitHub
						用户工作台。把每一位值得关注的开发者，变成清晰、有序、持续更新的人脉。
					</p>
					<ul className="mt-10 flex flex-col gap-4 text-sm">
						{[
							"搜索 GitHub，发现优秀开发者",
							"用标签和备注，建立专属名单",
							"随时同步，掌握最新公开资料",
						].map((text) => (
							<li className="flex items-center gap-3" key={text}>
								<Check className="size-4" />
								{text}
							</li>
						))}
					</ul>
				</div>
				<p className="flex items-center gap-2 text-xs">
					Built for meaningful connections
					<ArrowUpRight className="size-3.5" />
				</p>
			</section>
			<section className="flex min-w-0 flex-col bg-card px-5 py-8 sm:px-12">
				<div className="flex items-center justify-between">
					<span className="font-semibold text-lg lg:invisible">GitSpace</span>
					<ModeToggle />
				</div>
				<div className="my-auto py-12">
					{showSignIn ? (
						<SignInForm onSwitchToSignUp={handleSwitchToSignUp} />
					) : (
						<SignUpForm onSwitchToSignIn={handleSwitchToSignIn} />
					)}
				</div>
				<p className="text-center text-muted-foreground text-xs">
					你的开发者人脉，从一次发现开始。
				</p>
			</section>
		</div>
	);
}
