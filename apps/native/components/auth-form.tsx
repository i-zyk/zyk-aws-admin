import { useForm } from "@tanstack/react-form";
import {
	Button,
	FieldError,
	Input,
	type InputRef,
	Label,
	Spinner,
	TextField,
} from "heroui-native";
import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage } from "@/lib/auth-error";
import { queryClient } from "@/utils/trpc";

const credentials = {
	email: z.string().trim().pipe(z.email("请输入有效的邮箱地址")),
	password: z.string().min(8, "密码至少 8 位").max(128, "密码最多 128 位"),
};
const signInSchema = z.object({ ...credentials, name: z.string() });
const signUpSchema = z.object({
	...credentials,
	name: z.string().trim().min(2, "姓名至少 2 个字符"),
});

function validationMessage(error: unknown): string {
	if (typeof error === "string") {
		return error;
	}
	if (Array.isArray(error)) {
		return error.map(validationMessage).filter(Boolean).join("\n");
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}
	return "";
}
function selectStatus(state: {
	isSubmitting: boolean;
	errorMap: { onSubmit?: unknown };
}) {
	return {
		error: validationMessage(state.errorMap.onSubmit),
		isSubmitting: state.isSubmitting,
	};
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
	const signingUp = mode === "sign-up";
	const [requestError, setRequestError] = useState("");
	const emailRef = useRef<InputRef | null>(null);
	const passwordRef = useRef<InputRef | null>(null);
	const focusEmail = useCallback(() => emailRef.current?.focus(), []);
	const focusPassword = useCallback(() => passwordRef.current?.focus(), []);
	const form = useForm({
		defaultValues: { email: "", name: "", password: "" },
		onSubmit: async ({ value, formApi }) => {
			setRequestError("");
			try {
				const response = signingUp
					? await authClient.signUp.email({
							email: value.email.trim(),
							name: value.name.trim(),
							password: value.password,
						})
					: await authClient.signIn.email({
							email: value.email.trim(),
							password: value.password,
						});
				if (response.error) {
					setRequestError(getAuthErrorMessage(response.error));
					return;
				}
				await queryClient.cancelQueries();
				queryClient.clear();
				formApi.reset();
			} catch {
				setRequestError("无法连接服务，请检查网络后重试。已输入的内容会保留。");
			}
		},
		validators: { onSubmit: signingUp ? signUpSchema : signInSchema },
	});
	return (
		<View className="gap-5">
			<form.Subscribe selector={selectStatus}>
				{({ isSubmitting, error }) => (
					<View className="gap-5">
						{signingUp ? (
							<form.Field name="name">
								{(field) => (
									<TextField
										isDisabled={isSubmitting}
										isInvalid={field.state.meta.errors.length > 0}
									>
										<Label>姓名</Label>
										<Input
											accessibilityLabel="姓名"
											autoComplete="name"
											onBlur={field.handleBlur}
											onChangeText={field.handleChange}
											onSubmitEditing={focusEmail}
											placeholder="怎么称呼你"
											returnKeyType="next"
											submitBehavior="submit"
											value={field.state.value}
										/>
										<FieldError isInvalid={field.state.meta.errors.length > 0}>
											{validationMessage(field.state.meta.errors)}
										</FieldError>
									</TextField>
								)}
							</form.Field>
						) : null}
						<form.Field name="email">
							{(field) => (
								<TextField
									isDisabled={isSubmitting}
									isInvalid={field.state.meta.errors.length > 0}
								>
									<Label>邮箱</Label>
									<Input
										accessibilityLabel="邮箱"
										autoCapitalize="none"
										autoComplete="email"
										autoCorrect={false}
										keyboardType="email-address"
										onBlur={field.handleBlur}
										onChangeText={field.handleChange}
										onSubmitEditing={focusPassword}
										placeholder="you@example.com"
										ref={emailRef}
										returnKeyType="next"
										submitBehavior="submit"
										value={field.state.value}
									/>
									<FieldError isInvalid={field.state.meta.errors.length > 0}>
										{validationMessage(field.state.meta.errors)}
									</FieldError>
								</TextField>
							)}
						</form.Field>
						<form.Field name="password">
							{(field) => (
								<TextField
									isDisabled={isSubmitting}
									isInvalid={field.state.meta.errors.length > 0}
								>
									<Label>密码</Label>
									<Input
										accessibilityLabel="密码"
										autoCapitalize="none"
										autoComplete={
											signingUp ? "new-password" : "current-password"
										}
										autoCorrect={false}
										onBlur={field.handleBlur}
										onChangeText={field.handleChange}
										onSubmitEditing={form.handleSubmit}
										placeholder="至少 8 位密码"
										ref={passwordRef}
										returnKeyType="go"
										secureTextEntry
										value={field.state.value}
									/>
									<FieldError isInvalid={field.state.meta.errors.length > 0}>
										{validationMessage(field.state.meta.errors)}
									</FieldError>
								</TextField>
							)}
						</form.Field>
						{error ? (
							<FieldError isInvalid>
								<Text selectable>{error}</Text>
							</FieldError>
						) : null}
						{requestError ? (
							<Text
								accessibilityLiveRegion="polite"
								className="text-danger text-sm leading-6"
								selectable
							>
								{requestError}
							</Text>
						) : null}
						<Button isDisabled={isSubmitting} onPress={form.handleSubmit}>
							{isSubmitting ? (
								<Spinner color="default" size="sm" />
							) : (
								<Button.Label>{signingUp ? "创建账号" : "登录"}</Button.Label>
							)}
						</Button>
					</View>
				)}
			</form.Subscribe>
		</View>
	);
}
