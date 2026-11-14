import { useForm } from "@tanstack/react-form";
import { Button } from "@zyk-aws-admin/ui/components/button";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";

import { AuthTextField, selectSubmitState } from "./auth-text-field";
import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{
					email: value.email,
					password: value.password,
				},
				{
					onError: (error) => {
						toast.error(getAuthErrorMessage(error.error));
					},
					onSuccess: () => {
						router.push("/github-users");
						toast.success("登录成功");
					},
				}
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("邮箱格式不正确"),
				password: z.string().min(8, "密码至少 8 位"),
			}),
		},
	});

	const handleSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			event.stopPropagation();
			form.handleSubmit();
		},
		[form]
	);

	if (isPending) {
		return <Loader />;
	}

	return (
		<div className="mx-auto w-full max-w-sm">
			<h1 className="font-semibold text-3xl tracking-tight">欢迎回来</h1>
			<p className="mt-3 mb-8 text-muted-foreground text-sm">
				登录 GitSpace，继续探索你的开发者网络。
			</p>

			<form className="flex flex-col gap-5" onSubmit={handleSubmit}>
				<div>
					<form.Field name="email">
						{(field) => (
							<AuthTextField
								errors={field.state.meta.errors}
								label="邮箱"
								name={field.name}
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								type="email"
								value={field.state.value}
							/>
						)}
					</form.Field>
				</div>

				<div>
					<form.Field name="password">
						{(field) => (
							<AuthTextField
								errors={field.state.meta.errors}
								label="密码"
								name={field.name}
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								type="password"
								value={field.state.value}
							/>
						)}
					</form.Field>
				</div>

				<form.Subscribe selector={selectSubmitState}>
					{({ canSubmit, isSubmitting }) => (
						<Button
							className="w-full"
							disabled={!canSubmit || isSubmitting}
							type="submit"
						>
							{isSubmitting ? "提交中..." : "登录"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<div className="mt-4 text-center">
				<Button onClick={onSwitchToSignUp} variant="link">
					没有账号？去注册
				</Button>
			</div>
		</div>
	);
}
