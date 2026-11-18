<template>
  <div class="legal-view">
    <header class="legal-header">
      <router-link class="back-link" to="/">{{ t('common.back') }}</router-link>
      <div class="site-logo">{{ isPrivacy ? t('legal.privacyTitle') : t('legal.termsTitle') }}</div>
      <div class="header-spacer"></div>
    </header>

    <main class="legal-page-wrap">
      <article class="legal-panel">
        <div class="panel-glow" aria-hidden="true"></div>
        <p v-if="locale === 'en-US'" class="legal-translation-note">{{ t('legal.translationNote') }}</p>
        <div class="legal-kicker">{{ currentDoc.kicker }}</div>
        <h1>{{ currentDoc.title }}</h1>
        <p class="legal-updated">{{ t('legal.updated', { date: currentDoc.updatedAt }) }}</p>
        <p class="legal-intro">{{ currentDoc.intro }}</p>

        <section v-for="section in currentDoc.sections" :key="section.title" class="legal-section">
          <h2>{{ section.title }}</h2>
          <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
          <ul v-if="section.items?.length">
            <li v-for="item in section.items" :key="item">{{ item }}</li>
          </ul>
        </section>

        <div class="legal-note">
          {{ t('legal.draftNote') }}
        </div>

        <div class="legal-actions">
          <router-link v-if="isPrivacy" to="/terms">{{ t('legal.viewTerms') }}</router-link>
          <router-link v-else to="/privacy">{{ t('legal.viewPrivacy') }}</router-link>
          <router-link to="/">{{ t('legal.backToLogin') }}</router-link>
        </div>
      </article>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// 条款正文不翻译（spec §10 第 6 项）：英文界面顶部提示以中文为准，正文仍显示中文。
// i18n-ignore-start
const updatedAt = '2026年5月11日'

const termsDoc = {
  kicker: 'TERMS OF SERVICE',
  title: '用户协议',
  updatedAt,
  intro: '欢迎使用奇门遁甲服务。本协议用于说明你与本服务之间关于账号、内容、推演结果、付费支持与使用边界的基本约定。',
  sections: [
    {
      title: '一、服务说明',
      paragraphs: [
        '本服务提供奇门遁甲、八字命盘、日运/月运/年运等术数推演能力，并结合规则引擎与 AI 模型生成解释性内容。',
        '推演结果仅供个人参考、学习和娱乐，不构成法律、医疗、投资、财务、心理咨询或其他专业意见。涉及重大决策时，请结合现实信息并咨询相应专业人士。'
      ]
    },
    {
      title: '二、账号与登录',
      paragraphs: [
        '你可以使用邮箱密码或第三方登录方式创建和访问账号。你应妥善保管登录凭证，并对账号下的操作负责。',
        '如发现账号被盗用、异常登录或其他安全问题，请及时通过本服务提供的联系方式与我们联系。'
      ]
    },
    {
      title: '三、用户输入与内容',
      paragraphs: [
        '你在使用服务时可能会输入问题、出生时间、出生地、八字档案、反馈说明等内容。你应确保输入内容不侵犯他人权益，不包含违法、有害、骚扰、仇恨、诈骗或其他不当信息。',
        '为提供排盘、历史记录、反馈校准和运势缓存等功能，本服务会按《隐私政策》处理必要数据。'
      ]
    },
    {
      title: '四、AI 内容边界',
      paragraphs: [
        'AI 生成内容可能存在不准确、不完整或不适用于特定情境的情况。本服务会尽力通过规则引擎约束推演边界，但不保证所有输出完全正确。',
        '你不应将本服务输出作为唯一决策依据，也不应要求本服务替代专业判断。'
      ]
    },
    {
      title: '五、访客体验与功能限制',
      paragraphs: [
        '访客模式用于试用部分功能，可能限制提问次数、档案数量或可查看内容。注册或登录后可使用更多账号相关能力。',
        '我们可能根据产品运行情况调整免费额度、访客限制、缓存策略和功能范围。'
      ]
    },
    {
      title: '六、第三方服务',
      paragraphs: [
        '本服务可能使用 Supabase 提供认证、数据库与存储能力，使用 Google OAuth 提供第三方登录能力，并调用 AI 模型服务生成推演文本。',
        '第三方服务会依据其各自条款和隐私规则处理相关数据。我们会在合理范围内选择必要服务，并尽量减少共享数据。'
      ]
    },
    {
      title: '七、禁止行为',
      paragraphs: [],
      items: [
        '不得攻击、破解、绕过限制、干扰服务正常运行，或批量抓取、复制、转售服务内容。',
        '不得上传、输入或传播违法、侵权、骚扰、仇恨、诈骗、恶意代码或侵犯他人隐私的内容。',
        '不得冒用他人身份，或使用本服务从事违法违规、损害公共利益或第三方权益的活动。'
      ]
    },
    {
      title: '八、服务变更与终止',
      paragraphs: [
        '我们可能因产品迭代、维护、安全、合规或第三方服务变化而调整、暂停或终止部分功能。',
        '如果你违反本协议或法律法规，我们有权限制、暂停或终止你的账号或相关功能。'
      ]
    },
    {
      title: '九、免责声明与责任限制',
      paragraphs: [
        '在法律允许范围内，本服务按现状提供，不对推演结果、AI 输出、连续可用性或完全无错误作出保证。',
        '因你依赖推演结果作出的现实决策、第三方服务故障、不可抗力或非本服务可控原因造成的损失，本服务不承担超出法律规定范围的责任。'
      ]
    },
    {
      title: '十、协议更新',
      paragraphs: [
        '我们可能根据法律法规、产品功能或运营需要更新本协议。重大变更会以页面提示、站内提示或其他合理方式告知。',
        '更新后继续使用本服务，即表示你接受更新后的协议。'
      ]
    }
  ]
}

