// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: magic;
// 脚本名: QimenShortcutsAPI
// 用途: 生成全维度奇门数据，适配复杂 Prompt (包含日/时马星、空亡、寄宫逻辑)

const fm = FileManager.iCloud();
const libName = "lunar_lib";
const libPath = fm.joinPath(fm.documentsDirectory(), `${libName}.js`);

// 自动下载 Lunar 库
if (!fm.fileExists(libPath)) {
    try {
        const req = new Request("https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js");
        const code = await req.loadString();
        fm.writeString(libPath, code);
    } catch (e) {
        returnError("Lunar 库下载失败");
    }
}

let C, U, Calc, LunarLib, Solar;
try {
    C = importModule('QimenConstants');
    U = importModule('QimenUtils');
    Calc = importModule('QimenCalculations');
    LunarLib = importModule(libName);
    Solar = LunarLib.Solar;
} catch (e) {
    returnError("模块加载失败: " + e.message);
}

// ============================================================================
// 1. 时间解析
// ============================================================================
let dateInput = new Date(); 
if (args.shortcutParameter) {
    const param = args.shortcutParameter;
    const parts = param.split("-");
    if (parts.length >= 5) {
        dateInput = new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4]);
    } 
}

// ============================================================================
// 2. 核心运算
// ============================================================================
try {
    const year = dateInput.getFullYear();
    const month = dateInput.getMonth() + 1; 
    const day = dateInput.getDate();
    const hour = dateInput.getHours();
    const minute = dateInput.getMinutes();

    const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
    const lunar = solar.getLunar();
    const ganzhiHour = lunar.getTimeInGanZhi();
    const ganzhiDay = lunar.getDayInGanZhi();
    
    // 基础排盘
    const juResult = Calc.calculateJuByChaiBu(solar, C.JIEQI_JUSHU, C.YUAN_NAMES);
    const xunHead = U.getXunHead(ganzhiHour);
    const fuShou = U.getFuShou(xunHead);
    const flyStep = U.calculateFlyStep(xunHead, ganzhiHour);
    const rawTianGan = U.extractTianGan(ganzhiHour);
    const tianGan = U.resolveJiaHiding(rawTianGan, fuShou);

    const diPan = Calc.getDiPan(juResult.isYang, juResult.gameNumber);
    const zhiFuStar = Calc.getZhiFuStar(fuShou, diPan);
    const nineStars = Calc.calculateNineStars(zhiFuStar, tianGan, diPan);
    const zhiShiDoor = Calc.getZhiShiDoor(fuShou, diPan);
    const eightDoors = Calc.calculateEightDoors(juResult.isYang, zhiShiDoor, flyStep, fuShou, diPan);
    const eightGods = Calc.calculateEightGods(juResult.isYang, tianGan, diPan);
    const tianPanGan = Calc.calculateTianPan(juResult.isYang, tianGan, fuShou, diPan);

    // ============================================================================
    // 3. 高级推演 (马星、空亡、寄宫)
    // ============================================================================

    // --- 3.1 马星计算 (日马 & 时马) ---
    function getMaXing(zhi) {
        if (["申", "子", "辰"].includes(zhi)) return "寅";
        if (["寅", "午", "戌"].includes(zhi)) return "申";
        if (["巳", "酉", "丑"].includes(zhi)) return "亥";
        if (["亥", "卯", "未"].includes(zhi)) return "巳";
        return "";
    }
    const dayZhi = U.extractDiZhi(ganzhiDay);
    const hourZhi = U.extractDiZhi(ganzhiHour);
    
    const dayMa = getMaXing(dayZhi);
    const hourMa = getMaXing(hourZhi);

    // 马星落宫映射
    const maXingMap = { "寅": 6, "申": 2, "亥": 8, "巳": 0 }; // 艮, 坤, 乾, 巽

    // --- 3.2 空亡计算 (日空 & 时空) ---
    // Lunar 库返回格式如 "戌亥"
    const dayKongObj = lunar.getDayXunKong(); 
    const hourKongObj = lunar.getTimeXunKong();

    // 辅助：将地支转为宫位索引
    const zhiToPalace = {
        "子": 7, "丑": 6, "寅": 6, "卯": 3, "辰": 0, "巳": 0,
        "午": 1, "未": 2, "申": 2, "酉": 5, "戌": 8, "亥": 8
    };

    function getKongIndices(kongStr) {
        let indices = [];
        for (let char of kongStr) {
            if (zhiToPalace[char] !== undefined) indices.push(zhiToPalace[char]);
        }
        return indices;
    }
    const dayKongIndices = getKongIndices(dayKongObj);
    const hourKongIndices = getKongIndices(hourKongObj);

    // --- 3.3 寄宫逻辑 (中宫寄哪里) ---
    // 规则：
    // 1. 地盘中宫(index 4)的干，通常寄坤二宫(index 2)的地盘。
    // 2. 天盘中宫的干，随天禽星走。天禽星通常随天芮星(Tian Rui)走。
    
    // 找到天芮星的位置
    const tianRuiIndex = nineStars.indexOf("天芮");
    // 中宫的地盘干 (即 Prompt 中的 "地盘寄天干")
    const centerEarthStem = diPan[4]; 
    
    // ============================================================================
    // 4. 组装 AI 专用 JSON (Flattened Data)
    // ============================================================================
    const palaceNames = ["巽", "离", "坤", "震", "中", "兑", "艮", "坎", "乾"];
    const palaceNumbers = [4, 9, 2, 3, 5, 7, 8, 1, 6]; // 洛书数
    
    const palacesData = [];
    for (let i = 0; i < 9; i++) {
        // 构建单个宫位的详细标签
        let isDayMa = (i === maXingMap[dayMa]);
        let isHourMa = (i === maXingMap[hourMa]);
        let isDayKong = dayKongIndices.includes(i);
        let isHourKong = hourKongIndices.includes(i);
        
        // 寄宫标记
        let jiEarthStem = "";
        let jiHeavenStem = "";
        
        // 规则：坤2宫(idx 2) 永远显示地盘寄干 (中宫的地盘干)
        if (i === 2) { 
            jiEarthStem = centerEarthStem; 
        }
        
        // 规则：天芮星落宫 显示天盘寄干 (也是中宫的地盘干，因为天禽携带中宫地盘干飞到天盘)
        if (i === tianRuiIndex) {
            jiHeavenStem = centerEarthStem; // 注意：天盘寄干其实是原中宫的干飞到了天上
        }

        // 跳过中宫的详细展示 (Prompt里中宫是空的)
        if (i === 4) {
             palacesData.push({
                "index": i,
                "name": `中${palaceNumbers[i]}宫`,
                "is_center": true,
                "earth": diPan[i] // 中宫只保留地盘干
             });
             continue;
        }

        palacesData.push({
            "index": i,
            "name": `${palaceNames[i]}${palaceNumbers[i]}宫`, // 如 "巽4宫"
            "god": eightGods[i],
            "star": nineStars[i],
            "door": eightDoors[i],
            "sky": tianPanGan[i],   // 天盘干
            "earth": diPan[i],      // 地盘干
            "ji_earth": jiEarthStem, // 地盘寄天干 (Prompt: 庚)
            "ji_sky": jiHeavenStem,  // 天盘寄天干
            "ma_xing": {
                "day": isDayMa,
                "hour": isHourMa,
                "has_ma": isDayMa || isHourMa // "本宫有马星"
            },
            "kong_wang": {
                "day": isDayKong,
                "hour": isHourKong,
                "is_kong": isDayKong || isHourKong // "本宫占空亡"
            }
        });
    }

    const output = {
        "status": "success",
        "timestamp": {
            "solar": `${year}年${month}月${day}日 ${hour}:${minute}`,
            "lunar": `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`, // 腊月初二
        },
        "pillars": { // 四柱
            "year": lunar.getEightChar().getYear(),
            "month": lunar.getEightChar().getMonth(),
            "day": lunar.getEightChar().getDay(),
            "hour": ganzhiHour
        },
        "ju_info": {
            "name": `${juResult.yinYang}遁${juResult.gameNumber}局`,
            "jieqi": juResult.jieQiName,
            "yuan": juResult.yuanName,
            "xun_shou": `${xunHead}${fuShou}`, // 旬首: 甲戌己
            "zhi_fu": zhiFuStar,
            "zhi_fu_palace": `落${palaceNames[nineStars.indexOf(zhiFuStar)]}${palaceNumbers[nineStars.indexOf(zhiFuStar)]}宫`, // 落坤2宫
            "zhi_shi": zhiShiDoor,
            "zhi_shi_palace": `落${palaceNames[eightDoors.indexOf(zhiShiDoor)]}${palaceNumbers[eightDoors.indexOf(zhiShiDoor)]}宫`
        },
        "auxiliary": { // 辅助神煞
            "kong_wang": {
                "day": dayKongObj, // 辰巳
                "hour": hourKongObj // 申酉
            },
            "ma_xing": {
                "day": dayMa, // 申
                "hour": hourMa // 巳
            }
        },
        "palaces": palacesData
    };

    Script.setShortcutOutput(JSON.stringify(output));
    Script.complete();

} catch (e) {
    returnError("API运算出错: " + e.message);
}

function returnError(msg) {
    Script.setShortcutOutput(JSON.stringify({ "status": "error", "message": msg }));
    Script.complete();
}
