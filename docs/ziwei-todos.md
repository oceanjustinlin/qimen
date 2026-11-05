# 紫微解读待办

## 等待原书页面（用户提供）

- [ ] 提供《命理天机》中星曜吉煞分组（六吉、六煞、禄存、天马）的论述页，以及亮度等级顺序（庙、旺、得、利、平、不、陷）的论述页。
  - 用途：为 `knowledge/ziwei/ontology/stars.yaml` 补摘录，把 `sanfang_aggregate`、`jia_palace`、`brightness_state` 三类特征方法从 `pending_source` 升为 `reviewed`。
  - 提供方式：截取相关页面图片即可，不需要整本 PDF。
- [ ] 提供《命理天机》第三章各星入十二宫的论述（先做命宫、官禄、财帛、夫妻、迁移、福德六宫）与第五章「推断步骤和分类规则集锦」（p416 起），用于 M2。
- [x] 《飞星紫微斗数》第六卷 p249–270 已逐页原图校订入库（`knowledge/ziwei/sources/feixing-ziwei/`，新增 36 条摘录）：四化庙照、宫位五行受制得地、看命总论、大限重于流年、富贵贫贱杂局、星曜吉凶分组、博士十二神、诸星格局条件。
  - [ ] 待人工审核：据此把四化庙照修正项（M3）、`sanfang_aggregate` 星曜分组、`jia_palace` 夹格清单从 `pending_source` 推进到 `reviewed`；p259 星曜分组把武曲、破军列入凶曜组，需与《命理天机》交叉核对。

## 需要确认的设计决策

- [x] 维度改为跨体系共享（设计文档 §6.2、§18）。
- [ ] 审核 18 条草稿维度标注（14 条主星 → 主体状态；化禄、化权、化科 → 助力；化忌 → 制约），确认后改为 `reviewed`。
- [ ] 确认 `lib/divinationDimensions.js` 中各子类的内容维度清单。
- [ ] 是否在共享主题树中新增「自我画像 / 性格」类别：紫微、八字的整体报告目前没有对应节点（category 为 null）。新增会改变问事路由的分类 prompt，需要单独评估。
- [ ] Stage 8 Activation Resolver 的连接口径：等原书到位后再评估（案例见 2026-11-03 对话：同宫、对宫化忌、三合会照、单侧邻宫、宫位角色叠加、跨层禄忌交叠、大限作用点每年重复）。

参见 [`ziwei-interpretation-model-design.md`](./ziwei-interpretation-model-design.md) §11、§14、§16。
