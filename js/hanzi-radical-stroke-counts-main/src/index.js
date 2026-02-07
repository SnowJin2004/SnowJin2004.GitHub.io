// import zdicRadicalStrokeCountsData from "./dataSource/zdic_radical_stroke_counts.json" assert { type: "json" };

// export function queryRadicalStrokeCount(hanzi) {
//   return zdicRadicalStrokeCountsData[hanzi];
// }

// 在模块的顶层定义一个变量来存储笔画数据
let zdicRadicalStrokeCountsData = {};
let isDataLoaded = false;

// 异步函数：加载并解析 JSON 数据
async function loadStrokeData() {
    try {
        // 确保 JSON 文件的路径正确
        const response = await fetch("/js/hanzi-radical-stroke-counts-main/src/dataSource/zdic_radical_stroke_counts.json");
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        zdicRadicalStrokeCountsData = await response.json();
        isDataLoaded = true;
    } catch (e) {
        console.error("Failed to load or parse zdic_radical_stroke_counts.json:", e);
        // 如果加载失败，数据对象将保持为空 {}
    }
}

/**
 * 查询汉字笔画数的主函数。
 * 注意: 这个函数必须在数据加载完成后才能调用。
 *
 * @param {string} hanzi - 要查询的单个汉字
 * @returns {Array<string | number> | undefined} [部首, 笔画数] 或 undefined
 */
export function queryRadicalStrokeCount(hanzi) {
    // 即使数据未加载，我们也尝试返回，此时会返回 undefined，
    // 在主 HTML 脚本中会被 getStrokeData 优雅地处理为 0 笔画。
    return zdicRadicalStrokeCountsData[hanzi];
}

// 导出加载函数，供主脚本调用
export { loadStrokeData };