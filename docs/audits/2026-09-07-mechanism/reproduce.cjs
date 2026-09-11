const path = require('node:path');
const root = process.argv.slice(2).find(arg => !arg.startsWith('--'))
  || '/Users/justin.lin/Documents/qimen-1/qimen';
const req = p => require(path.join(root, p));
const { Solar } = req('node_modules/lunar-javascript');
const { buildQimenChart } = req('lib/qimenChart');
const { evaluateNamedFormation } = req('lib/qimenScoringEngine');
const { getNineStarProsperity } = req('lib/qimenProsperity');
const { getGeJu, getChengGe, BaziEngine, buildCompleteBaziDetail } = req('lib/baziCore');
const { getDiShi } = req('lib/BaziRuleEngine');
const { assessOriginalChartState } = req('lib/baziStateAssessor');
const C = req('lib/BaziConstants');
const out = {};
out.star = { star: '天蓬', month: '寅', actual: getNineStarProsperity('天蓬', '寅') };
const formation = (palaces, intent={}) => evaluateNamedFormation(palaces, intent).hits.map(x=>x.signal);
out.fiveNotMeet = { dayStem:'甲', hourStem:'辛', actual:formation([], {dayStem:'甲',hourStem:'辛'}) };
out.punishment = {
  xunHeadZhifuInPunishmentPalace:formation([{index:3,name:'震三宫',sky:'戊',earth:'乙',isZhiFu:true}], {xunHead:'甲子'}),
  fixedEarthWuWithoutZhifu:formation([{index:3,name:'震三宫',sky:'乙',earth:'戊',isZhiFu:false}], {xunHead:'甲子'})
};
out.threeQi = {
  yiOnJiNoDuty:formation([{index:7,sky:'乙',earth:'己',isZhiShi:false}]),
  yiOnRenWithDuty:formation([{index:7,sky:'乙',earth:'壬',isZhiShi:true}])
};
out.jade = {
  dutyEarthDing:formation([{index:5,sky:'壬',earth:'丁',isZhiShi:true}]),
  dutySkyDing:formation([{index:5,sky:'丁',earth:'壬',isZhiShi:true}])
};
const bazi={year:'壬申',month:'壬寅',day:'辛酉',time:'丙申'};
out.monthPattern={input:bazi,actual:getGeJu(bazi)};
const water={year:'己酉',month:'丁卯',day:'壬申',time:'乙巳'};
out.waterHurt={input:water,actual:getChengGe({geju:'伤官格',dayGan:'壬',monthZhi:'卯',allStems:Object.values(water).map(x=>x[0]),allBranches:Object.values(water).map(x=>x[1]),tenGodMap:BaziEngine.ShiShen['壬'],dayStrength:'身中'})};
out.completeBaziCases = [[1909,3,13,10],[1932,3,1,16]].map(([year,month,day,hour])=>{
  const solar=Solar.fromYmdHms(year,month,day,hour,0,0),baZi=solar.getLunar().getEightChar();
  const detail=buildCompleteBaziDetail({baZi,yun:baZi.getYun(1),isMale:true,currentYear:2026});
  return {time:solar.toYmdHms(),pillars:detail.pillars.ganzhi,geju:detail.geju,strongWeak:detail.strong_weak,chengge:detail.chengge_detail,fiveShens:detail.five_shens};
});
const pillars=[['年','甲','寅'],['月','庚','午'],['日','甲','子'],['时','甲','戌']].map(([name,gan,zhi])=>({name,gan,zhi,hidden_stems:C.ZHI5_LIST[zhi],is_kong:false}));
const report=assessOriginalChartState({matrix:{pillars},dayStem:'甲',targetSpec:{primary_shishen:['正印'],primary_gongwei:[],extra_static_checks:[]}});
out.targetPhase={actual:report.shishen_assessments.filter(x=>x.gan==='癸'),dayMasterPhase:getDiShi('甲','子'),targetStemPhase:getDiShi('癸','子')};
out.center=[];
out.pillarBoundary=[];
for(const hour of [9,15,21]){
  const solar=Solar.fromYmdHms(2026,2,4,hour,0,0),l=solar.getLunar(),c=buildQimenChart({year:2026,month:2,day:4,hour,minute:0});
  out.pillarBoundary.push({time:solar.toYmdHms(),chart:c.qimenData.pillars,exactYear:l.getYearInGanZhiExact(),exactMonth:l.getMonthInGanZhiExact()});
}
if(require('node:fs').existsSync(path.join(root,'lib/qimenPipeline.js'))){
 const {buildQimenEvidence}=req('lib/qimenPipeline');
 for(let day=1;day<=6;day++)for(let hour=0;hour<24;hour+=2){
   const e=buildQimenEvidence({year:2026,month:9,day,hour,minute:0,intent:{branch:'qimen',category:'career_business',subcategory:'promotion'}});
   if(e.zhiFuStar==='天禽'&&out.center.length<1)out.center.push({time:[2026,9,day,hour],ju:e.qimenData.ju_info,godPalace:e.qimenData.palaces.find(p=>p.god==='值符')?.name});
 }
 const e=buildQimenEvidence({year:2026,month:9,day:1,hour:2,minute:0,intent:{branch:'qimen',category:'career_business',subcategory:'promotion'}});
 out.subjectLocation={
   time:[2026,9,1,2],
   dayStem:e.chart.dayStem,
   dayStemVisible:e.chart.dayStemVisible,
   effectiveSkyPalaces:e.timingPalaces.filter(p=>p.isDayStem&&!p.is_center).map(p=>({index:p.index,name:p.name,sky:p.sky,ji_sky:p.ji_sky})),
   earthOnlyPalaces:e.timingPalaces.filter(p=>p.isDayStemEarth&&!p.isDayStem).map(p=>({index:p.index,name:p.name,earth:p.earth,ji_earth:p.ji_earth})),
   intentKeys:Object.keys(e.backendScoreInput.intent)
 };
}
const serialized = `${JSON.stringify(out, null, 2)}\n`;
if (process.argv.includes('--write')) {
  require('node:fs').writeFileSync(path.join(__dirname, 'reproduction.json'), serialized);
}
process.stdout.write(serialized);
