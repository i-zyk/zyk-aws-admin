"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@zyk-aws-admin/ui/components/avatar";
import Image from "next/image";

export function GithubAvatar({ login, src }: { login: string; src: string }) {
	return (
		<Avatar size="lg">
			<AvatarImage
				alt={login}
				className="absolute inset-0 aria-hidden:invisible"
				keepMounted
				render={
					<Image
						alt={login}
						height={40}
						src={src}
						unoptimized={process.env.NODE_ENV === "development"}
						width={40}
					/>
				}
				src={src}
			/>
			<AvatarFallback>{login.slice(0, 2).toUpperCase()}</AvatarFallback>
		</Avatar>
	);
}
