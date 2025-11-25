// 确保导入了笔画查询函数和数据加载函数
import { queryRadicalStrokeCount, loadStrokeData } from "./hanzi-radical-stroke-counts-main/src/index.js";

/* ==== 数据加载与全局变量 ==== */
// 声明一个变量来存储加载后的数据
let RAILWAY_DATA = [];
let infoNoResults = `<section><div>搜索无结果。</div><div class="multilang" lang="ja">見つかりませんでした。</div><div class="multilang" lang="en">No stations found.</div></section>`;
let infoLoading = `<section><div>正在加载数据，或数据格式有误。请联系网站管理员。</div><div class="multilang" lang="ja">読み込む中、またはデータ形式が正しくありません。</div><div class="multilang" lang="en">Loading or Syntax Error.</div></section>`

/**
 * 异步加载外部 JSON 文件。
 * @returns {Promise<void>}
 */
async function loadRailwayData() {
    console.log("Loading railway data from external JSON...");
    try {
        // 假设 JSON 文件名为 railway_data.json 且在同级目录
        const response = await fetch('/asset/jp-rail.json'); 
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        // 将全局变量 RAILWAY_DATA 赋值为加载到的数据
        RAILWAY_DATA = await response.json();
        console.log("Railway data loaded successfully.");
    } catch (error) {
        console.error("Failed to load railway data:", error);
    }
}


/* ==== Grouping maps and functions ==== */
// 浊音、半浊音、小假名、长音符与其对应的清音/行归为同一组。
const JA_GYO_MAP = [
	{ chars: "あいうえおぁぃぅぇぉゔ", group: "あ" }, // 包含 "ゔ"
	{ chars: "かきくけこがぎぐげご", group: "か" }, // 包含浊音
	{ chars: "さしすせそざじずぜぞ", group: "さ" }, // 包含浊音
	{ chars: "たちつてとだぢづでどっ", group: "た" }, // 包含浊音和促音 'っ'
	{ chars: "なにぬねの", group: "な" },
	{ chars: "はひふへほばびぶべぼぱぴぷぺぽ", group: "は" }, // 包含浊音和半浊音
	{ chars: "まみむめも", group: "ま" },
	{ chars: "やゆよゃゅょ", group: "や" }, // 包含小写 'ゃゅょ'
	{ chars: "らりるれろ", group: "ら" },
	{ chars: "わをんー", group: "わ" }, // 包含 'わ', 'を', 'ん', 长音符 'ー'
];

/**
 * 获取日文平假名的五十音组别（Gyo）。
 */
function getJapaneseGroup(ch) {
	if (!ch) return "#";
	// 规范化（如果输入是片假名，将其转换为平假名）
	let normalizedCh = ch;
	if (ch >= '\u30a1' && ch <= '\u30ff') {
		normalizedCh = String.fromCharCode(ch.charCodeAt(0) - 0x60);
	}
	for (const row of JA_GYO_MAP) {
		if (row.chars.includes(normalizedCh)) return row.group;
	}
	return "#";
}
const KOREAN_INITIALS = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];
function getKoreanGroup(ch) {
	const code = ch.charCodeAt(0);
	if (code < 0xAC00 || code > 0xD7A3) return "#";
	const idx = Math.floor((code - 0xAC00) / 588);
	return KOREAN_INITIALS[idx] || "#";
}

/**
 * 将拉丁字母字符串规范化，用于分组和模糊搜索。移除所有变音符号。
 * @param {string} s - 原始字符串。
 * @returns {string} 规范化后的字符串。
 */
function normalizeForGrouping(s) {
    if (!s) return "";
    // 使用 Unicode NFD 规范形式，然后移除所有 Mark (M) 字符
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}


/**
 * Retrieves the plain-text name for a given basis, prioritizing the
 * 'basis-text' field, and falling back to the original 'basis' field.
 * @param {object} names - The station's names object.
 * @param {string} basis - The language key (e.g., 'ja-Hira', 'zh-Hant', 'en').
 * @returns {string} The name string for functional use.
 */
function getFunctionalName(names, basis) {
    if (!names) return "";
    const textKey = basis + '-text';
    // Prioritize the -text field if it exists, otherwise use the original field
    return names[textKey] || names[basis] || "";
}

