-- 只读：列出可能受「海外/港澳台出生地真太阳时」修复影响的八字档案。
-- 中国大陆档案的计算规则未变，不在此列。
-- 判定：海外标签（"城市 · 州 · 国家"）、港澳台标签，或经度超出中国范围。
-- 用新版 getSolarTimeAdjustment（传入出生地 timeZone）重算后，只有 adjusted_birth_date / bazi_str
-- 实际变化的档案才需要迁移；四柱变化时还需清空 bazi_detail 与 LLM/校准字段，以便重新生成。
-- 2026-11-05 审计结果：总 216 条，候选 9 条（新加坡 2、香港 3、台湾 4），重算后全部不变，无需迁移。
select id, birth_location, birth_longitude, birth_date, adjusted_birth_date,
       solar_time_mode, solar_time_adjustment_minutes, bazi_str
from public.bazi_profiles
where birth_location like '%·%'
   or birth_location like '港澳台%'
   or birth_longitude < 73
   or birth_longitude > 135.5
order by birth_location;
