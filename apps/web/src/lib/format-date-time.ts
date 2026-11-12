// 名单记录的时间显示（R05 列表、R06 详情共用）。
// 固定区域格式；这些数据只在浏览器端获取，按浏览器本地时区显示。
const INVALID_DATE_PLACEHOLDER = "—";

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
	minute: "2-digit",
	month: "2-digit",
	year: "numeric",
});

/** ISO 时间 → 本地时区的 YYYY/MM/DD HH:mm；无法解析时为「—」 */
export function formatDateTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime())
		? INVALID_DATE_PLACEHOLDER
		: DATE_TIME_FORMAT.format(date);
}