function getGroupKey(names, basis) { 
    
	const functionalName = getFunctionalName(names, basis);

	if (!functionalName) return "#";
	const ch = functionalName.charAt(0);
    
	if (basis === "ja-Hira") return getJapaneseGroup(ch);
	if (basis === "ko") return getKoreanGroup(ch);
    
    // 【修改】只检查 'en'
    if (basis === "en") {
        // 先移除变音符号，再取第一个字符（这确保 'Ō' 归入 'O' 组）
        const normalizedName = normalizeForGrouping(functionalName);
        return normalizedName.charAt(0).toUpperCase();
    }
    
	return ch.toUpperCase(); // 默认分组
}


/* ==== Precise Hiragana Sorting Function ==== */

/**
 * 预处理字符串：将片假名转换为平假名，并替换ヴァ行假名。
 * @param {string} s - 原始日文平假名/片假名字符串。
 * @returns {string} 规范化后的平假名字符串。
 */
function normalizeForComparison(s) {
	if (!s) return "";

	// 1. 将片假名转换为平假名 (使排序更统一)
	let temp = s.replace(/[\u30a1-\u30ff]/g, function (match) {
		return String.fromCharCode(match.charCodeAt(0) - 0x60);
	});

	// 2. ヴァ・ヴィ・ヴ・ヴェ・ヴォ 替换为 ば・び・ぶ・べ・ぼ (满足要求)
	temp = temp
		.replace(/ゔぁ/g, 'ば')
		.replace(/ゔぃ/g, 'び')
		.replace(/ゔ/g, 'ぶ')
		.replace(/ゔぇ/g, 'べ')
		.replace(/ゔぉ/g, 'ぼ');

	return temp;
}

/**
 * 自定义日语平假名排序函数，遵循清音→浊音→半浊音等优先级。
 */
function compareJapaneseStations(stA, stB) {
    // === MODIFIED: Use getFunctionalName ===
	const nameA = getFunctionalName(stA.names, 'ja-Hira');
	const nameB = getFunctionalName(stB.names, 'ja-Hira');
    // ========================================

	const normA = normalizeForComparison(nameA);
	const normB = normalizeForComparison(nameB);

	// Collator 1: Primary sort (Gojūon order, ignoring voicing/small kana/long vowels)
	const baseCollator = new Intl.Collator('ja', { sensitivity: 'base' });
	let comparison = baseCollator.compare(normA, normB);

	if (comparison !== 0) {
		return comparison;
	}

	// Collator 2: Secondary sort (清音 → 浊音 → 半浊音, 大假名 → 小假名)
	const accentCollator = new Intl.Collator('ja', { sensitivity: 'accent' });
	comparison = accentCollator.compare(normA, normB);

	if (comparison !== 0) {
		return comparison;
	}

	// Collator 3: Tertiary sort (母音 → 长音)
	const variantCollator = new Intl.Collator('ja', { sensitivity: 'variant' });
    // Use the functional name here for the final comparison
	return variantCollator.compare(nameA, nameB);
}

function getStrokeData(hanzi) {
	const result = queryRadicalStrokeCount(hanzi);
	if (Array.isArray(result) && typeof result[1] === 'number') {
		return result;
	}
	return ["", 0];
}

/**
 * 获取中文名称第一个汉字的笔画数。
 */
function getFirstStrokeCount(name) {
	if (!name) return 0;

	let firstHanzi = '';
	for (const char of name) {
		// 使用 Unicode 属性来判断是否为汉字（CJK统一表意文字）
		if (/\p{Script=Han}/u.test(char)) {
			firstHanzi = char;
			break;
		}
        // 如果是非汉字字符，且它不是空格或标点等应该跳过的字符，我们认为这个站名不应按笔画排序。
        if (/[A-Za-z0-9]/.test(char)) {
            return null; // 返回 null 作为特殊标记
        }
	}

	if (!firstHanzi) return 0;
	const data = getStrokeData(firstHanzi);
	return data[1] || 0;
}

/**
 * 比较两个繁体中文车站名称的笔画数。
 */
function compareChineseStrokeStations(stA, stB) {
    // === MODIFIED: Use getFunctionalName ===
	const nameA = getFunctionalName(stA.names, 'zh-Hant');
	const nameB = getFunctionalName(stB.names, 'zh-Hant');
    // ========================================

	const strokeCountA = getFirstStrokeCount(nameA);
	const strokeCountB = getFirstStrokeCount(nameB);

	// 1. 按第一个汉字的笔画数升序排序
	if (strokeCountA !== strokeCountB) {
		return strokeCountA - strokeCountB;
	}

	// 2. 笔画数相同时，fallback到字典序
	return nameA.localeCompare(nameB, 'zh-Hant');
}


