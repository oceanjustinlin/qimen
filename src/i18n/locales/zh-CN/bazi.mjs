// 由 i18n 抽取脚本维护的词条（JSON 结构）。键名约定见 docs/i18n/README.md。
export default {
  "profile": {
    "default": "默认",
    "switch": "切换档案",
    "add": "新增档案",
    "empty": "暂无档案",
    "unnamed": "未命名",
    "rename": "改昵称",
    "delete": "删除",
    "isDefault": "✓ 已设为默认",
    "makeDefault": "设为默认档案",
    "guestLimit": "访客模式仅保存 1 个本地命主档案，登录后可维护多个云端档案。",
    "newName": "新的昵称",
    "saveName": "保存昵称"
  },
  "common": {
    "confirm": "确定"
  },
  "tab": {
    "basic": "基础排盘",
    "pro": "专业细盘",
    "ziwei": "紫微盘",
    "notes": "断事笔记"
  },
  "form": {
    "heading": "新增排盘资料",
    "modeSolar": "公历",
    "modePillars": "四柱",
    "name": "姓名",
    "namePlaceholder": "请输入姓名",
    "gender": "性别",
    "male": "男",
    "female": "女",
    "birthTime": "出生时间",
    "datePlaceholder": "输入 199303270255",
    "dateHint": "仅支持数字输入，格式为 YYYYMMDDHHmm，也可只输入到日期或小时。",
    "birthplace": "出生地址",
    "birthplacePlaceholder": "搜索省市区县，如 福建省厦门市思明区",
    "clearPlace": "清除地址",
    "latLng": "北纬{lat} 东经{lng}",
    "noPlace": "未找到匹配地址",
    "trueSolar": "真太阳时",
    "dst": "夏令时",
    "seg": {
      "year": "年",
      "month": "月",
      "day": "日",
      "hour": "时",
      "minute": "分"
    },
    "preview": {
      "clock": "钟表阳历：{value}",
      "adjusted": "排盘时间：{value}（{note}）",
      "lunar": "农历：{value}",
      "pillars": "四柱：{value}",
      "match": "匹配结果：{value}",
      "candidates": "候选数量：{count} 个，默认采用最近日期"
    },
    "currentSlot": "当前选择：{slot}",
    "stem": "天干",
    "branch": "地支"
  },
  "guest": {
    "kicker": "访客模式",
    "title": "登录后生成完整云端排盘",
    "saved": "访客本地档案已保存。",
    "login": "登录",
    "after": "后可补全格局、喜忌、断语与岁运细解。"
  },
  "analysis": {
    "running": "排盘、格局、岁运与喜忌正在同步校验",
    "done": "最新结果已写入当前档案",
    "closeNotice": "关闭推演状态提示",
    "steps": {
      "place": "校准出生时空",
      "pillars": "排布四柱格局",
      "useful": "核对喜忌用神",
      "luck": "联动大运流年",
      "reading": "整理天机断语"
    }
  },
  "notes": {
    "help": "功能说明",
    "calibrated": "已深度校准 · {time}",
    "yearMonth": "{year}年{month}月",
    "year": "{year}年",
    "dayun": "大运 {value}",
    "empty": "暂无记录，添加真实大事以校准盘面",
    "collapse": "收起",
    "addEvent": "+ 添加事件",
    "form": {
      "year": "发生年份 *",
      "month": "发生月份（选填）",
      "noMonth": "不填",
      "category": "事件领域 *",
      "impact": "事件性质 *",
      "description": "事件描述 *",
      "descriptionPlaceholder": "简述经过与影响，如：入职某AI公司任技术负责人，薪资翻倍...",
      "submit": "确认添加"
    },
    "yearOption": "{year} 年",
    "monthOption": "{month} 月"
  },
  "context": {
    "profileTitle": "长期基调",
    "profileHelp": "查看长期基调说明",
    "saving": "保存中…",
    "saveProfile": "保存基调",
    "profileDesc": "这部分是较稳定的人生背景，只影响月运断语落点，不参与算分。",
    "unset": "暂不填写",
    "monthlyTitle": "月度基调",
    "monthlyHelp": "查看月度基调说明",
    "copyPrevious": "沿用上月",
    "saveMonthly": "保存本月",
    "monthlyDesc": "默认会把当前月作为主基调，并参考近 3 个月记录。主维度注入完整信息，其余维度只注入状态。",
    "overall": "本月总说明",
    "overallPlaceholder": "例如：这个月刚换城市，工作和感情都在重建。",
    "status": "当前状态",
    "summary": "本月现状",
    "summaryPlaceholder": "用一句话写清楚这个月正在经历什么。",
    "goal": "本月目标",
    "goalPlaceholder": "例如：拿到 offer / 稳住关系 / 控制开支",
    "worry": "本月最担心",
    "worryPlaceholder": "例如：反馈拖延 / 情绪反复 / 现金流紧",
    "recent": "近 3 个月记录"
  }
}
