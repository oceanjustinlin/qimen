// 奇门有名格的英文名与英文说明（英文模式下的格局标签与点开说明）。
// 键为引擎输出的简体格局名（与 HomeView 的 GE_DESCRIPTIONS 一一对应）；名字同时登记在
// lib/i18n/glossary.js 的 qimen_pattern 组，供 symbolName / symbolHint 使用。
// 译名参照英文奇门书的常见叫法（Bird Falling into the Cave、Green Dragon Returning…）；
// 没有通行意译的（大格、伏吟）保留拼音或直译。

export const QIMEN_FORMATIONS_EN = {
  // 吉格 — 天地盘干组合
  '飞鸟跌穴': ['Bird Falling into the Cave', 'Like a bird diving into its nest: plans succeed. Good for decisive action, and strong in disputes.'],
  '青龙返首': ['Green Dragon Returning', 'The dragon looks back: holding ground pays off. Defence is favoured; wait for the right moment and things settle.'],
  '日月并行': ['Sun and Moon Together', 'Sun and moon shine together: matters go smoothly, especially love and marriage, with helpful people nearby.'],
  '奇仪相佐': ['Wonder and Instrument Assisting', 'Wonder and instrument support each other: good for study, exams, paperwork and planning.'],
  '青龙转光': ['Green Dragon Turning Light', 'Career and money gradually strengthen. Room to grow, with help from benefactors.'],
  '青龙耀明': ['Green Dragon Shining', 'Career advances, benefactors help, and both reputation and gain come.'],
  '星奇入太阴': ['Star Wonder Enters the Moon', 'Good for study and planning. Quiet help behind the scenes; strategy pays off.'],
  '奇仪相合·乙庚': ['Wonder-Instrument Combination · Yi-Geng', 'Firm and soft balance each other: cooperation goes well, disputes can be settled, relationships are harmonious.'],
  '奇仪相合·丙辛': ['Wonder-Instrument Combination · Bing-Xin', 'Light combines: love goes well, lawsuits can be reconciled, things run smoothly.'],
  '奇仪相合·丁壬': ['Wonder-Instrument Combination · Ding-Ren', 'Yin and yang unite: very good for love and marriage, partnerships succeed.'],
  '奇仪相合·戊癸': ['Wonder-Instrument Combination · Wu-Gui', 'Earth and water combine: feelings warm gradually and cooperation looks promising, working quietly.'],
  // 凶格 — 天地盘干组合
  '青龙逃走': ['Green Dragon Escaping', 'Subordinates turn away and losses follow. Taking the offensive costs dearly; beware betrayal.'],
  '白虎猖狂': ['White Tiger Rampant', 'Danger on the road, damage to vehicles, harm to elders; most matters fail.'],
  '朱雀投江': ['Red Phoenix Diving into the River', 'Documents and messages vanish; things stall. Avoid travel and new requests.'],
  '螣蛇夭矫': ['Serpent Writhing', 'Gossip, false alarms and deception rise; relationships may change. Guard against fraud.'],
  '太白入荧': ['Metal Enters Fire', 'An intruder strikes: the side that acts first gains, the defender loses money. Guard against being taken from.'],
  '荧入太白': ['Fire Enters Metal', 'The defender turns danger into safety, while the one who acts first traps itself.'],
  '大格': ['Great Obstruction', 'Very unfavourable: relationships break, illness and lawsuits go badly. Stay still and watch.'],
  '小格': ['Minor Obstruction', 'Obstacles slow career and progress. Plan carefully and do not rush.'],
  '伏宫格': ['Hidden Palace Obstruction', 'Pressure on money and lawsuits. Hold rather than move; wait for the right time.'],
  '飞宫格': ['Flying Palace Obstruction', 'Turbulence harms career and lawsuits are hard to win. Guard against sudden change; move steadily.'],
  '刑格': ['Punishment Obstruction', 'Money suffers and lawsuits drag on. Avoid litigation.'],
  '天网四张': ['Heaven Net Spread Wide', 'No way out: travel and requests both go badly. Pause everything and wait.'],
  '地网遮蔽': ['Earth Net Covering', 'Hidden traps block progress. Beware schemes; do not act lightly.'],
  '六仪击刑': ['Six Instruments Punished', 'Very unfavourable for love, lawsuits and health. Whoever acts first is hit hardest.'],
  '三奇入墓·乙': ['Wonder Enters the Tomb · Yi', 'Wood energy is trapped and growth stalls. Stay still rather than act.'],
  '三奇入墓·丙': ['Wonder Enters the Tomb · Bing', 'Brightness dims; career and money are blocked. Keep quiet and wait for change.'],
  '三奇入墓·丁': ['Wonder Enters the Tomb · Ding', 'The wonder loses strength: plans and paperwork stall. Stay still rather than act.'],
  // 吉格 — 三奇
  '三奇得使': ['Three Wonders Meet the Envoy', 'A very favourable Qimen sign: matters go smoothly, travel and requests are both good, benefactors help.'],
  '三奇贵人升殿': ['Three Wonders Ascend the Hall', 'Highly favourable: money, study and official matters all thrive.'],
  '玉女守门': ['Jade Maiden Guards the Door', 'Relationships are gentle and career goes smoothly, with quiet help that softens resistance.'],
  '天显时格': ['Heaven Reveals the Hour', 'The moment is visible: seize the opportunity. Career can move; take the initiative in disputes.'],
  // 吉格 — 三诈五假
  '真诈格': ['True Deception', 'The three deceptions form: borrow the momentum. Plans succeed, career and money benefit, lawsuits are won.'],
  '重诈格': ['Double Deception', 'The three deceptions form: borrow the momentum. Plans succeed, career and money benefit, lawsuits are won.'],
  '休诈格': ['Rest Deception', 'The three deceptions form: borrow the momentum. Plans succeed, career and money benefit, lawsuits are won.'],
  '天假格': ['Heaven Disguise', 'Borrowing strength from Nine Heaven: plans can succeed, career and money get support. Ride the momentum.'],
  '地假格': ['Earth Disguise', 'Sheltered by Nine Earth: plans can succeed with steady progress.'],
  '物假格': ['Object Disguise', 'Harmony smooths the way: plans can succeed and cooperation goes well.'],
  '鬼假格': ['Ghost Disguise', 'Danger turns to safety: plans can succeed and bad luck turns good.'],
  '人假格': ['Human Disguise', 'Good relationships help: plans can succeed with support from benefactors.'],
  // 吉格 — 九遁
  '天遁': ['Heaven Escape', 'Very favourable for love, marriage and official matters. Benefactors help; good time to act.'],
  '地遁': ['Earth Escape', 'Love, marriage and official matters go smoothly with steady progress; hardship can be resolved.'],
  '人遁': ['Human Escape', 'Hidden benefactors protect you; love, marriage and official matters are all favourable.'],
  '神遁': ['Spirit Escape', 'Career and money go smoothly and official matters can be won, with protection from above.'],
  '云遁': ['Cloud Escape', 'Relationships go well; obstacles soften and conflicts ease. Wait quietly for success.'],
  '风遁': ['Wind Escape', 'Career and money advance; ride the momentum and time it well.'],
  '龙遁': ['Dragon Escape', 'Relationships go well and help is on the way, with quiet protection from benefactors.'],
  '虎遁': ['Tiger Escape', 'Career and money benefit; strike while the moment is right and turn passive into active.'],
  '鬼遁': ['Ghost Escape', 'Quiet help: career and money advance and hidden resistance can be cleared.'],
  // 凶格 — 时格
  '五不遇时': ['Five Misfortune Hour', 'The hour stem attacks the day stem: little is favourable, especially travel and money. Health needs care; stay still.'],
  '奇格': ['Wonder Obstruction', 'Geng presses on the Three Wonders: whoever acts first loses badly and matters stall. Avoid rash moves.'],
  '岁格': ['Year Obstruction', 'Geng sits on the year stem: career and money are blocked this year. Act carefully until the year turns.'],
  '月格': ['Month Obstruction', 'Geng sits on the month stem: career and money are constrained this month. Hold and wait.'],
  '悖格': ['Disorder Obstruction', 'Order breaks down: career and money are blocked. Guard against trouble from within.'],
  '伏干格': ['Hidden Stem Obstruction', 'The day stem is pressed down: the defender struggles to break free. Very unfavourable for career and money.'],
  '飞干格': ['Flying Stem Obstruction', 'The day stem is jolted: very unfavourable for career and money. Avoid big moves and wait.'],
  '伏吟（凶）': ['Fu Yin (Stagnant)', 'Everything freezes: acting or travelling first is very unfavourable. Hold rather than move.'],
  '反吟（凶）': ['Fan Yin (Reversal)', 'The situation flips: the defender has a hard time and change is sharp. Work to ease conflict.'],
}

const GROUP_EN = { // i18n-ignore-start
  奇仪相合: 'Wonder-Instrument Combination',
  三奇入墓: 'Wonder Enters the Tomb',
} // i18n-ignore-end

// 英文格局名；查不到时按「前缀·干」拆开再拼，仍查不到返回 ''
export function formationNameEn(name, stemName = (s) => s) {
  const hit = QIMEN_FORMATIONS_EN[name]
  if (hit) return hit[0]
  const [head, tail] = String(name || '').split('·')
  if (tail && GROUP_EN[head]) return `${GROUP_EN[head]} · ${[...tail].map(stemName).join('-')}`
  return ''
}

export function formationDescEn(name) {
  return QIMEN_FORMATIONS_EN[name]?.[1] || ''
}