/* ==== Table rendering ==== */
const COLS = ['station_icon_xlink', 'ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'ja-Hira', 'zh-Latn', 'link'];

// 【核心修改】makeRow 函数，用于根据 set 属性添加 class
function makeRow(st) {
    const isSet = st.set || [];
    
	return `<tr>` + COLS.map(k => {
		if (k === "station_icon_xlink") {
			if (!st.station_icon_xlink) return "<td></td>";
			return `<td><svg><use xlink:href="${st.station_icon_xlink}"></use></svg></td>`;
		}
		if (k === "link") return `<td class="link"><a${st.link ? ` href="${st.link}" target="_blank"` : ""}></a></td>`;
        
        // 1. 检查当前语言键 k 是否在 st.set 数组中
        let currentClasses = '';
        if (isSet.includes(k)) {
            // 2. 如果包含，则将 class 设置为 "set"
            currentClasses = 'set';
        }

        // --- Use original names for display (retains HTML markup) ---
        // Prioritize the original name for rendering, fall back to the text-only version if the original is missing.
        const content = st.names?.[k] || st.names?.[k + '-text'] || "";
        
		return `<td lang="${k}" ${currentClasses ? `class="${currentClasses}"` : ""}>${content}</td>`;
	}).join("") + `</tr>`;
}

// 批量加载的逻辑不变
function makeTable(stations, id, start = 0, batch = 100) {
    if (stations.length === 0) {
        return `<div class="table-container" data-id="${id}" data-start="0"><div>源数据为空，请联系网站管理员。</div></div>`;
    }
    const slice = stations.slice(start, start + batch);
    const rows = slice.map(makeRow).join("");
    const more = start + batch < stations.length;
    let moreHtml = more ? `<div class="load-more"><button data-id="${id}">加载更多 (${stations.length - start - batch})</button></div>` : "";

    return `<div class="table-container" data-id="${id}" data-start="${start + batch}">
                <table class="station-table"><tbody>${rows}</tbody></table>
                ${moreHtml}
            </div>`;
}

/* ==== Lazy load attach (Unchanged) ==== */
function attachLoadMore(root, stations, id) {
    const btn = root.querySelector(".load-more button");
    if (!btn) return;

    btn.addEventListener("click", () => {
        const start = parseInt(root.dataset.start, 10);
        const moreHtml = makeTable(stations, id, start, 100);
        const tmp = document.createElement("div");
        tmp.innerHTML = moreHtml;

        // 确保 tbody 存在
        const newRows = tmp.querySelectorAll("tbody tr");
        const tbody = root.querySelector("tbody");
        if (tbody && newRows.length > 0) {
            tbody.append(...newRows);
        }

        // 更新按钮状态
        const newButton = tmp.querySelector(".load-more button");
        const loadMoreContainer = root.querySelector(".load-more");
        if (loadMoreContainer) {
            loadMoreContainer.innerHTML = newButton ? newButton.outerHTML : "";
        }

        // 重新绑定事件监听器
        if (newButton) {
            attachLoadMore(root, stations, id);
        }
    });
    // 确保 IntersectionObserver 只在按钮存在时工作
    let observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && btn) {
                btn.click();
            }
        });
    });
    observer.observe(btn);
	console.log(root.querySelector(".load-more button"));
}

/**
 * 检查一个字符串是否包含**非 'ü'** 的变音符号。
 * @param {string} s - 字符串
 * @returns {boolean}
 */
function hasDiacritic(s) {
	if (!s) return false;
	
    // We check for any combined diacritics. We don't need the complex Pinyin tone logic.
    // We check for ü variants to ensure they trigger a separate check (Mode 2)
    const s_without_ue = s.replace(/[üǖǘǚǜǕǗǙǛ]/g, '');
	
	// Check the remainder for other combined diacritics
	return /[\u0300-\u036f]/.test(s_without_ue.normalize("NFD"));
}

/**
 * 检查一个车站是否匹配搜索查询。
 * **所有关于 zh-Latn (Pinyin) 的匹配逻辑已被移除。**
 */
