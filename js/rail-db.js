/* ==== 数据加载与全局变量 ==== */
let RAILWAY_DATA = [];
let STROKE_DB = new Map(); 
let infoNoResults = `<section><div>搜索无结果。</div><div class="multilang" lang="ja">見つかりませんでした。</div><div class="multilang" lang="en">No stations found.</div></section>`;
let infoLoading = `<section><div>正在加载数据...</div><div class="multilang" lang="ja">読み込み中...</div><div class="multilang" lang="en">Loading...</div></section>`;

async function loadRailwayData() {
    try {
        const response = await fetch('/asset/jp-rail.json'); 
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const rawData = await response.json();
        RAILWAY_DATA = processRailwayData(rawData);
    } catch (error) {
        console.error("Failed to load railway data:", error);
    }
}

function renderAsset(path, type, fallback = '') {
    if (!path) {
        // 如果路径为空且提供了 fallback，则返回 fallback
        return fallback;
    }

    if (type.endsWith('_xlink')) {
        // 如果属性名以 _xlink 结尾，渲染为 SVG
        return `<svg><use xlink:href="${path}"></use></svg>`;
    }

    if (type.endsWith('_img')) {
        // 如果属性名以 _img 结尾，渲染为 IMG
        return `<img src="${path}" alt="">`;
    }

    // 默认返回空字符串
    return '';
}

/**
 * 预处理数据：实现线路切片逻辑 (Line Slicing)
 * 允许彩蛋线路通过引用其他线路的车站来构造自己
 */
function processRailwayData(data) {
    const lineMap = new Map();
    data.forEach(l => lineMap.set(l.line_id, l));

    return data.map(line => {
        // 如果线路定义了 slice_from，则从源线路动态获取车站
        if (line.is_hidden && line.slice_from && Array.isArray(line.slice_from)) {
            let virtualStations = [];

            line.slice_from.forEach(config => {
                const sourceLine = lineMap.get(config.source_id);
                if (!sourceLine || !sourceLine.stations) return;

                let part = [...sourceLine.stations];
                
                // 处理切片索引 (类似 Python slice)
                const start = config.range?.[0] !== undefined ? config.range[0] : 0;
                const end = config.range?.[1] !== undefined ? config.range[1] : part.length;
                
                // 转换负数索引
                const realStart = start < 0 ? part.length + start : start;
                const realEnd = end < 0 ? part.length + end : end;
                
                part = part.slice(realStart, realEnd);

                // 处理倒序
                if (config.reverse) {
                    part.reverse();
                }

                virtualStations = virtualStations.concat(part);
            });

            return { ...line, stations: virtualStations };
        }
        return line;
    });
}

async function loadStrokeCsv() {
    try {
        const response = await fetch('/asset/zh-Hant-Stroke.csv'); 
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const csvText = await response.text();
        const lines = csvText.split(/\r?\n/);
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            const hanzi = parts[0];
            const totalStrokes = parts[4];
            if (hanzi && totalStrokes) STROKE_DB.set(hanzi, parseInt(totalStrokes, 10));
        }
    } catch (error) {
        console.error("Failed to load stroke CSV:", error);
    }
}

/* ==== 辅助工具与 Map ==== */
const JA_GYO_MAP = [
	{ chars: "あいうえおぁぃぅぇぉゔ", group: "あ" },
	{ chars: "かきくけこがぎぐげご", group: "か" },
	{ chars: "さしすせそざじずぜぞ", group: "さ" },
	{ chars: "たちつてとだぢづでどっ", group: "た" },
	{ chars: "なにぬねの", group: "な" },
	{ chars: "はひふへほばびぶべぼぱぴぷぺぽ", group: "は" },
	{ chars: "まみむめも", group: "ま" },
	{ chars: "やゆよ", group: "や" },
	{ chars: "らりるれろ", group: "ら" },
	{ chars: "わを", group: "わ" },
];

