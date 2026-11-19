/**
 * Cloudflare Pages Middleware — SEO bot prerender
 *
 * Problem: qimendao.com is a Vue SPA. Crawlers (Googlebot, Baiduspider, etc.)
 * see an empty <div id="app"></div> and can't index page content.
 *
 * Solution: detect crawler User-Agents and return a lightweight static HTML
 * shell with route-specific <title>, <meta name="description">, and OG tags.
 * Real users pass through to the normal SPA, zero impact on UX.
 */

const BOT_UA =
  /googlebot|google-inspectiontool|baiduspider|bingbot|yandexbot|duckduckbot|slurp|twitterbot|facebookexternalhit|linkedinbot|whatsapp|telegrambot|applebot|semrushbot|ahrefsbot|mj12bot/i

const SITE_URL = 'https://www.qimendao.com'
const DEFAULT_IMAGE = `${SITE_URL}/images/home.jpg`

/**
 * Route-level meta. 与 src/router/index.js 的 seoTitle/seoDescription 以及
 * src/i18n/locales/en-US.mjs 的 seo.* 保持一致；src/seoExposure.test.mjs 有一致性断言，
 * 改一处必须同步另一处，否则爬虫看到的标题会与首页静态 head 分叉。
 */
const ROUTE_META = {
  '/': {
    title: '奇门遁甲在线排盘_AI解盘与八字运势分析 - 奇门道',
    titleEn: 'Qimendao — Qimen Dunjia Online Chart & AI Reading',
    description:
      '奇门道提供免费的奇门遁甲在线排盘、AI 解盘、八字四柱排盘与每日运势分析。输入时间、地点和所问之事，即可生成局盘、宫位、干支、评分与行动建议。',
    descriptionEn:
      'Qimendao: free online Qimen Dunjia chart, AI reading, Bazi four-pillar chart and daily fortune. A rule engine computes the chart first; AI explains it.',
    image: DEFAULT_IMAGE,
    h1: '奇门遁甲在线排盘与 AI 解盘',
    h1En: 'Qimen Dunjia Online Chart & AI Reading',
    intro: '奇门道：先让规则引擎排盘，再由 AI 解读。时间、干支、宫位、评分全由规则引擎算出，不留给模型猜。',
    introEn: 'Qimendao: a rule engine casts the chart first, then AI interprets it. Time, stems, branches, palaces and scores are all computed by rules, never guessed by the model.',
    faq: true,
  },
  '/bazi': {
    title: '八字排盘_在线四柱八字、喜用神与大运流年分析 - 奇门道',
    titleEn: 'Bazi Four Pillars — Qimen AI',
    description:
      '奇门道提供在线八字排盘、四柱十神、喜用神、格局判断、大运流年与月度运势分析，适合建立长期命盘档案。',
    descriptionEn:
      'Professional Bazi four-pillars chart: ten gods, patterns, major cycles and yearly luck in one click.',
    image: `${SITE_URL}/images/bazi_1.jpg`,
    h1: '八字四柱在线排盘',
    h1En: 'Bazi Four Pillars Chart',
    intro: '在线八字排盘：四柱十神、喜用神、格局判断、大运流年与月度运势分析。',
    introEn: 'Online Bazi chart: ten gods, favorable elements, patterns, major cycles and monthly luck.',
  },
  '/fortune': {
    title: '今日运势查询_每日/每周/月度八字运势分析 - 奇门道',
    titleEn: 'Daily Fortune — Qimen AI',
    description:
      '基于奇门遁甲规则引擎与八字命局，查询今日运势、七日走势、月度曲线和年度节奏，生成可执行的行动建议。',
    descriptionEn:
      'Rule-engine powered daily, weekly and monthly fortune analysis based on Qimen Dunjia and your Bazi.',
    image: DEFAULT_IMAGE,
    h1: '今日运势查询',
    h1En: 'Daily Fortune',
    intro: '基于奇门遁甲规则引擎与八字命局，查询今日运势、七日走势、月度曲线和年度节奏。',
    introEn: 'Daily, weekly and monthly fortune from the Qimen Dunjia rule engine and your Bazi chart.',
  },
  '/engineering': {
    title: '奇门遁甲规则引擎_排盘算法与评分审计 - 奇门道',
    titleEn: 'Engineering Mode — Qimen AI',
    description:
      '查看奇门遁甲排盘算法、宫位推演、评分证据和规则引擎审计细节，了解奇门道如何先排盘再解读。',
    descriptionEn:
      'Visual Qimen rule engine with open scoring audit and palace details for technical research.',
    image: DEFAULT_IMAGE,
    h1: '奇门遁甲规则引擎',
    h1En: 'Qimen Rule Engine',
    intro: '可视化奇门遁甲规则引擎，开放排盘算法、宫位推演与评分审计细节。',
    introEn: 'A visual Qimen rule engine with open scoring audit and palace-level details.',
  },
  '/terms': {
    title: '服务条款 — 奇门遁甲 AI',
    titleEn: 'Terms of Service — Qimen AI',
    description: '奇门道服务条款。',
    descriptionEn: 'Terms of service for Qimendao.',
    image: DEFAULT_IMAGE,
    h1: '服务条款',
    h1En: 'Terms of Service',
    intro: '奇门道服务条款。',
    introEn: 'Terms of service for Qimendao.',
  },
  '/privacy': {
    title: '隐私政策 — 奇门遁甲 AI',
    titleEn: 'Privacy Policy — Qimen AI',
    description: '奇门道隐私政策。',
    descriptionEn: 'Privacy policy for Qimendao.',
    image: DEFAULT_IMAGE,
    h1: '隐私政策',
    h1En: 'Privacy Policy',
    intro: '奇门道隐私政策。',
    introEn: 'Privacy policy for Qimendao.',
  },
}

