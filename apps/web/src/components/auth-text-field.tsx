import { Input } from "@zyk-aws-admin/ui/components/input";
import { Label } from "@zyk-aws-admin/ui/components/label";
import {
	type ChangeEvent,
	type HTMLInputTypeAttribute,
	useCallback,
} from "react";

type FieldErrors = ({ message?: string } | undefined)[];

/** 登录、注册表单的提交按钮状态：可否提交、是否提交中 */
export const selectSubmitState = (state: {
	canSubmit: boolean;
	isSubmitting: boolean;
}): { canSubmit: boolean; isSubmitting: boolean } => ({
	canSubmit: state.canSubmit,
	isSubmitting: state.isSubmitting,
});

/** 登录、注册表单共用的文本输入：标签 + 输入框 + 校验错误 */
export function AuthTextField({
	label,
	name,
	type,
	value,
	errors,
	onBlur,
	onValueChange,
}: {
	label: string;
	name: string;
	type?: HTMLInputTypeAttribute;
	value: string;
	errors: FieldErrors;
	onBlur: () => void;
	onValueChange: (value: string) => void;
}) {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			onValueChange(event.target.value);
		},
		[onValueChange]
	);

	return (
		<div className="space-y-2">
			<Label htmlFor={name}>{label}</Label>
			<Input
				id={name}
				name={name}
				onBlur={onBlur}
				onChange={handleChange}
				type={type}
				value={value}
			/>
			{errors.map((error) => (
				<p className="text-red-500" key={error?.message}>
					{error?.message}
				</p>
			))}
		</div>
	);
}