function getJapaneseGroup(ch) {
	if (!ch) return "#";
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

function normalizeForGrouping(s) {
    if (!s) return "";
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

const PINYIN_TONE_WEIGHT = {
    'ā': 1, 'ē': 1, 'ī': 1, 'ō': 1, 'ū': 1, 'ǖ': 1,
    'á': 2, 'é': 2, 'í': 2, 'ó': 2, 'ú': 2, 'ǘ': 2,
    'ǎ': 3, 'ě': 3, 'ǐ': 3, 'ǒ': 3, 'ǔ': 3, 'ǚ': 3,
    'à': 4, 'è': 4, 'ì': 4, 'ò': 4, 'ù': 4, 'ǜ': 4
};

function getToneLevel(syllable) {
    for (const char of syllable) {
        if (PINYIN_TONE_WEIGHT[char]) return PINYIN_TONE_WEIGHT[char];
    }
    return 5;
}

function pinyinToSyllables(str) {
    if (!str) return [];
    const chunks = str.split(/[\s\-’']+/).filter(Boolean);
    const allSyllables = [];
    const syllableRegex = /([bpmfdtnlgkhjqxzcs]h?|r|y|w)?([aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+(ng|n|r)?)|([0-9]+)/gi;
    chunks.forEach(chunk => {
        const matches = [...chunk.matchAll(syllableRegex)];
        matches.forEach(m => allSyllables.push(m[0].toLowerCase()));
    });
    return allSyllables;
}

function getFunctionalName(names, basis) {
    if (!names) return "";
    const textKey = basis + '-text';
    return names[textKey] || names[basis] || "";
}

function getGroupKey(names, basis) { 
	const functionalName = getFunctionalName(names, basis);
	if (!functionalName) return "#";
    if (basis === "zh-Latn" || basis === "en") {
        const norm = normalizeForGrouping(functionalName);
        let first = norm.charAt(0);
        if (first === 'Ü') first = 'U';
        return /^[A-Z]$/.test(first) ? first : "#";
    }
	const ch = functionalName.charAt(0);
	if (basis === "ja-Hira") return getJapaneseGroup(ch);
	if (basis === "ko") return getKoreanGroup(ch);
	return ch.toUpperCase();
}

/* ==== 排序逻辑 ==== */
function normalizeForComparison(s) {
	if (!s) return "";
	let temp = s.replace(/[\u30a1-\u30ff]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
	temp = temp.replace(/ゔぁ/g, 'ば').replace(/ゔぃ/g, 'び').replace(/ゔ/g, 'ぶ').replace(/ゔぇ/g, 'べ').replace(/ゔぉ/g, 'ぼ');
	return temp;
}

function compareJapaneseStations(stA, stB) {
	const nameA = getFunctionalName(stA.names, 'ja-Hira');
	const nameB = getFunctionalName(stB.names, 'ja-Hira');
	const normA = normalizeForComparison(nameA);
	const normB = normalizeForComparison(nameB);
	const baseCollator = new Intl.Collator('ja', { sensitivity: 'base' });
	let comp = baseCollator.compare(normA, normB);
	if (comp !== 0) return comp;
	const accentCollator = new Intl.Collator('ja', { sensitivity: 'accent' });
	comp = accentCollator.compare(normA, normB);
	if (comp !== 0) return comp;
	return new Intl.Collator('ja', { sensitivity: 'variant' }).compare(nameA, nameB);
}

function getFirstStrokeCount(name) {
	if (!name) return -1;
	const firstChar = name.charAt(0);
	if (!/\p{Script=Han}/u.test(firstChar)) return -1;
	const strokes = STROKE_DB.get(firstChar);
	return (strokes !== undefined) ? strokes : null;
}

function compareChineseStrokeStations(stA, stB) {
	const nameA = getFunctionalName(stA.names, 'zh-Hant');
	const nameB = getFunctionalName(stB.names, 'zh-Hant');
	const strokeA = getFirstStrokeCount(nameA);
	const strokeB = getFirstStrokeCount(nameB);
	if (strokeA !== strokeB) {
        const valA = strokeA === null ? 999 : (strokeA === -1 ? -1 : strokeA);
        const valB = strokeB === null ? 999 : (strokeB === -1 ? -1 : strokeB);
        return valA - valB;
    }
	return nameA.localeCompare(nameB, 'zh-Hant');
}

/* ==== 渲染核心 ==== */
const COLS = ['station_icon_xlink', 'ja', 'en', 'zh-Hans', 'zh-Hant', 'ko', 'ja-Hira', 'zh-Latn', 'link'];

function makeRow(st, line_dab_xlink) {
    const isSet = st.set || [];
    return `<tr>` + COLS.map(k => {
		if (k === "station_icon_xlink" || k === "station_icon_img") {
			let iconLink = st[k];
			if (!iconLink) {
                if (line_dab_xlink) {
                    return `<td>${renderAsset(line_dab_xlink, k)}</td>`;
                }
            }
			return `<td>${renderAsset(iconLink, k)}</td>`;
		}
		if (k === "link") return `<td class="link"><a${st.link ? ` href="${st.link}" target="_blank"` : ""}></a></td>`;
        let cls = isSet.includes(k) ? 'class="set"' : '';
        const content = st.names?.[k] || st.names?.[k + '-text'] || "";
		return `<td lang="${k}" ${cls}>${content}</td>`;
	}).join("") + `</tr>`;
}

function prepareLazyPanel(stations, id, line_dab_xlink) {
    return `<div class="table-container lazy-load" data-id="${id}" data-dab-xlink="${line_dab_xlink || ''}">
                <div class="lazy-placeholder">${renderAsset(line_dab_xlink, 'dab_xlink')}</div>
            </div>`;
}

function performLazyRender(container, stations, basis, line_dab_xlink, doSort = true) {
    if (container.classList.contains('rendered')) return;
    if (doSort) {
        if (basis === "ja-Hira") {
            stations.sort(compareJapaneseStations);
        } else if (basis === "zh-Hant-Stroke") {
            stations.sort(compareChineseStrokeStations);
        } else {
            stations.sort((stA, stB) => {
                const nameA = getFunctionalName(stA.names, basis);
                const nameB = getFunctionalName(stB.names, basis);
                if (basis === 'zh-Latn') {
                    const rawA = getFunctionalName(stA.names, 'zh-Latn');
                    const rawB = getFunctionalName(stB.names, 'zh-Latn');
                    const hantA = getFunctionalName(stA.names, 'zh-Hant');
                    const hantB = getFunctionalName(stB.names, 'zh-Hant');
                    const pA = pinyinToSyllables(rawA);
                    const pB = pinyinToSyllables(rawB);
                    const maxLen = Math.max(pA.length, pB.length);
                    for (let i = 0; i < maxLen; i++) {
                        if (pA[i] === undefined) return -1; if (pB[i] === undefined) return 1;
                        const baseComp = pA[i].localeCompare(pB[i], 'en', { sensitivity: 'base', numeric: true });
                        if (baseComp !== 0) return baseComp;
                        const tA = getToneLevel(pA[i]); const tB = getToneLevel(pB[i]);
                        if (tA !== tB) return tA - tB;
                        const sA = (hantA[i] && STROKE_DB.get(hantA[i])) || 0;
                        const sB = (hantB[i] && STROKE_DB.get(hantB[i])) || 0;
                        if (sA !== sB) return sA - sB;
                        if (hantA[i] !== hantB[i]) return (hantA[i]||"").localeCompare(hantB[i]||"", 'zh-Hant');
                    }
                    return hantA.localeCompare(hantB, 'zh-Hant');
                }
                if (basis === 'en') {
                    const coll = new Intl.Collator('en', { sensitivity: 'base' });
                    let res = coll.compare(nameA, nameB);
                    return res !== 0 ? res : new Intl.Collator('en', { sensitivity: 'accent' }).compare(nameA, nameB);
                }
                return nameA.localeCompare(nameB, basis === 'en' ? 'en' : 'zh', { sensitivity: 'base' });
            });
        }
    }

    const batchSize = 100;
    const slice = stations.slice(0, batchSize);
    const rows = slice.map(st => makeRow(st, line_dab_xlink)).join("");
    
    container.innerHTML = `<table class="station-table"><tbody>${rows}</tbody></table>`;
    container.dataset.start = batchSize;
    container.classList.add('rendered');
    container.classList.remove('lazy-load');

    if (stations.length > batchSize) {
        const moreBtn = document.createElement("div");
        moreBtn.className = "load-more";
        moreBtn.innerHTML = `<button>加载更多（${stations.length - batchSize}）</button>`;
        container.after(moreBtn);
        attachLoadMore(container.parentElement, stations, container.dataset.id, line_dab_xlink);
    }
}

function attachLoadMore(root, stations, id, line_dab_xlink) {
    const btn = root.querySelector(".load-more button");
    if (!btn) return;
    const tableContainer = root.querySelector('.table-container');
    btn.onclick = () => {
        const start = parseInt(tableContainer.dataset.start, 10);
        const nextBatch = stations.slice(start, start + 100);
        const rowsHtml = nextBatch.map(st => makeRow(st, line_dab_xlink)).join("");
        tableContainer.querySelector("tbody").insertAdjacentHTML('beforeend', rowsHtml);
        tableContainer.dataset.start = start + 100;
        const remaining = stations.length - (start + 100);
        if (remaining <= 0) {
            root.querySelector(".load-more").remove();
        } else {
            btn.textContent = `加载更多（${remaining}）`;
        }
        if (root.classList.contains("open")) {
            root.style.maxHeight = `calc(${root.scrollHeight}px + 1rem)`;
        }
    };
}

/* ==== 搜索逻辑 ==== */
const EXPLICIT_DIACRITICS = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜâêîôû";

function pinyinSearchNormalize(str, isQuery = false) {
    if (!str) return "";
    let s = str.normalize("NFC").toLowerCase();
    if (isQuery) s = s.replace(/v/g, 'ü');
    const map = {
        'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a', 'â': 'a',
        'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e', 'ê': 'e',
        'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i', 'î': 'i',
        'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o', 'ô': 'o',
        'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u', 'û': 'u',
        'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü'
    };
    let result = "";
    for (const char of s) {
        if (char === 'ü' || map[char] === 'ü') {
            result += 'ü';
        } else if (map[char]) {
            result += map[char];
        } else {
            result += char;
        }
    }
    return result;
}

function matchesQuery(station, query) {
    if (!query) return true;
    const qRaw = query.normalize("NFC").toLowerCase().trim();
    const searchableKeys = COLS.filter(k => k !== 'station_icon_xlink' && k !== 'link');
    const names = searchableKeys.map(k => getFunctionalName(station.names, k));
    const hasExplicitTone = qRaw.split('').some(char => EXPLICIT_DIACRITICS.includes(char));
    return names.some(name => {
        if (!name) return false;
        const nLow = name.normalize("NFC").toLowerCase();
        if (hasExplicitTone) {
            const qTarget = qRaw.replace(/v/g, 'ü');
            return nLow.includes(qTarget);
        }
        const qNorm = pinyinSearchNormalize(qRaw, true);
        const nNorm = pinyinSearchNormalize(nLow, false);
        let targetForMatch = nNorm;
        if (qNorm.includes('u') && !qNorm.includes('ü')) {
            targetForMatch = targetForMatch.replace(/ü/g, 'u');
        }
        return targetForMatch.includes(qNorm);
    });
}

/* ==== 视图渲染入口 ==== */
function renderLines(stationQuery, lineQuery) {
    const c = document.getElementById("linesView");
    if (RAILWAY_DATA.length === 0) { c.innerHTML = infoLoading; return; }
    c.innerHTML = "";

    // 【彩蛋逻辑】
    const isEasterEggTriggered = (lineQuery === "おまけ" || lineQuery === "彩蛋");

    RAILWAY_DATA.forEach(line => {
        const isHidden = line.is_hidden === true;

        if (isEasterEggTriggered) {
            if (!isHidden) return;
        } else {
            if (isHidden) return;
        }

        const filteredStations = (line.stations || []).filter(st => matchesQuery(st, stationQuery));
        if (stationQuery && filteredStations.length === 0) return;

        if (!isEasterEggTriggered && lineQuery) {
            const lineNameMatch = Object.keys(line.names || {}).some(k => 
                getFunctionalName(line.names, k).toLowerCase().includes(lineQuery.toLowerCase())
            );
            if (!lineNameMatch) return;
        }

        const sect = document.createElement("section");
        sect.style = `--line_colour: ${line.line_color || '#777'};`;
        
        const btn = document.createElement("div");
        btn.className = "accordion-btn";

        // 彩蛋线路可能只有 ja 名称，其余语言显示为空
        btn.innerHTML = `<div class="line-dot cjk-latn">
			${renderAsset(line.icon_img || line.icon_xlink, line.icon_img ? 'icon_img' : 'icon_xlink', `<svg fill="var(--line_colour)"><use xlink:href="../img/icon/railway.svg#Ecomo"></use></svg>`)}
			${Object.entries(line.names || {}).map(([lang, name]) => {
				if (!name) return '';
				return `<span lang="${lang}">${name}</span>`;
			}).join('')}
		</div>`;

		const panel = document.createElement("div");
		panel.className = "panel";
		panel.innerHTML = prepareLazyPanel(filteredStations, `line-${line.line_id}`, line.dab_xlink);

        const shouldOpen = !!stationQuery;
        if (shouldOpen) {
            btn.classList.add("open");
            panel.classList.add("open");
            performLazyRender(panel.querySelector('.table-container'), filteredStations, 'ja-Hira', line.dab_xlink, false);
            panel.style.maxHeight = 'max-content';
        }

        btn.onclick = () => {
            btn.classList.toggle("open");
            panel.classList.toggle("open");
            if (panel.classList.contains("open")) {
                performLazyRender(panel.querySelector('.table-container'), filteredStations, 'ja-Hira', line.dab_xlink, false);
                panel.style.maxHeight = `calc(${panel.scrollHeight}px + 1rem)`;
            } else {
                panel.style.maxHeight = 0;
            }
        };

        sect.appendChild(btn); sect.appendChild(panel); c.appendChild(sect);
    });

    if (c.children.length === 0) c.innerHTML = infoNoResults;
}

function renderIndex(query) {
    const c = document.getElementById("indexView");
    if (RAILWAY_DATA.length === 0) { c.innerHTML = infoLoading; return; }
	const basis = document.getElementById("sortBasis").value;
	const currentQuery = query || document.getElementById("searchStationInput").value;
    
    const uniqueMap = new Map();
    RAILWAY_DATA.forEach(line => {
        if (line.is_hidden) return; 

        (line.stations || []).forEach(st => {
            const sid = st.station_id || st.id || st.names?.ja;
            if (!uniqueMap.has(sid)) {
                st._fallback_dab_xlink = line.dab_xlink;
                uniqueMap.set(sid, st);
            }
        });
    });

	const filtered = Array.from(uniqueMap.values()).filter(st => matchesQuery(st, currentQuery));
	const grouped = {};
	filtered.forEach(st => {
        let key;
        if (basis === "zh-Hant-Stroke") {
            const strokes = getFirstStrokeCount(getFunctionalName(st.names, 'zh-Hant'));
            if (strokes === -1) key = "#";
            else if (strokes === null) key = "?";
            else key = strokes.toString();
        } else {
            key = getGroupKey(st.names, basis);
        }
		if (!key || key === "null") key = "#";
        (grouped[key] = grouped[key] || []).push(st);
	});

    c.innerHTML = "";
	const sortedKeys = Object.keys(grouped).sort((a, b) => {
		if (basis === "zh-Hant-Stroke") {
			if (a === "#") return -1; if (b === "#") return 1;
            if (a === "?") return 1; if (b === "?") return -1;
			return parseInt(a, 10) - parseInt(b, 10);
		}
		return a.localeCompare(b);
	});

	sortedKeys.forEach(k => {
		const stations = grouped[k];
		const sect = document.createElement("section");
		sect.style = `--line_colour: var(--theme_colour);`;
		const btn = document.createElement("div");
		btn.className = "accordion-btn";
		btn.innerHTML = `<div class="badge">${k}</div>`;
		const panel = document.createElement("div");
        panel.className = "panel";
		panel.innerHTML = prepareLazyPanel(stations, `idx-${k}`);

		if (currentQuery) {
			btn.classList.add("open");
			panel.classList.add("open");
            performLazyRender(panel.querySelector('.table-container'), stations, basis, undefined, true);
			panel.style.maxHeight = 'max-content';
		}

		btn.onclick = () => {
			btn.classList.toggle("open");
			panel.classList.toggle("open");
			if (panel.classList.contains("open")) {
                performLazyRender(panel.querySelector('.table-container'), stations, basis, undefined, true);
				panel.style.maxHeight = `calc(${panel.scrollHeight}px + 1rem)`;
			} else {
				panel.style.maxHeight = 0;
			}
		};
		sect.appendChild(btn); sect.appendChild(panel); c.appendChild(sect);
	});
	if (c.children.length === 0) c.innerHTML = infoNoResults;
}

/* ==== 事件监听器 ==== */
let currentMode = "lines";

function handleModeSwitch(e) {
    if (!e.target.dataset.mode) return;
    document.querySelectorAll("#modeSelector button").forEach(b => b.classList.remove("active"));
    e.target.classList.add("active");
    currentMode = e.target.dataset.mode;
    
    document.getElementById("linesView").style.display = currentMode === "lines" ? "block" : "none";
    document.getElementById("indexView").style.display = currentMode === "index" ? "block" : "none";
    document.getElementById("sortBasis").style.display = currentMode === "index" ? "inline-block" : "none";
    document.getElementById("searchLineInput").style.display = currentMode === "lines" ? "inline-block" : "none";

    const sQ = document.getElementById("searchStationInput").value;
    const lQ = document.getElementById("searchLineInput").value;
    currentMode === "lines" ? renderLines(sQ, lQ) : renderIndex(sQ);
}

document.getElementById("modeSelector").addEventListener("click", handleModeSwitch);
document.getElementById("sortBasis").addEventListener("change", () => currentMode === "index" && renderIndex());
document.getElementById("searchStationInput").addEventListener("input", e => {
    currentMode === "lines" ? renderLines(e.target.value, document.getElementById("searchLineInput").value) : renderIndex(e.target.value);
});
document.getElementById("searchLineInput").addEventListener("input", e => {
    renderLines(document.getElementById("searchStationInput").value, e.target.value);
});

async function init() {
    document.getElementById("linesView").innerHTML = infoLoading;
    await Promise.all([loadRailwayData(), loadStrokeCsv()]);
    renderLines();
}

init();