const privacyDoc = {
  kicker: 'PRIVACY POLICY',
  title: '隐私政策',
  updatedAt,
  intro: '本政策说明奇门遁甲服务如何收集、使用、存储、共享和保护你的个人信息，以及你可以如何管理自己的信息。',
  sections: [
    {
      title: '一、我们收集的信息',
      paragraphs: [
        '账号信息：邮箱地址、第三方登录返回的账号标识，以及认证状态。',
        '使用内容：你提交的奇门问题、推演历史、应验反馈、运势缓存、八字档案名称、性别、出生时间、出生地、经纬度、真太阳时修正结果、排盘结果和相关摘要。',
        '设备与日志信息：访问时间、请求状态、错误信息、浏览器环境、必要的安全日志，以及用于访客额度和防滥用的基础事件记录。',
        '访客模式下，我们会尽量过滤姓名、生日、问题文本、邮箱等隐私字段，仅记录必要的功能事件。'
      ]
    },
    {
      title: '二、我们如何使用信息',
      paragraphs: [],
      items: [
        '用于账号注册、登录、密码重设、身份校验和账号安全。',
        '用于生成奇门、八字、日运、月运、年运等排盘和解读结果。',
        '用于保存历史记录、八字档案、反馈记录、运势缓存和跨设备同步。',
        '用于改进规则引擎、排查故障、防止滥用、维护服务安全和履行法律义务。'
      ]
    },
    {
      title: '三、敏感或需谨慎处理的信息',
      paragraphs: [
        '出生时间、出生地、经纬度、命盘、反馈说明和问题内容可能反映你的个人经历、偏好或现实处境。请不要提交他人的个人信息，除非你已取得其合法授权。',
        '本服务不会要求你提供身份证件号码、金融账户、医疗记录或生物识别信息。请不要在提问或反馈中主动输入这类高敏感信息。'
      ]
    },
    {
      title: '四、第三方处理与数据共享',
      paragraphs: [
        '认证和数据库服务可能由 Supabase 提供；Google 登录会跳转至 Google OAuth；AI 解读可能调用第三方模型接口。',
        '我们只会为实现功能所必需的目的向第三方服务传输必要信息。例如，生成解读时可能发送问题、排盘结构化数据或必要背景；认证时会处理邮箱或第三方账号标识。',
        '除法律法规要求、保护安全、完成服务功能或取得你的同意外，我们不会出售你的个人信息。'
      ]
    },
    {
      title: '五、存储与保护',
      paragraphs: [
        '我们会在实现处理目的所需的最短合理期限内保存个人信息。账号存在期间，历史记录、档案和缓存可能持续保存；你删除账号或请求删除后，我们会在合理期限内删除或匿名化处理，法律法规另有要求的除外。',
        '我们会采取访问控制、认证校验、数据库权限、传输加密、日志审计等合理措施保护数据安全。但互联网服务无法保证绝对安全。'
      ]
    },
    {
      title: '六、你的权利',
      paragraphs: [],
      items: [
        '你可以登录账号查看、修改或删除部分档案和历史内容。',
        '你可以请求访问、更正、复制、删除个人信息，或撤回基于同意的处理。',
        '你可以请求注销账号；注销后，与账号绑定的数据将按法律要求和技术可行性删除或匿名化。',
        '如你对个人信息处理有疑问、投诉或请求，请通过本服务提供的联系方式联系我们。'
      ]
    },
    {
      title: '七、未成年人',
      paragraphs: [
        '本服务主要面向成年人。未满十四周岁的未成年人不应在未取得监护人同意的情况下使用本服务或提交个人信息。',
        '如果监护人发现未成年人向本服务提交了个人信息，可以联系我们请求删除或采取其他必要措施。'
      ]
    },
    {
      title: '八、Cookie 与本地存储',
      paragraphs: [
        '本服务可能使用浏览器本地存储、认证会话和缓存来保持登录状态、访客额度、运势缓存和基础偏好。禁用相关能力可能影响部分功能。'
      ]
    },
    {
      title: '九、政策更新',
      paragraphs: [
        '我们可能根据法律法规、产品功能或第三方服务变化更新本政策。重大变更会以页面提示、站内提示或其他合理方式告知。',
        '如果个人信息处理目的、方式或种类发生重要变化，我们会按适用法律要求重新告知或取得同意。'
      ]
    }
  ]
}
// i18n-ignore-end

