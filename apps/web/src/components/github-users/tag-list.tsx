import { Badge } from "@zyk-aws-admin/ui/components/badge";
import { cn } from "@zyk-aws-admin/ui/lib/utils";

const EMPTY_PLACEHOLDER = "—";

/**
 * 标签徽标列表：没有标签时显示「—」。
 * 标签按纯文本渲染；同一记录内标签已去重（R07），可直接用标签本身作为 key。
 * R05 名单列表和 R06 详情页共用。
 */
export function TagList({
	tags,
	className,
}: {
	tags: readonly string[];
	className?: string;
}) {
	if (tags.length === 0) {
		return <span className="text-muted-foreground">{EMPTY_PLACEHOLDER}</span>;
	}
	return (
		<ul
			aria-label="标签"
			className={cn("flex flex-wrap items-center gap-1", className)}
		>
			{tags.map((tag) => (
				<li key={tag}>
					<Badge variant="secondary">{tag}</Badge>
				</li>
			))}
		</ul>
	);
}