/** 首页 FAQ：与 src/i18n/locales/{zh-CN,en-US}/home.mjs 的 faq.q1–q3 / a1–a3 一致。 */
const FAQ = {
  zh: [
    ['奇门道可以做什么？', '可以在线生成奇门遁甲局盘、AI 解盘、八字四柱排盘和每日运势分析。'],
    ['AI 解盘和传统排盘有什么区别？', '奇门道先用规则引擎计算时间、干支、宫位和评分，再由 AI 把盘面转成可读解释。'],
    ['奇门问事需要出生时间吗？', '奇门问事可以按当前时间起局；八字排盘和长期运势分析需要出生日期、时间和出生地。'],
  ],
  en: [
    ['What does Qimen Dao do?', 'It casts Qimen Dunjia charts with AI readings, Bazi four-pillar charts and daily fortune.'],
    ['How is an AI reading different from a traditional chart?', 'A rule engine first computes the time, stems and branches, palaces and rating; AI then turns the chart into a readable explanation.'],
    ['Do I need my birth time for a Qimen question?', 'No. A Qimen chart uses the current time. Bazi charts and long-term fortune need your birth date, time and place.'],
  ],
}

function buildJsonLd(meta, lang, canonical) {
  const isEn = lang === 'en'
  const blocks = [
    {
      '@context': 'https://schema.org',
      '@type': ['WebApplication', 'SoftwareApplication'],
      name: isEn ? 'Qimendao' : '奇门道',
      alternateName: isEn ? ['奇门道', 'Qimen Dao'] : ['Qimendao', '奇门遁甲在线排盘 AI 解盘工具'],
      url: canonical,
      description: isEn ? meta.descriptionEn : meta.description,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
      inLanguage: isEn ? 'en' : 'zh-CN',
      publisher: { '@type': 'Organization', name: isEn ? 'Qimendao' : '奇门道', url: SITE_URL },
    },
  ]
  if (meta.faq) {
    blocks.push({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ[isEn ? 'en' : 'zh'].map(([q, a]) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    })
  }
  // 防止 </script> 提前闭合
  return blocks
    .map((b) => `<script type="application/ld+json">${JSON.stringify(b).replace(/</g, '\\u003c')}</script>`)
    .join('\n  ')
}

function buildBotHtml(pathname, meta, lang) {
  const isEn = lang === 'en'
  const title = isEn ? meta.titleEn : meta.title
  const description = isEn ? meta.descriptionEn : meta.description
  const h1 = isEn ? meta.h1En : meta.h1
  const intro = isEn ? meta.introEn : meta.intro
  const siteName = isEn ? 'Qimendao' : '奇门道'
  const canonical = `${SITE_URL}${pathname === '/' ? '' : pathname}`
  const faqHtml = meta.faq
    ? `\n  <section>\n    <h2>${isEn ? 'FAQ' : '常见问题'}</h2>\n${FAQ[isEn ? 'en' : 'zh']
        .map(([q, a]) => `    <h3>${escHtml(q)}</h3>\n    <p>${escHtml(a)}</p>`)
        .join('\n')}\n  </section>`
    : ''
  const nav = isEn
    ? [['Qimen Dunjia', '/'], ['Bazi Chart', '/bazi'], ['Daily Fortune', '/fortune'], ['Rule Engine', '/engineering']]
    : [['奇门遁甲', '/'], ['八字排盘', '/bazi'], ['今日运势', '/fortune'], ['规则引擎', '/engineering']]

  return `<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'zh-CN'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escAttr(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${escAttr(canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:title" content="${escAttr(title)}">
  <meta property="og:description" content="${escAttr(description)}">
  <meta property="og:image" content="${escAttr(meta.image)}">
  <meta property="og:url" content="${escAttr(canonical)}">
  <meta property="og:locale" content="${isEn ? 'en_US' : 'zh_CN'}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escAttr(title)}">
  <meta name="twitter:description" content="${escAttr(description)}">
  <meta name="twitter:image" content="${escAttr(meta.image)}">
  ${buildJsonLd(meta, lang, canonical)}
</head>
<body>
  <h1>${escHtml(h1)}</h1>
  <p>${escHtml(intro)}</p>
  <nav>
    ${nav.map(([label, path]) => `<a href="${SITE_URL}${path === '/' ? '/' : path}">${escHtml(label)}</a>`).join(' |\n    ')}
  </nav>${faqHtml}
</body>
</html>`
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
}

function detectLang(request) {
  const accept = request.headers.get('accept-language') ?? ''
  return accept.toLowerCase().startsWith('en') ? 'en' : 'zh'
}

export async function onRequest({ request, next }) {
  const ua = request.headers.get('user-agent') ?? ''

  // Non-bot: pass through to the SPA unchanged.
  if (!BOT_UA.test(ua)) return next()

  const url = new URL(request.url)
  const pathname = url.pathname

  // API, auth, and static asset paths: never intercept.
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/') || pathname.includes('.')) return next()

  const meta = ROUTE_META[pathname] ?? ROUTE_META['/']
  const lang = detectLang(request)
  const html = buildBotHtml(pathname, meta, lang)

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'public, max-age=3600',
      'x-robots-tag': 'index, follow',
    },
  })
}
