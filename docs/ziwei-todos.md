# 紫微解读待办

## 等待原书页面（用户提供）

- [ ] 提供《命理天机》中星曜吉煞分组（六吉、六煞、禄存、天马）的论述页，以及亮度等级顺序（庙、旺、得、利、平、不、陷）的论述页。
  - 用途：为 `knowledge/ziwei/ontology/stars.yaml` 补摘录，把 `sanfang_aggregate`、`jia_palace`、`brightness_state` 三类特征方法从 `pending_source` 升为 `reviewed`。
  - 提供方式：截取相关页面图片即可，不需要整本 PDF。
- [ ] 提供《命理天机》第三章各星入十二宫的论述（先做命宫、官禄、财帛、夫妻、迁移、福德六宫）与第五章「推断步骤和分类规则集锦」（p416 起），用于 M2。
- [ ] 提供《飞星紫微斗数》第六卷（p249 起）看命总论与十二宫禄权科忌庙照论，用于 M3 的四化修正项。

## 需要确认的设计决策

- [ ] 各主题的维度（facet）清单是否采用设计文档 §6.2 的草案；确认后才能给现有 23 条命题标注维度并实现 L4 主题合成（标注需要重新审核）。
- [ ] Stage 8 Activation Resolver 的连接口径：动态命宫与本命主题宫「重叠」是否只算同宫，还是包括对宫、三合（PRD 已列操作符，但每种连接是否都能单独作为作用点需要来源确认）。

参见 [`ziwei-interpretation-model-design.md`](./ziwei-interpretation-model-design.md) §11、§14、§16。