function matchesQuery(station, query) {
	if (!query) return true;
	const q_raw = query.toLowerCase().trim();
	if (!q_raw) return true;

	const names = station.names || {};
	
    // 1. Prepare the station's name data
    // 【修改】Build search pool using plain text Functional Names, excluding zh-Latn
    const searchableKeys = COLS.filter(k => k !== 'station_icon_xlink' && k !== 'link');
    
    const name_full_raw = searchableKeys
                            .map(k => getFunctionalName(names, k)) // Get plain text for each base name
                            .join(" ")
                            .toLowerCase();
    // ===================================================================
	
	// 2. 判断查询类型
	const has_u_diaeresis_in_q = /[üǖǘǚǜǕǗǙǛ]/.test(q_raw); // Query contains ü or its variants
	
	// True if the query contains a diacritic (that is not ü)
	const isPreciseSearch = hasDiacritic(q_raw); 

	// --- Mode 1: True Precise Search (Query contains a non-ü diacritic) ---
	if (isPreciseSearch) {
		// Only match if the raw query is present in any raw name string
		if (name_full_raw.includes(q_raw)) {
			return true;
		}
		return false;
	}
	
	// --- Mode 2: ü Exact Match (Query contains ü or its variants) ---
	if (has_u_diaeresis_in_q) {
		// If query contains ü, we require an exact match of the ü-variant.
		if (name_full_raw.includes(q_raw)) {
			return true;
		}
		return false;
	}
	
	// --- Mode 3: General Fuzzy Search (ASCII or stripped Latin, including Pinyin fallback) ---
	
    // Names normalized by stripping diacritics
	const name_full_norm = normalizeForGrouping(name_full_raw);
    
    // Query normalized by stripping diacritics
	const q_norm_grouping = normalizeForGrouping(q_raw);
    
	if (name_full_norm.includes(q_norm_grouping)) {
		return true;
	}

	return false;
}


/* ==== Lines View Rendering (Modified) ==== */
function renderLines(stationQuery, lineQuery) {
    if (RAILWAY_DATA.length === 0) {
        document.getElementById("linesView").innerHTML = infoLoading;
        return;
    }

    const c = document.getElementById("linesView");
    c.innerHTML = "";

    RAILWAY_DATA.forEach(line => {
        // Line names use original keys for searching
        const lineNameMatches = !lineQuery || Object.keys(line.names || {}).some(k => 
                                    getFunctionalName(line.names, k).toLowerCase().includes(lineQuery.toLowerCase())
                                );
        if (!lineNameMatches) return;

        // Station filtering uses the robust matchesQuery
        const filteredStations = (line.stations || []).filter(st => matchesQuery(st, stationQuery));
        if (filteredStations.length === 0 && stationQuery) return;

        const sect = document.createElement("section");
        sect.style = `--line_colour: ${line.line_color || '#777'};`;

        const btn = document.createElement("div");
        btn.className = "accordion-btn";
        
        // Display line names
        btn.innerHTML = `
            <div class="line-dot">
                ${line.icon_xlink ? `<svg><use xlink:href="${line.icon_xlink}"></use></svg>` : `<svg fill="var(--line_colour)"><use xlink:href="../img/icon/railway.svg#Ecomo"></use></svg>`}
                <span lang="ja">${line.names?.ja || line.names?.['ja-text'] || ""}</span>
                <span lang="en">${line.names?.en || line.names?.['en-text'] || ""}</span>
                <span lang="zh-Hans">${line.names?.['zh-Hans'] || line.names?.['zh-Hans-text'] || ""}</span>
                <span lang="zh-Hant">${line.names?.['zh-Hant'] || line.names?.['zh-Hant-text'] || ""}</span>
                <span lang="ko">${line.names?.ko || line.names?.['ko-text'] || ""}</span>
            </div>`;

        const panel = document.createElement("div");
        panel.className = "panel";
        panel.innerHTML = makeTable(filteredStations, `line-${line.line_id}`, 0, 100);

        const shouldOpen = stationQuery && filteredStations.length > 0;
        if (shouldOpen) {
            btn.classList.add("open");
            panel.classList.add("open");
            panel.style.maxHeight = 'max-content';
        }

        btn.onclick = () => {
            btn.classList.toggle("open");
            panel.classList.toggle("open");
            panel.style.maxHeight = panel.classList.contains("open") ? `calc(${panel.scrollHeight}px + 0.5rem)` : 0;
			console.log(start + batch)
        };

        sect.appendChild(btn);
        sect.appendChild(panel);
        c.appendChild(sect);

        attachLoadMore(panel, filteredStations, `line-${line.line_id}`);
    });

    if (stationQuery && c.children.length === 0) {
        c.innerHTML = infoNoResults;
    }
}

