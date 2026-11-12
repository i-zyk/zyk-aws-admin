import { buttonVariants } from "@zyk-aws-admin/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@zyk-aws-admin/ui/components/empty";
import Link from "next/link";

/** 「记录不存在」（R06-AC4）：ID 不合法和接口返回 RECORD_NOT_FOUND 时共用 */
export function RecordNotFound() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>记录不存在</EmptyTitle>
				<EmptyDescription>该记录可能已被删除，或链接地址有误</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link className={buttonVariants()} href="/github-users">
					返回列表
				</Link>
			</EmptyContent>
		</Empty>
	);
}
