"use client";

import { Button } from "@zyk-aws-admin/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@zyk-aws-admin/ui/components/dropdown-menu";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback } from "react";

export function ModeToggle() {
	const { setTheme } = useTheme();
	const handleLight = useCallback(() => {
		setTheme("light");
	}, [setTheme]);
	const handleDark = useCallback(() => {
		setTheme("dark");
	}, [setTheme]);
	const handleSystem = useCallback(() => {
		setTheme("system");
	}, [setTheme]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button size="icon" variant="outline" />}>
				<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
				<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
				<span className="sr-only">Toggle theme</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleLight}>Light</DropdownMenuItem>
				<DropdownMenuItem onClick={handleDark}>Dark</DropdownMenuItem>
				<DropdownMenuItem onClick={handleSystem}>System</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
