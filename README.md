# 🧭 Qimen - 基于 AI 的奇门遁甲在线起局与决策引擎

> **结合传统术数与现代 AI 语言模型，在 iOS 桌面打造你的私人决策智库。**

本项目是一个基于 iOS/iPadOS [Scriptable](https://scriptable.app/) 的自动化脚本集合。它利用“时家奇门拆补转盘法”进行高精度排盘，并无缝对接 Google Gemini 大语言模型，针对您的具体问题生成图文并茂、逻辑严密的决策卡片。

## ✨ 核心特性

- **🚀 一键起局与推演**：无需在多个 App 间跳转，运行脚本输入问题，直接生成涵盖九宫、神星门仪、马星、空亡、寄宫的全维度盘面。
- **🧠 深度 AI 解析**：对接 Gemini 模型，自动提取用神，分析五行生克与特殊格局，提供极具同理心的策略建议与避坑指南。
- **🎨 极客风全屏 UI**：内置高度定制的 HTML 渲染引擎，生成黑金配色的沉浸式玄学仪表盘，支持高亮值符/值使与各项神煞。
- **🔌 快捷指令原生 API**：提供专属的 API 接口脚本，可无缝接入 iOS Shortcuts 工作流，一键返回结构化的高阶排盘 JSON 数据。
- **🔒 绝对隐私安全**：API Key 使用 iOS 硬件级 Keychain (钥匙串) 本地加密存储，代码库零泄露风险。
- **📦 历史归档系统**：每次推演自动在本地 iCloud 生成时间戳备份（JSON格式），方便随时复盘。
- **🌐 智能网络适配**：原生支持切换 Gemini 官方直连接口或国内自定义代理/中继接口。

---

## 🛠️ 准备工作

1. **设备要求**：一台 iPhone 或 iPad。
2. **必备软件**：在 App Store 免费下载 [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)。
3. **获取 API Key**：前往 [Google AI Studio](https://aistudio.google.com/) 申请一个免费的 Gemini API Key。

---

## 📥 安装指南

1. 下载本仓库的所有 `.js` 文件。
2. 将它们移动到你手机的 **iCloud Drive / Scriptable** 文件夹中。
3. *注意：首次运行主程序时，脚本会自动联网下载日历底层依赖库 `lunar-javascript`，请保持网络畅通。*

---

## 🚀 如何使用 (All-in-One 模式)

这是最推荐的傻瓜式用法：
1. 打开 Scriptable App，找到 `QimenOrchestrator` 脚本，点击运行（或将其添加到桌面小组件点击运行）。
2. **首次配置**：系统会弹窗要求输入您的 Gemini API Key，输入后将永久加密保存在本地。
3. **输入问题**：在弹出的对话框中，输入您当下想预测的具体事情（例如：“明天的大客户谈判能顺利拿下吗？”）。
4. **等待推演**：稍等几秒钟，AI 将自动分析局象，屏幕将弹出一张精美的全屏决策卡片。

*(💡 提示：如果需要更改 API 代理地址，请直接在 `QimenOrchestrator.js` 文件顶部修改 `API_URL` 变量。)*

---

## 🔗 进阶用法 (接入 iOS 快捷指令)

对于喜欢自定义自动化工作流的高阶玩家，本项目提供了 `QimenShortcutsAPI.js` 作为本地数据接口：
1. 在 iOS 快捷指令中添加**“运行脚本 (Run Script)”**操作，选择 `QimenShortcutsAPI`。
2. **可选传参**：可通过快捷指令文本传入特定时间（格式：`YYYY-MM-DD-HH-mm`）进行指定时间起局；若不传参则默认使用当前时间。
3. **输出结果**：该脚本将返回一个完美格式化的 JSON 文本，包含四柱、神煞（含日/时空亡与马星）、局数信息及九宫详细飞布（含寄宫逻辑），你可以利用这些数据喂给其他大模型或进行二次开发。

---

## 📂 文件结构说明

- `QimenOrchestrator.js`：**主程序入口**。负责获取输入、调度起局、组装 Prompt、请求 AI、存盘及渲染 HTML 前端。
- `QimenShortcutsAPI.js`：**快捷指令接口**。专为 iOS Shortcuts 设计的 JSON 数据输出模块。
- `QimenCalculations.js`：包含奇门遁甲的核心推演算法（天地盘、九星八门八神飞布）。
- `QimenConstants.js`：静态数据字典（二十四节气局数、洛书轨迹等）。
- `QimenUtils.js`：抽象的数组旋转、干支提取等数学工具函数。

---

## 🙏 鸣谢 (Acknowledgments)

- 底层干支与节气计算强依赖于优秀的开源日历库：[lunar-javascript](https://github.com/6tail/lunar-javascript) 
- 感谢 Google Gemini 提供强大的多模态解析能力。

---

## 📄 开源协议

本项目基于 **MIT License** 开源。您可以自由使用、修改和分发，但请保留原作者声明。玄学推演结果仅供参考，请理性决策。
