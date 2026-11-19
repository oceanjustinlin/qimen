-- 审计表增加请求来源信息：用于区分真实外国用户与测试数据。
-- 只存国家码 / 界面语言 / 时区 / 浏览器首选语言，不存原始 IP。
-- 历史记录这几列为空。
alter table public.qimen_question_audit
  add column if not exists country text,
  add column if not exists ui_locale text,
  add column if not exists tz text,
  add column if not exists browser_lang text;

alter table public.bazi_question_audit
  add column if not exists country text,
  add column if not exists ui_locale text,
  add column if not exists tz text,
  add column if not exists browser_lang text;
