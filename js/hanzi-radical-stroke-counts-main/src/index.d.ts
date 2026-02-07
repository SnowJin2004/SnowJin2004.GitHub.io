// 定义返回值类型为元组 [部首，笔画]
type RadicalStrokeCountResult = [string, number];
// 查询汉字的部首、笔画
export function queryRadicalStrokeCount(hanzi: string): RadicalStrokeCountResult;