const route = useRoute()
const isPrivacy = computed(() => route.name === 'privacy')
const currentDoc = computed(() => (isPrivacy.value ? privacyDoc : termsDoc))
</script>

<style scoped>
.legal-view { width: 100%; min-height: 100vh; }
.legal-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 300;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  backdrop-filter: blur(24px) saturate(1.5);
  -webkit-backdrop-filter: blur(24px) saturate(1.5);
  background: var(--header-bg);
  border-bottom: 1px solid var(--line);
}
.site-logo {
  font-family: var(--font-serif);
  font-size: 17px;
  letter-spacing: .15em;
  font-weight: 500;
  background: linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 12px rgba(212,175,55,0.45));
}
.back-link, .header-spacer { width: 52px; }
.back-link { color: var(--text-muted); font-size: 13px; text-decoration: none; }
.back-link:hover { color: var(--gold-light); }
.legal-page-wrap {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding: 92px 18px 54px;
  display: flex;
  justify-content: center;
}
.legal-panel {
  width: min(100%, 760px);
  position: relative;
  overflow: hidden;
  padding: 34px 32px;
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  background: var(--bg-card);
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
}
.panel-glow {
  position: absolute;
  top: -120px;
  right: -120px;
  width: 260px;
  height: 260px;
  pointer-events: none;
  background: radial-gradient(circle, rgba(232,204,128,0.13), transparent 66%);
}
.legal-translation-note { margin: 0 0 16px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; color: var(--ink-muted); font-size: 12px; line-height: 1.6; }
.legal-kicker { color: var(--teal); font-size: 10px; letter-spacing: .3em; font-weight: 700; margin-bottom: 10px; }
h1 { margin: 0; color: var(--gold-light); font-family: var(--font-serif); font-size: 30px; font-weight: 500; letter-spacing: .08em; }
.legal-updated { margin: 10px 0 0; color: var(--text-dim); font-size: 12px; }
.legal-intro { margin: 22px 0 26px; color: var(--ink-muted); font-size: 14px; line-height: 1.9; }
.legal-section { padding: 20px 0; border-top: 1px solid var(--line); }
.legal-section h2 { margin: 0 0 12px; color: var(--ink); font-family: var(--font-serif); font-size: 18px; font-weight: 500; letter-spacing: .04em; }
.legal-section p, .legal-section li { color: var(--ink-muted); font-size: 13px; line-height: 1.9; }
.legal-section p + p { margin-top: 8px; }
.legal-section ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }
.legal-note {
  margin-top: 12px;
  padding: 13px 14px;
  border-radius: 14px;
  border: 1px solid rgba(78,205,196,0.2);
  background: rgba(78,205,196,0.07);
  color: var(--teal);
  font-size: 12px;
  line-height: 1.8;
}
.legal-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 22px; }
.legal-actions a {
  min-width: 128px;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 9px 16px;
  border-radius: 14px;
  border: 1px solid rgba(232,204,128,0.26);
  color: var(--gold-light);
  background: rgba(212,175,55,0.055);
  text-decoration: none;
  font-size: 13px;
}
.legal-actions a:hover { border-color: rgba(232,204,128,0.48); background: rgba(212,175,55,0.09); }
@media(max-width:560px) {
  .legal-page-wrap { padding: 84px 14px 38px; }
  .legal-panel { padding: 26px 20px; }
  h1 { font-size: 26px; }
}
</style>
