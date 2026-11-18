// 「关于」页英文长文（i18n spec T2.8）。结构与 EngineeringView.vue 里的中文数据一一对应，
// 由 aboutEn.test.mjs 校验条目数量一致。
export default {
  pipeline: [
    { title: 'Collect the question', body: 'First work out whether you are asking a Qimen, Bazi or combined question, and keep your original wording.' },
    { title: 'Rule-based chart', body: 'The backend computes the time, stems and branches, nine palaces, eight doors, eight deities, patterns and scores.' },
    { title: 'Fixed fields', body: 'What the page shows is packed into fixed fields, so the model cannot improvise.' },
    { title: 'Display', body: 'The front end reads only the agreed fields and shows the verdict, basis, reasoning and guidance in stable modules.' },
  ],
  currentUpdates: [
    { tag: 'Testing', title: 'Useful-god checks against classic case studies', body: 'New test criteria for the useful god and target Ten Gods, checked against the case studies in Lu Zhiji\'s advanced Bazi textbook, fixing key errors such as follow-the-child, climate-first, seal-rescues-self and drop-officer-for-seal.' },
    { tag: 'Display', title: 'Where the Bazi dynamic view gets its material', body: 'The dynamic view no longer waits for the model. It draws target Ten Gods, palaces and triggers from the rule-computed natal state, luck-cycle changes and candidate years, so what you see and what was computed share one source.' },
    { tag: 'Routing', title: 'Two-track judgment', body: 'A Bazi question is first sorted by what it asks (current state, a future year, innate structure, a person, or a choice of direction), then by what to look at (the area\'s Ten God, the chart\'s favorable elements, or only a low-confidence reference).' },
  ],
  historyUpdates: [
    { tag: 'Fortune', title: 'Day, week, month and year', body: 'The fortune page grew from a single daily reading into a 7-day curve, monthly rhythm and yearly luck window, while keeping score reasons, low stretches and practical advice.' },
    { tag: 'Ask', title: 'Routing between Qimen, Bazi and combined readings', body: 'A plain-language question goes through a router first: specific events go to Qimen, long-term structure to Bazi, and questions with both go to a combined reading.' },
    { tag: 'Profiles', title: 'Bazi profiles and real-life notes', body: 'Supports solar and lunar dates, reverse lookup from the four pillars, birthplace and true solar time. Your notes feed the monthly reading so it fits where you really are.' },
    { tag: 'Feedback', title: 'Outcome feedback and audit trail', body: 'Qimen and Bazi answers keep snapshots of routing, rules, model output and post-processing. Outcomes you report help tune score weights and instructions later.' },
  ],
  modules: [
    {
      kicker: 'Step 1 · Sort the question',
      title: 'Decide which path the question takes',
      lead: 'You type one plain sentence. The system decides whether it is a Qimen question, a Bazi question, or a combined one that needs your Bazi profile; Bazi questions then go through the two-track judgment of what is asked and what to look at.',
      items: [
        { label: 'Input', title: 'Your exact words', body: 'Your wording is kept as the question in the report and used later to match feedback.' },
        { label: 'Routing', title: 'Two-track recognition', body: 'The backend picks the method and the evidence from the intent of the question, instead of pushing every question through the same instructions.' },
        { label: 'Context', title: 'Bazi profile only when needed', body: 'A profile summary is passed in only when the path needs it, so birth data never muddies an ordinary Qimen chart.' },
      ],
    },
    {
      kicker: 'Step 2 · Rule-based computation',
      title: 'What can be computed is never left to guesswork',
      lead: 'Qimen charts, Bazi pillars and luck scores all come from the rule engine. The model receives a result package; it never makes up a chart.',
      items: [
        { label: 'Qimen', title: 'Nine-palace chart', body: 'Computes yin/yang dun, the ju number, Zhi Fu and Zhi Shi, the stars, doors and deities of each palace, and pattern quality.' },
        { label: 'Bazi', title: 'Chart structure', body: 'Builds the four pillars, Ten Gods, element strength, pattern, favorable elements, luck cycles and years.' },
        { label: 'Scores', title: 'Auditable basis', body: 'Scores come from rules and field combinations. The model may explain a score but never rewrite it.' },
      ],
    },
    {
      kicker: 'Step 3 · Constrained interpretation',
      title: 'The model writes, but only in the agreed fields',
      lead: 'The model is asked for fixed modules such as conclusion first, Qimen basis, chart reasoning and guidance.',
      items: [
        { label: 'Rules', title: 'Fixed fields', body: 'The front end relies on fixed fields: title, conclusion, actions, useful-god cards, chart reasoning and so on.' },
        { label: 'Limits', title: 'Old fields still read', body: 'Older records may carry old fields. The front end still reads them, but new records no longer ask the model for redundant fields.' },
        { label: 'Audit', title: 'Process data kept', body: 'Chart and scoring steps that need auditing are still stored, even if not all of them are shown.' },
      ],
    },
    {
      kicker: 'Step 4 · Display',
      title: 'The front end only makes structured results readable',
      lead: 'A report is not one long essay. It is split into stable parts in the order you decide: conclusion, then evidence, then action.',
      items: [
        { label: 'Verdict', title: 'First-screen decision', body: 'A verdict label, score, summary and background tone give you the first read.' },
        { label: 'Display', title: 'Same source as the computation', body: 'The dynamic view pulls target Ten Gods, palaces and luck triggers from the rule report rather than repeating model paragraphs.' },
        { label: 'Compat', title: 'Fallback fields', body: 'For older reports, missing parts are filled from the summary, analysis paragraphs and display blocks.' },
      ],
    },
    {
      kicker: 'Step 5 · Feedback loop',
      title: 'Feedback shapes the next round of rules and instructions',
      lead: 'Your accuracy ratings, real outcomes and history help tune score weights, area rules and display fields.',
      items: [
        { label: 'Record', title: 'Reading history', body: 'Each reading stores the question, category, score, report fields and time.' },
        { label: 'Feedback', title: 'Report the outcome', body: 'You can rate accuracy, whether the direction was right, and what actually happened.' },
        { label: 'Iterate', title: 'Rule fixes', body: 'With enough samples, rules and field specs change first, and instructions are tightened after, rather than relying on wording alone.' },
      ],
    },
  ],
  promises: [
    { title: 'Not a black box', body: 'Key judgments trace back to the chart, pattern, useful god and scoring basis.' },
    { title: 'Not just chat', body: 'The model never generates the chart; it explains structured data.' },
    { title: 'Not a one-off page', body: 'History, feedback and field specs keep the system improving.' },
  ],
}