/* ==== Index View Rendering (Updated) ==== */
function renderIndex(query) {
    if (RAILWAY_DATA.length === 0) {
        document.getElementById("indexView").innerHTML = infoLoading;
        return; 
    }

	const basis = document.getElementById("sortBasis").value;
	const currentQuery = query || document.getElementById("searchStationInput").value;
    
    // 1. 提取并去重所有车站
    const uniqueStationsMap = new Map();

    RAILWAY_DATA.forEach(line => {
        (line.stations || []).forEach(st => {
            const stationId = st.station_id || st.id || st.names?.ja || JSON.stringify(st.names);

            if (!uniqueStationsMap.has(stationId)) {
                uniqueStationsMap.set(stationId, st);
            }
        });
    });

    const allUniqueStations = Array.from(uniqueStationsMap.values());
    
	// 2. 对去重后的车站列表进行搜索过滤
	const stations = allUniqueStations.filter(st => matchesQuery(st, currentQuery));

	const grouped = {};

	stations.forEach(st => {
		let key = "";

		if (basis === "zh-Hant-Stroke") {
			const name = getFunctionalName(st.names, 'zh-Hant');
			const strokeCount = getFirstStrokeCount(name);
            
            if (strokeCount === null) {
                key = "#";
            } else {
                key = strokeCount.toString();
            }

			if (key === "0") key = "?";
		} else {
			key = getGroupKey(st.names, basis);
		}

		(grouped[key] = grouped[key] || []).push(st);
	});

	Object.keys(grouped).forEach(k => {
		const stationList = grouped[k];

		if (basis === "ja-Hira") {
			stationList.sort(compareJapaneseStations);
		} else if (basis === "zh-Hant-Stroke") {
			stationList.sort(compareChineseStrokeStations);
		}
		else {
			// 其他排序（English/Korean）：组内按字母顺序排序
			stationList.sort((stA, stB) => {
                // === MODIFIED: Use getFunctionalName for sorting ===
				const nameA = getFunctionalName(stA.names, basis);
				const nameB = getFunctionalName(stB.names, basis);
                // =================================================
                
                // 【修改开始】只保留英文的多级排序，移除 zh-Latn 的排序逻辑
                if (basis === 'en') {
                    // 1. Primary sort: 忽略变音符号 (例如 o == ō)
                    const baseCollator = new Intl.Collator('en', { sensitivity: 'base' });
                    let comparison = baseCollator.compare(nameA, nameB);
                    
                    if (comparison !== 0) {
                        return comparison;
                    }

                    // 2. Secondary sort: 区分变音符号
                    const accentCollator = new Intl.Collator('en', { sensitivity: 'accent' });
                    return accentCollator.compare(nameA, nameB);
                }
                // 【修改结束】

                // Fallback to default localeCompare for other bases (ko)
				return nameA.localeCompare(nameB, basis === 'en' ? 'en' : 'zh', { sensitivity: 'base' });
			});
		}
	});

	const c = document.getElementById("indexView"); c.innerHTML = "";

	// 排序分组键
	const sortedKeys = Object.keys(grouped).sort((a, b) => {
		if (basis === "zh-Hant-Stroke") {
			if (a === "#") return -1;
			if (b === "#") return 1;
			if (a === "?") return 1;
			if (b === "?") return -1;
			return parseInt(a, 10) - parseInt(b, 10);
		}
		return a.localeCompare(b);
	});

	sortedKeys.forEach(k => {
		const stationList = grouped[k];

		const sect = document.createElement("section");
		sect.style = `--line_colour: var(--theme_colour);`
		const btn = document.createElement("div");
		btn.className = "accordion-btn";

		const badgeContent = basis === "zh-Hant-Stroke"
			? (k === "?" ? "0" : `${k}`)
			: k;

		btn.innerHTML = `<div class="badge">${badgeContent}</div>`;

		const panel = document.createElement("div"); panel.className = "panel";
		panel.innerHTML = makeTable(stationList, `idx-${k}`, 0, 100);

		const shouldOpen = currentQuery && stationList.length > 0;
		if (shouldOpen) {
			btn.classList.add("open");
			panel.classList.add("open");
			panel.style.maxHeight = 'max-content';
		}

		btn.onclick = () => {
			btn.classList.toggle("open");
			panel.classList.toggle("open");
			panel.style.maxHeight = panel.classList.contains("open") ? `calc(${panel.scrollHeight}px + 0.5rem)` : 0;
		};
		sect.appendChild(btn); sect.appendChild(panel); c.appendChild(sect);
		attachLoadMore(panel, stationList, `idx-${k}`);
	});

	if (currentQuery && c.children.length === 0) {
		c.innerHTML = infoNoResults;
	}
}

