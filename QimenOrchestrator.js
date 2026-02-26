const fm = FileManager.iCloud(); // 使用 iCloud 方便跨设备查看文件
const BOOKMARK_NAME = "qimen"; // 最新缓存文件名 (去后缀)

// ==========================================
// 1. 初始化与依赖加载
// ==========================================
const libName = "lunar_lib";
const libPath = fm.joinPath(fm.documentsDirectory(), `${libName}.js`);

// 自动下载 Lunar 库
if (!fm.fileExists(libPath)) {
    let alert = new Alert();
    alert.title = "首次运行初始化";
    alert.message = "正在下载核心历法库，请保持网络畅通...";
    alert.addAction("确定");
    await alert.present();
    try {
        const req = new Request("https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js");
        const code = await req.loadString();
        fm.writeString(libPath, code);
    } catch (e) {
        showError("Lunar 库下载失败，请检查网络。");
        return;
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
    showError("模块加载失败: " + e.message + "\n请确保基础依赖模块已保存在同一目录下。");
    return;
}

// ==========================================
// 2. 基础配置 (API Key 与 接口地址)
// ==========================================
// ⚠️ 开源提示：请用户在此处填入自己的真实 API Key。
const apiKey = "sk-..."; // 例如 "sk-xxxxxx..."

if (!apiKey || apiKey.includes("sk-...")) {
    let a = new Alert();
    a.title = "缺少 API Key";
    a.message = "请在代码第 2 步中填入您的真实 Gemini API Key。";
    a.addAction("好的");
    await a.present();
    return;
}

// 设定 API 地址 (支持官方接口或自定义中继/代理接口)
// --------------------------------------------------
// 📍 选项 A：官方默认地址 (需全局科学上网，推荐使用 gemini-2.5-pro)
// const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

// 📍 选项 B：自定义代理/中继地址 (适合国内直连，请根据你的代理服务商说明修改)
const API_URL = `https://yinli.one/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;

// --------------------------------------------------
// ==========================================
// 3. 获取用户问题
// ==========================================
let askAlert = new Alert();
askAlert.title = "🔮 奇门遁甲 一键起局";
askAlert.message = "请在心中默念您的问题，然后输入：";
askAlert.addTextField("例如：明天的大客户谈判能顺利拿下吗？", "");
askAlert.addAction("开始推演");
askAlert.addCancelAction("取消");

let askAction = await askAlert.present();
if (askAction === -1) return; // 用户点击取消
const userQuestion = askAlert.textFieldValue(0);
if (!userQuestion.trim()) {
    showError("问题不能为空哦！");
    return;
}

// ==========================================
// 4. 核心起局运算 (内部直接计算，告别快捷指令)
// ==========================================
let dateInput = new Date();
const year = dateInput.getFullYear();
const month = dateInput.getMonth() + 1; 
const day = dateInput.getDate();
const hour = dateInput.getHours();
const minute = dateInput.getMinutes();

const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
const lunar = solar.getLunar();
const ganzhiHour = lunar.getTimeInGanZhi();
const ganzhiDay = lunar.getDayInGanZhi();

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

// 高级神煞推演
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
const maXingMap = { "寅": 6, "申": 2, "亥": 8, "巳": 0 }; 

const dayKongObj = lunar.getDayXunKong(); 
const hourKongObj = lunar.getTimeXunKong();
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

const tianRuiIndex = nineStars.indexOf("天芮");
const centerEarthStem = diPan[4]; 

// ==========================================
// 5. 拼装 九宫文本 (完美复刻你的快捷指令循环)
// ==========================================
const palaceNames = ["巽", "离", "坤", "震", "中", "兑", "艮", "坎", "乾"];
const palaceNumbers = [4, 9, 2, 3, 5, 7, 8, 1, 6];
let palacesText = "";

for (let i = 0; i < 9; i++) {
    let pName = `${palaceNames[i]}${palaceNumbers[i]}宫`;
    
    // 如果是中宫
    if (i === 4) {
        palacesText += `${pName}信息开始：地盘天干：${diPan[i]}，${pName}信息结束。\n`;
        continue;
    }

    // 判断空亡与马星
    let extra = "";
    if (dayKongIndices.includes(i) || hourKongIndices.includes(i)) extra += "本宫占空亡；";
    if (i === maXingMap[dayMa] || i === maXingMap[hourMa]) extra += "本宫有马星；";
    
    // 判断寄干
    let jiText = "";
    if (i === 2) jiText = `；地盘寄干：${centerEarthStem}`;
    if (i === tianRuiIndex) jiText += `；天盘寄干：${centerEarthStem}`;

    palacesText += `${pName}信息开始：九星：${nineStars[i]}；八神：${eightGods[i]}；八门：${eightDoors[i]}；天盘天干：${tianPanGan[i]}；地盘天干：${diPan[i]}${jiText}；${extra}${pName}信息结束。\n`;
}

// ==========================================
// 6. 组装 AI Prompt (使用模板字符串，格式极其清爽)
// ==========================================
const timestamp_solar = `${year}年${month}月${day}日 ${hour}:${minute}`;
const timestamp_lunar = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
const year_pillars = lunar.getYearInGanZhi();
const month_pillars = lunar.getMonthInGanZhi();
const day_pillars = ganzhiDay;
const hour_pillars = ganzhiHour;
const qimen_structure = `${juResult.yinYang}遁${juResult.gameNumber}局`;
const zhi_fu_palace = `落${palaceNames[nineStars.indexOf(zhiFuStar)]}${palaceNumbers[nineStars.indexOf(zhiFuStar)]}宫`;
const zhi_shi_palace = `落${palaceNames[eightDoors.indexOf(zhiShiDoor)]}${palaceNumbers[eightDoors.indexOf(zhiShiDoor)]}宫`;

const finalPrompt = `你是一位精通“时家奇门拆补转盘法”的奇门遁甲预测大师。你的分析风格严谨、理论扎实，同时具备高度的同理心，能体察求测者潜在的心理焦虑并给予温暖的指引。我起了一个奇门局，局排布信息如下：

起局时间：${timestamp_solar}(${timestamp_lunar})。
干支四柱：${year_pillars} ${month_pillars} ${day_pillars} ${hour_pillars}。${qimen_structure}。${juResult.jieQiName} ${juResult.yuanName} ；
旬首:${xunHead}。值符:${zhiFuStar} ${zhi_fu_palace}。值使:${zhiShiDoor} ${zhi_shi_palace}。
空亡：日空${dayKongObj} 时空${hourKongObj}。
驿马星：日马${dayMa} 时马${hourMa}。

${palacesText}

请记住以上信息，后面我问你问题时你要根据我提供的局式信息分析。分析逻辑如下
1. **定用神**：根据问题锁定关键宫位（如求财看生门/戊，事业看开门/年干）。
2. **断吉凶**：分析五行生克、吉凶格、空亡（能量减半）、马星（变动）。
3. **给建议**：转化成具体的行动指南。

Output Format (JSON Schema)
请严格按照以下 JSON 结构返回数据，不要输出任何 Markdown 标记：

{
  "summary": {
    "title": "短标题 (如: 大客户谈判预测)",
    "conclusion": "核心结论 (如: ✅ 极大概率成功)",
    "score": 85,
    "keyword": "关键信号 (如: 财气通门户，马星催动)"
  },
  "analysis": {
    "tensor": "时空能量 (如: 阳遁三局，金水相生)",
    "yong_shen": "用神分析 (如: 生门落巽宫属木，受生旺相)",
    "pattern": "特殊格局 (如: 癸+己华盖地户，需防文书错漏)",
    "god_help": "神助 (如: 临九地，宜长线发展)"
  },
  "advice": {
    "strategy": [
      "策略1 (如: 必须主动出击，不可坐等)",
      "策略2 (如: 重点攻克对方的技术负责人)"
    ],
    "risk": "避坑指南 (如: 防备口头承诺，必须落实纸面)",
    "lucky_tips": {
      "direction": "有利方位 (如: 西北方)",
      "time": "有利时间 (如: 未时 13-15点)",
      "action": "助运行为 (如: 穿着黑色衣物，携带金属配饰)"
    }
  }
}

务必做到有根据、有理论支持，分析的详细还要体会我问问题的心理潜在因素，照顾我的心理感受。你先分析，我下面要问你问题了。

**问题**：${userQuestion}`;
// 把最终拼好的 Prompt 打印到控制台
//console.log("========== 📤 发送给 AI 的 Prompt ==========\n" + finalPrompt + "\n==========================================");

// ==========================================
// 7. 发起网络请求 (请求 Gemini)
// ==========================================
let loadingAlert = new Alert();
loadingAlert.title = "⏳ 正在推演局象...";
loadingAlert.message = "AI 大师正在飞速解析，请稍候几分钟。";
loadingAlert.present(); // 不等待响应，直接挂在后台显示

let apiResponse = null;
let aiJsonData = null;

try {
    let req = new Request(API_URL);
    req.method = "POST";
    req.headers = { "Content-Type": "application/json" };
    req.body = JSON.stringify({
        contents: [{ parts: [{ text: finalPrompt }] }],
        generationConfig: { response_mime_type: "application/json" } // 强制返回 JSON (Gemini Pro 特性)
    });
    
    // 增加超时时间
    req.timeoutInterval = 300; 
    
    apiResponse = await req.loadJSON();
    
    // 解析 Gemini 返回格式
    if (apiResponse && apiResponse.candidates && apiResponse.candidates.length > 0) {
        let textResult = apiResponse.candidates[0].content.parts[0].text;
        // 容错：清洗可能的 Markdown 代码块
        textResult = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
        aiJsonData = JSON.parse(textResult);
    } else {
        throw new Error("API 返回的数据格式异常，未找到解析结果。");
    }
} catch (e) {
    showError("AI 解析失败: " + e.message + "\n\n排查提示：\n1. 检查 API Key 是否正确（可在代码中重置）。\n2. 检查网络代理或节点是否稳定。");
    return;
}

// ==========================================
// 8. 数据存盘 (历史归档 + 最新书签)
// ==========================================
try {
    let docDir = fm.documentsDirectory();
    
    // 存最新缓存 (qimen.json)
    let latestPath = fm.joinPath(docDir, `${BOOKMARK_NAME}.json`);
    fm.writeString(latestPath, JSON.stringify(aiJsonData));
    
    // 存历史记录 (新建 Qimen_Records 文件夹)
    let recordsDir = fm.joinPath(docDir, "Qimen_Records");
    if (!fm.fileExists(recordsDir)) fm.createDirectory(recordsDir);
    
    // 防止文件名中含有非法字符
    let safeTitle = (aiJsonData.summary.title || "未知预测").replace(/[\\\/\:\*\?\"\<\>\|]/g, "");
    let dateStr = `${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}_${String(hour).padStart(2,'0')}${String(minute).padStart(2,'0')}`;
    let historyPath = fm.joinPath(recordsDir, `qimen_${safeTitle}_${dateStr}.json`);
    
    fm.writeString(historyPath, JSON.stringify(aiJsonData));
    console.log(`✅ 存盘成功！\n最新缓存: ${latestPath}\n历史记录: ${historyPath}`);
} catch (e) {
    console.log("⚠️ 文件保存失败，但不影响结果显示: " + e.message);
}

// ==========================================
// 9. 渲染全屏网页 UI (修复漏掉的调用)
// ==========================================
// 这两行是核心：将 AI 数据传给 HTML 渲染函数，并弹出网页
WebView.loadHTML(generateHTML(aiJsonData));
Script.complete();

// ==========================================
// 辅助函数区
// ==========================================
function showError(msg) {
    let a = new Alert();
    a.title = "❌ 发生错误";
    a.message = msg;
    a.addAction("确定");
    a.present();
}

// ==========================================
// 5. 网页版生成函数 (高级精美 UI 版)
// ==========================================
function generateHTML(data) {
    // 1. 数据解构 (只提取 AI 的分析结果)
    const summary = data.summary || { title: "生成中...", conclusion: "暂无数据", score: 0 };
    const analysis = data.analysis || {};
    const advice = data.advice || { lucky_tips: {} };
    
    // 动态计算吉凶主题色
    let score = summary.score || 0;
    let THEME_COLOR_HEX = score < 60 ? "#FF5E57" : (score < 80 ? "#F5C518" : "#00D26A");

    // 2. 生成策略列表
    const strategies = (advice.strategy || []).map(s => `<li>${s}</li>`).join("");
    
    // 3. 完美复刻你的 九宫格排盘 HTML (直接读取内存中的全局变量)
    let gridCells = "";
    // 辅助函数：判断是否是值符/值使
    const isZhiFu = (star) => star && zhiFuStar && star.includes(zhiFuStar);
    const isZhiShi = (door) => door && zhiShiDoor && door.includes(zhiShiDoor);

    for (let i = 0; i < 9; i++) {
        let inner = "";
        if (i === 4) {
            // 中宫样式：巨大的背景字
            inner = `<div class="pan-center-earth">${diPan[i] || ""}</div>`;
        } else {
            // 值符/值使高亮发光
            const starClass = isZhiFu(nineStars[i]) ? "highlight-text" : "";
            const doorClass = isZhiShi(eightDoors[i]) ? "highlight-text" : "";
            
            // 马星、空亡标签
            let marks = "";
            if (i === maXingMap[dayMa] || i === maXingMap[hourMa]) marks += `<span class="pan-mark mark-ma">马</span>`;
            if (dayKongIndices.includes(i) || hourKongIndices.includes(i)) marks += `<span class="pan-mark mark-kong">空</span>`;

            // 寄宫逻辑提取
            const jiSkyStr = i === tianRuiIndex ? centerEarthStem : "";
            const jiEarthStr = i === 2 ? centerEarthStem : "";
            const jiSky = jiSkyStr ? `<div class="pan-stem ji-sky">${jiSkyStr}</div>` : "";
            const jiEarth = jiEarthStr ? `<div class="pan-stem ji-earth">${jiEarthStr}</div>` : "";

            inner = `
                <div class="pan-god">${eightGods[i] || ""}</div>
                <div class="pan-stem stem-sky">${tianPanGan[i] || ""}</div> ${jiSky}
                <div class="pan-star ${starClass}">${nineStars[i] || ""}</div>
                <div class="pan-door ${doorClass}">${eightDoors[i] || ""}</div>
                <div class="pan-stem stem-earth">${diPan[i] || ""}</div> ${jiEarth}
                <div class="pan-marks">${marks}</div>
            `;
        }
        gridCells += `<div class="pan-cell">${inner}</div>`;
    }
    
    // 组装排盘 HTML 区块
    const chartHTML = `
        <div class="section-title">
            <span class="icon">🧭</span> 奇门排盘
        </div>
        <div class="pan-wrapper">
            <div class="pan-header">
                <div class="pan-pillars">
                    ${year_pillars || '-'} ${month_pillars || '-'} ${day_pillars || '-'} ${hour_pillars || '-'}
                </div>
                <div class="pan-info">
                    ${timestamp_solar || ''} | ${qimen_structure || ''} · ${juResult.jieQiName || ''}<br>
                    值符: <b>${zhiFuStar || '-'}</b> &nbsp;&nbsp; 值使: <b>${zhiShiDoor || '-'}</b>
                </div>
            </div>
            <div class="pan-grid">${gridCells}</div>
        </div>
    `;

    // 4. 生成问题 HTML
    const questionHTML = userQuestion ? `<div class="user-question">"${userQuestion}"</div>` : "";

    // 5. 返回完整 HTML (CSS 样式保持你的原样，一字未改)
    return `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <style>
        :root {
            --theme-color: ${THEME_COLOR_HEX};
            --theme-color-dim: ${THEME_COLOR_HEX}25;
            --bg-color: #000000;
            --card-bg: #1C1C1E;
            --cell-bg: #2C2C2E;
            --border-color: #38383A;
            --text-main: #FFFFFF;
            --text-sub: #8E8E93;
        }
        body { 
            background-color: var(--bg-color); 
            color: var(--text-main); 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
            padding: 16px; 
            margin: 0; 
            -webkit-font-smoothing: antialiased;
        }
        .card { 
            background-color: var(--card-bg); 
            border-radius: 24px; 
            padding: 24px 20px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.5); 
        }
        
        /* 顶部概览 */
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .title { font-size: 16px; font-weight: 600; color: var(--text-sub); }
        .score { 
            background-color: var(--theme-color-dim); 
            color: var(--theme-color); 
            padding: 4px 12px; 
            border-radius: 12px; 
            font-weight: 800; 
            font-size: 18px; 
            box-shadow: 0 0 10px var(--theme-color-dim);
        }
        .conclusion { font-size: 26px; font-weight: 800; color: var(--theme-color); margin-bottom: 6px; line-height: 1.3; letter-spacing: 0.5px;}
        .keyword { font-size: 13px; color: var(--text-sub); margin-bottom: 20px; display: inline-block; background: var(--cell-bg); padding: 4px 10px; border-radius: 6px;}
        
        /* 用户问题 */
        .user-question {
            font-size: 14px;
            color: #E5E5EA;
            padding: 14px 16px;
            background: rgba(255,255,255,0.04);
            border-radius: 12px;
            border-left: 4px solid var(--theme-color);
            margin-bottom: 24px;
            font-style: italic;
            line-height: 1.5;
        }

        /* 通用标题 */
        .section-title { 
            color: var(--text-sub); 
            font-size: 14px; 
            font-weight: 700; 
            margin: 28px 0 12px 0; 
            display: flex; 
            align-items: center; 
            gap: 6px;
        }
        .section-title .icon { font-size: 16px; }
        
        /* 分析网格 (2x2) */
        .info-grid { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 12px; 
        }
        .grid-item { 
            background: var(--cell-bg); 
            padding: 14px; 
            border-radius: 12px; 
        }
        .label { font-size: 11px; color: var(--text-sub); display: block; margin-bottom: 6px; text-transform: uppercase;}
        .value { font-size: 13px; font-weight: 500; color: var(--text-main); line-height: 1.5; }
        
        /* 策略列表 */
        .strategy-list { list-style: none; padding: 0; margin: 0; }
        .strategy-list li { 
            position: relative; 
            padding-left: 20px; 
            margin-bottom: 12px; 
            color: #D1D1D6; 
            font-size: 14px; 
            line-height: 1.6; 
        }
        .strategy-list li::before { 
            content: "✦"; 
            position: absolute; 
            left: 0; 
            top: 1px;
            color: var(--theme-color); 
            font-size: 12px;
        }
        
        /* 底部开运锦囊 */
        .footer { 
            display: flex; 
            justify-content: space-between; 
            background: var(--theme-color-dim); 
            padding: 16px; 
            border-radius: 16px; 
            margin-top: 28px; 
        }
        .f-item { text-align: center; flex: 1; border-right: 1px solid rgba(255,255,255,0.05); }
        .f-item:last-child { border-right: none; }
        .f-icon { display: block; font-size: 20px; margin-bottom: 6px; opacity: 0.9;}
        .f-text { font-size: 13px; font-weight: 700; color: var(--theme-color); }

        /* ========= 九宫格排盘精美样式 ========= */
        .pan-wrapper { 
            background: var(--cell-bg); 
            border-radius: 16px; 
            padding: 16px; 
            border: 1px solid rgba(255,255,255,0.05);
        }
        .pan-header { text-align: center; margin-bottom: 16px; }
        .pan-pillars { font-size: 15px; font-weight: 700; color: #FFF; letter-spacing: 1px; margin-bottom: 4px; }
        .pan-info { font-size: 11px; color: #999; line-height: 1.5; }
        .pan-info b { color: var(--theme-color); font-weight: 700; }
        
        .pan-grid { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 1px; 
            background: var(--border-color); 
            border: 1px solid var(--border-color); 
            border-radius: 8px; 
            overflow: hidden;
        }
        .pan-cell { 
            background: var(--card-bg); 
            aspect-ratio: 1; 
            position: relative; 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
        }
        
        /* 中宫寄干 */
        .pan-center-earth { font-size: 32px; font-weight: 900; color: var(--text-sub); opacity: 0.15; }
        
        /* 宫内元素定位 */
        .pan-god { position: absolute; top: 6px; font-size: 10px; color: #888; letter-spacing: 1px;}
        .pan-star { font-size: 13px; color: #CCC; margin-bottom: 2px; z-index: 2; }
        .pan-door { font-size: 16px; font-weight: 800; color: #FFF; z-index: 2; letter-spacing: 1px;}
        
        .pan-stem { position: absolute; font-size: 12px; font-weight: 700; }
        .stem-sky { top: 6px; left: 8px; color: #E5E5EA; }
        .stem-earth { bottom: 6px; right: 8px; color: #8E8E93; }
        .ji-sky { top: 20px; left: 8px; font-size: 9px; color: #666; }
        .ji-earth { bottom: 20px; right: 8px; font-size: 9px; color: #666; }
        
        /* 马星空亡标记 */
        .pan-marks { position: absolute; bottom: 6px; left: 6px; display: flex; gap: 4px; z-index: 3;}
        .pan-mark { font-size: 9px; padding: 1px 4px; border-radius: 4px; font-weight: 700; }
        .mark-ma { background: var(--theme-color); color: #000; box-shadow: 0 0 4px var(--theme-color-dim); }
        .mark-kong { border: 1px solid #666; color: #999; background: rgba(0,0,0,0.3);}
        
        /* 核心吉凶高亮 */
        .highlight-text { 
            color: var(--theme-color) !important; 
            text-shadow: 0 0 10px var(--theme-color-dim); 
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="title">${summary.title}</div>
            <div class="score">${summary.score} 分</div>
        </div>
        
        <div class="conclusion">${summary.conclusion}</div>
        <div class="keyword">🔑 ${summary.keyword}</div>
        
        ${questionHTML}

        ${chartHTML}

        <div class="section-title"><span class="icon">🔍</span> 深度局象</div>
        <div class="info-grid">
            <div class="grid-item"><span class="label">🌌 时空能量</span><span class="value">${analysis.tensor || '-'}</span></div>
            <div class="grid-item"><span class="label">👤 用神分析</span><span class="value">${analysis.yong_shen || '-'}</span></div>
            <div class="grid-item"><span class="label">🔮 特殊格局</span><span class="value">${analysis.pattern || '-'}</span></div>
            <div class="grid-item"><span class="label">🙏 神助指引</span><span class="value">${analysis.god_help || '-'}</span></div>
        </div>

        <div class="section-title"><span class="icon">💡</span> 决策指引</div>
        <ul class="strategy-list">${strategies}</ul>

        <div class="footer">
            <div class="f-item"><span class="f-icon">🧭</span><span class="f-text">${advice.lucky_tips.direction || '-'}</span></div>
            <div class="f-item"><span class="f-icon">⏰</span><span class="f-text">${advice.lucky_tips.time || '-'}</span></div>
            <div class="f-item"><span class="f-icon">✨</span><span class="f-text">${advice.lucky_tips.action || '-'}</span></div>
        </div>
    </div>
</body>
</html>
    `;
}