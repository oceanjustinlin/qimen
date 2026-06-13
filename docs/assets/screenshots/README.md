# README 截图图床

README（含英文 / 繁体）里的效果展示截图统一存放在本目录，通过 jsDelivr CDN 引用，无需任何外部图床账号。

## 引用方式

仓库是 public，jsDelivr 直接把 GitHub 文件当 CDN：

```
https://cdn.jsdelivr.net/gh/oceanjustinlin/qimen@main/docs/assets/screenshots/<文件名>
```

`@main` 表示跟随 main 分支最新内容。图片只要提交并推到 main，链接即可生效。

## 当前截图清单

| 文件名 | 内容 | README 中的位置 |
| --- | --- | --- |
| `qimen-result-card.jpg` | 奇门问事结果卡片（含「继续追问」入口） | 顶部三图、效果展示 |
| `fortune-daily.jpg` | 日运分数页（事业 / 财富 / 感情 / 健康运） | 顶部三图、运势面板 |
| `bazi-verdict.jpg` | 命局天机 / 旺衰格局 / 用神喜忌（八字断语） | 顶部三图、八字面板 |
| `bazi-add-profile.jpg` | 新增排盘资料（添加八字档案） | 八字面板 |
| `bazi-timing.jpg` | 八字深度推演 · 应期扫描（逐年推演） | 八字面板 |
| `bazi-notes.jpg` | 断事笔记（长期基调） | 效果展示 |
| `fortune-yearly.jpg` | 年运 · 岁运简批（流年十神 / 大运背景） | 运势面板 |

> 这批图来自 2026-06 的真机截图（iPhone，1278×2778，JPG）。

## 还缺的（想补可加）

以下视图本批没有截图，README 文案有提到但暂未配图，想补可按上面的引用规范加进来并更新三份 README：

- `bazi-chart.jpg` — 八字专业细盘（四柱主星 / 藏干 / 神煞网格）
- `fortune-weekly.jpg` — 周运（七日曲线）
- `fortune-monthly.jpg` — 月运（月度曲线 / 高低分日）
- `fortune-monthly-detail.jpg` — 月运详批

## 替换 / 缓存说明

- **新增或替换图片**：覆盖同名文件 → commit → push 到 main。
- **jsDelivr 缓存**：`@main` 会被 CDN 缓存一段时间。覆盖同名图后若仍显示旧图，可访问一次刷新缓存：
  `https://purge.jsdelivr.net/gh/oceanjustinlin/qimen@main/docs/assets/screenshots/<文件名>`
- 想彻底避免缓存串图，也可改用带版本号的文件名（如 `qimen-result-card-v2.jpg`）并同步更新三份 README 的引用。