/* ==== Mode switching (Unchanged) ==== */
let currentMode = "lines"; // 记录当前模式

document.getElementById("modeSelector").addEventListener("click", e => {
    if (!e.target.dataset.mode) return;

    // 切换按钮的激活状态
    document.querySelectorAll("#modeSelector button").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");

    currentMode = e.target.dataset.mode;

    // 切换视图时，隐藏所有视图并显示对应的视图
    ["linesView", "indexView"].forEach(id => document.getElementById(id).style.display = "none");

    // 控制 sortBasis 和 searchLineInput 的显示逻辑
    document.getElementById("sortBasis").style.display = currentMode === "index" ? "inline-block" : "none";
    document.getElementById("searchLineInput").style.display = currentMode === "lines" ? "inline-block" : "none";

    // 渲染对应的视图
    const currentStationQuery = document.getElementById("searchStationInput").value;
    const currentLineQuery = document.getElementById("searchLineInput").value;

    if (currentMode === "lines") {
        renderLines(currentStationQuery, currentLineQuery);
        document.getElementById("linesView").style.display = "block";
    }
    if (currentMode === "index") {
        renderIndex(currentStationQuery);
        document.getElementById("indexView").style.display = "block";
    }
});

document.getElementById("sortBasis").addEventListener("change", () => {
	// 当排序基准改变，并且当前视图是 Index 视图时，需要重新渲染
	if (currentMode === "index") {
		renderIndex();
	}
});

// 搜索输入框事件监听器 (Unchanged)
document.getElementById("searchStationInput").addEventListener("input", e => {
	const query = e.target.value;
	if (currentMode === "lines") {
		renderLines(query);
	} else if (currentMode === "index") {
		renderIndex(query);
	}
});
document.getElementById("searchLineInput").addEventListener("input", e => {
    const lineQuery = e.target.value;
    const stationQuery = document.getElementById("searchStationInput").value;
    if (currentMode === "lines") {
        renderLines(stationQuery, lineQuery);
    }
});

document.getElementById("searchLineInput").style.display = "none";

	
// 页面加载时设置控件的显示状态
document.addEventListener("DOMContentLoaded", () => {
	// 根据当前模式设置控件的显示状态
	document.getElementById("sortBasis").style.display = currentMode === "index" ? "inline-block" : "none";
	document.getElementById("searchLineInput").style.display = currentMode === "lines" ? "inline-block" : "none";
});

// 切换模式的事件监听器
document.getElementById("modeSelector").addEventListener("click", e => {
	if (!e.target.dataset.mode) return;

	// 切换按钮的激活状态
	document.querySelectorAll("#modeSelector button").forEach(b => b.classList.remove("active"));
	e.target.classList.add("active");

	currentMode = e.target.dataset.mode;

	// 切换视图时，隐藏所有视图并显示对应的视图
	["linesView", "indexView"].forEach(id => document.getElementById(id).style.display = "none");

	// 控制 sortBasis 和 searchLineInput 的显示逻辑
	document.getElementById("sortBasis").style.display = currentMode === "index" ? "inline-block" : "none";
	document.getElementById("searchLineInput").style.display = currentMode === "lines" ? "inline-block" : "none";

	// 渲染对应的视图
	const currentStationQuery = document.getElementById("searchStationInput").value;
	const currentLineQuery = document.getElementById("searchLineInput").value;

	if (currentMode === "lines") {
		renderLines(currentStationQuery, currentLineQuery);
		document.getElementById("linesView").style.display = "block";
	}
	if (currentMode === "index") {
		renderIndex(currentStationQuery);
		document.getElementById("indexView").style.display = "block";
	}
});

/* Init */
// 定义一个初始化函数，并等待所有数据加载
async function init() {
	// 1. **加载外部 JSON 数据**
    await loadRailwayData();
    
    // 2. **加载汉字笔画数据**
	console.log("Loading Chinese stroke data...");
	await loadStrokeData();
	console.log("Data loaded. Rendering content.");

	// 渲染初始视图
	renderLines();
}

init();