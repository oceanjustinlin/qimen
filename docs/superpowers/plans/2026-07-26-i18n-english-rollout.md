# English Internationalization Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a complete English user experience while preserving Chinese as a supported locale and without changing the meaning of persisted, rule-engine, or LLM-routing values.

**Architecture:** Keep all business identifiers stable and translate only at presentation boundaries. Vue uses the existing `vue-i18n` instance for static copy and deterministic labels; the Worker receives an explicit locale for streamed status text and LLM output. Chinese remains the canonical rule/prompt vocabulary, while locale-specific report text and cache entries are isolated by locale and prompt version.

**Tech Stack:** Vue 3, Vue Router, Pinia, vue-i18n 11, Vite, Cloudflare Pages Functions/Worker, Supabase, Node test runner, Playwright.

---

## Scope and release boundaries

### Milestone A — English interface and deterministic enums

Ship a persistent language picker, English application chrome, localized form labels, route metadata, deterministic labels, dates, and browser accessibility metadata. Existing reports, history text, and generated interpretation content may remain Chinese in this milestone; the UI must label that state clearly only where necessary.

### Milestone B — English generated reports and localized discovery data

Add locale to Worker requests, SSE copy, LLM output, cache keys, report persistence, crawler output, and birthplace display/search. This milestone is required before claiming that the product is fully English.

### Non-goals

- Do not replace the Chinese characters used as astronomical/technical source symbols (`甲`, `子`, `开门`, and similar) in computation, database matching, or prompt evidence.
- Do not bulk-update existing database rows or overwrite Chinese LLM reports.
- Do not introduce a second i18n framework or a general automatic-translation dependency.
- Do not localize test fixture names, comments, engine-internal debug output, or scholarly source quotations unless they are rendered to users.

## File structure and ownership

| Path | Responsibility | Milestone |
| --- | --- | --- |
| `src/i18n/index.mjs` | Locale normalization, persistence, singleton locale mutation | A |
| `src/i18n/formatters.mjs` | Locale-aware date, number, and symbol formatting | A |
| `src/i18n/domainLabels.mjs` | Maps stable codes/raw domain symbols to i18n keys; never mutates engine data | A |
| `src/i18n/locales/zh-CN.mjs` | Complete Simplified Chinese UI catalogue | A |
| `src/i18n/locales/en-US.mjs` | Complete English UI catalogue | A |
| `src/components/LocaleMenu.vue` | Reusable `中文 / English` control | A |
| `src/App.vue` | Global navigation and update notice | A |
| `src/views/HomeView.vue` | Qimen input, history, account flow, category display | A/B |
| `src/views/BaziView.vue` | Bazi form, deterministic labels, profile and event UI | A/B |
| `src/views/FortuneView.vue`, `src/views/ReportView.vue`, `src/views/EngineeringView.vue`, `src/views/LegalView.vue`, `src/views/AdminView.vue` | Page-local visible copy and formatting | A |
| `src/router/index.js`, `src/main.js` | Locale-aware document metadata and document language | A |
| `src/i18n/requestLocale.mjs` | Canonical client request locale/header helpers | B |
| `worker/src/index.js` | Locale validation, response/SSE language contract, LLM invocation context | B |
| `lib/outputLanguage.js` | Shared user-prose language instruction for all report prompt builders | B |
| `lib/*Prompt*.js`, `lib/fortune*Core.js`, `lib/baziLlmSections.js`, `lib/wenshiFollowup.js` | Add output-language instruction without changing Chinese computation | B |
| `functions/_middleware.js` | Locale-consistent bot HTML and `hreflang` metadata | B |
| `src/data/birthplaces.mjs`, `src/utils/birthplaceSearch.mjs` | Stable birthplace identity plus locale-specific names/search labels | B |
| `docs/sql/i18n-localized-reports.sql` | Additive locale-scoped report storage for generated prose | B |

## Data and contract rules

1. A code is never a translated string. Existing values such as `career_business`, `job_search`, `M`, `positive`, `engine_ready`, and `llm_complete` remain API/database identifiers.
2. Existing Chinese source symbols remain raw data. A formatter may display `Jia (甲)` but must return the unmodified `甲` to engines and persistence code.
3. Client UI strings use a dot-separated key. Dynamic key construction is allowed only in `domainLabels.mjs`, where each input is validated against an explicit mapping.
4. Requests carry `locale: 'zh-CN' | 'en-US'`. The Worker must normalize any other value to `zh-CN`.
5. A generated or cached report is identified by `(subject, locale, promptVersion, engineVersion)`. An English request must never reuse a Chinese generated prose field.
6. The client must tolerate legacy payloads with only Chinese labels/text. It must render the raw value instead of crashing, and never infer a new machine code from translated English text.

## Task 1: Lock down the locale runtime contract

**Files:**
- Modify: `src/i18n/index.mjs`
- Modify: `src/i18n/index.test.mjs`
- Create: `src/i18n/formatters.mjs`
- Create: `src/i18n/formatters.test.mjs`

- [ ] **Step 1: Add failing tests for changing locale and formatting values.**

```js
import i18n, { setLocale } from './index.mjs';
import { formatDate, formatScore } from './formatters.mjs';

test('setLocale changes the singleton locale and persists its normalized value', () => {
  const writes = [];
  mockGlobal('localStorage', { setItem: (...args) => writes.push(args) });
  assert.equal(setLocale('en'), 'en-US');
  assert.equal(i18n.global.locale.value, 'en-US');
  assert.deepEqual(writes, [['qimen-locale', 'en-US']]);
});

test('formatters honor the supplied locale without changing a source symbol', () => {
  assert.equal(formatScore(72, 'en-US'), '72');
  assert.match(formatDate('2026-07-26T12:00:00Z', 'en-US'), /2026/);
});
```

- [ ] **Step 2: Run the targeted tests and verify they fail because the APIs do not exist.**

Run: `node --test src/i18n/index.test.mjs src/i18n/formatters.test.mjs`
Expected: FAIL mentioning missing `setLocale` and `formatters.mjs`.

- [ ] **Step 3: Implement one mutation path for the existing singleton and pure formatters.**

```js
// src/i18n/index.mjs
export function setLocale(locale) {
  const normalizedLocale = persistLocale(locale);
  i18n.global.locale.value = normalizedLocale;
  if (typeof document !== 'undefined') document.documentElement.lang = normalizedLocale;
  return normalizedLocale;
}

// src/i18n/formatters.mjs
import { normalizeLocale } from './index.mjs';

export function formatDate(value, locale) {
  return new Intl.DateTimeFormat(normalizeLocale(locale), {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(value));
}

export function formatScore(value, locale) {
  return new Intl.NumberFormat(normalizeLocale(locale), { maximumFractionDigits: 0 }).format(value);
}
```

- [ ] **Step 4: Set the document language before mount.**

```js
// src/main.js, immediately before app.mount('#app')
document.documentElement.lang = i18n.global.locale.value;
```

- [ ] **Step 5: Run the targeted tests and the production build.**

Run: `node --test src/i18n/index.test.mjs src/i18n/formatters.test.mjs && npm run build`
Expected: PASS; Vite build and prerender complete without missing-module errors.

- [ ] **Step 6: Commit the isolated runtime foundation.**

```bash
git add src/i18n/index.mjs src/i18n/index.test.mjs src/i18n/formatters.mjs src/i18n/formatters.test.mjs src/main.js
git commit -m "feat(i18n): add runtime locale mutation and formatters"
```

## Task 2: Build complete UI catalogues and a locale picker

**Files:**
- Modify: `src/i18n/locales/zh-CN.mjs`
- Modify: `src/i18n/locales/en-US.mjs`
- Create: `src/components/LocaleMenu.vue`
- Create: `src/components/LocaleMenu.test.mjs`
- Modify: `src/App.vue`

- [ ] **Step 1: Write failing tests for language selection and both required labels.**

```js
test('English catalogue contains the first-release shell keys', () => {
  const i18n = createI18n('en-US');
  assert.equal(i18n.global.t('nav.qimen'), 'Divination');
  assert.equal(i18n.global.t('common.loading'), 'Loading...');
  assert.equal(i18n.global.t('locale.switchToChinese'), '切换至中文');
});

import { readFileSync } from 'node:fs';

test('LocaleMenu delegates a selected locale to setLocale', () => {
  const source = readFileSync(new URL('./LocaleMenu.vue', import.meta.url), 'utf8');
  assert.match(source, /setLocale\(nextLocale\)/);
  assert.match(source, /aria-label/);
});
```

- [ ] **Step 2: Define the catalogue hierarchy identically in both languages.**

```js
// Both locale files must have this root shape.
export default {
  common: { cancel: '', close: '', loading: '', save: '', retry: '', unknown: '' },
  locale: { current: '', switchToEnglish: '', switchToChinese: '' },
  nav: { qimen: '', bazi: '', reports: '', fortune: '' },
  auth: { signIn: '', register: '', guest: '', signOut: '' },
  home: { history: '', newSession: '', loadMore: '', emptyHistory: '' },
  bazi: { profile: '', birthDate: '', gender: '', createProfile: '' },
  fortune: { daily: '', weekly: '', monthly: '', yearly: '' },
  legal: { terms: '', privacy: '' },
  enum: { divination: {}, lifeEvent: {}, bazi: {}, qimen: {} },
};
```

Use `Divination`, `Bazi`, `Reports`, and `Fortune` for the four English navigation labels. Preserve the product name `奇门道 / Qimen Dao` as a brand string rather than translating it differently in each component.

- [ ] **Step 3: Implement an accessible, controlled locale menu.**

```vue
<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale, SUPPORTED_LOCALES } from '../i18n/index.mjs';

const { locale, t } = useI18n();
const selectedLocale = computed({
  get: () => locale.value,
  set: (nextLocale) => setLocale(nextLocale),
});
</script>

<template>
  <label class="locale-menu">
    <span class="sr-only">{{ t('locale.current') }}</span>
    <select v-model="selectedLocale" :aria-label="t('locale.current')">
      <option v-for="item in SUPPORTED_LOCALES" :key="item" :value="item">
        {{ item === 'en-US' ? 'English' : '中文' }}
      </option>
    </select>
  </label>
</template>
```

- [ ] **Step 4: Mount `LocaleMenu` in the global header and convert App-owned visible copy.**

Replace the four `.nav-label` hardcoded values, update-notice ARIA labels, title, body, and action with `t(...)`. Do not translate `UPDATE_PANEL_MATRIX` raw engine symbols in this task; pass presentation data through the formatter in Task 5.

- [ ] **Step 5: Run the component and i18n tests.**

Run: `node --test src/i18n/*.test.mjs src/components/LocaleMenu.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit the reusable UI catalogue and selector.**

```bash
git add src/i18n/locales src/components/LocaleMenu.vue src/components/LocaleMenu.test.mjs src/App.vue
git commit -m "feat(i18n): add English catalogue and locale picker"
```

## Task 3: Localize shared UI chrome and route metadata

**Files:**
- Modify: `src/router/index.js`
- Modify: `src/main.js`
- Modify: `src/components/AccountMenu.vue`
- Modify: `src/components/InstallPrompt.vue`
- Modify: `src/components/OpenSourceLinks.vue`
- Modify: `src/components/TimePickerSheet.vue`
- Modify: `src/views/ResetPasswordView.vue`
- Modify: `src/views/FeedbackView.vue`
- Test: `src/i18n/index.test.mjs`, `src/seoExposure.test.mjs`, component tests that cover the changed components

- [ ] **Step 1: Write a failing route-meta resolver test.**

```js
import { resolveRouteMeta } from './index.js';

test('resolveRouteMeta returns English title and description for English locale', () => {
  const meta = resolveRouteMeta({ meta: { titleKey: 'seo.home.title', descriptionKey: 'seo.home.description' } }, 'en-US');
  assert.equal(meta.title, 'Qimen Dunjia AI — Online Divination');
  assert.match(meta.description, /Qimen Dunjia/);
});
```

- [ ] **Step 2: Replace route text fields with translation keys and export the resolver.**

```js
// src/router/index.js
import i18n from '../i18n/index.mjs';

export function resolveRouteMeta(route, locale = i18n.global.locale.value) {
  const t = i18n.global.t;
  return {
    title: route.meta?.titleKey ? t(route.meta.titleKey, {}, { locale }) : '',
    description: route.meta?.descriptionKey ? t(route.meta.descriptionKey, {}, { locale }) : '',
  };
}

// Route records use keys, e.g.
meta: { titleKey: 'seo.home.title', descriptionKey: 'seo.home.description', robots: 'index, follow' }
```

In `main.js`, call `resolveRouteMeta(to)` inside `router.afterEach`; add a watcher on `i18n.global.locale` that reruns the metadata update for `router.currentRoute.value`.

- [ ] **Step 3: Convert visible copy in shared components only.**

For every changed template use `const { t } = useI18n()` and replace only user-visible literals, including `aria-label`, `placeholder`, `title`, validation messages, buttons, and empty states. Leave CSS class names, localStorage keys, route paths, and Supabase column names unchanged.

- [ ] **Step 4: Run targeted tests and build.**

Run: `node --test src/seoExposure.test.mjs src/components/AccountMenu.test.mjs src/i18n/*.test.mjs && npm run build`
Expected: PASS; browser document titles change when the locale changes.

- [ ] **Step 5: Commit the shared chrome conversion.**

```bash
git add src/router/index.js src/main.js src/components/AccountMenu.vue src/components/InstallPrompt.vue src/components/OpenSourceLinks.vue src/components/TimePickerSheet.vue src/views/ResetPasswordView.vue src/views/FeedbackView.vue src/i18n/locales
git commit -m "feat(i18n): localize shared chrome and route metadata"
```

## Task 4: Introduce a safe deterministic-label adapter

**Files:**
- Create: `src/i18n/domainLabels.mjs`
- Create: `src/i18n/domainLabels.test.mjs`
- Modify: `src/i18n/locales/zh-CN.mjs`
- Modify: `src/i18n/locales/en-US.mjs`

- [ ] **Step 1: Write failing tests that make unmapped values safe.**

```js
import { formatDivinationCategory, formatGan, formatLifeEventImpact } from './domainLabels.mjs';

test('formats stable codes through locale keys and preserves unknown values', () => {
  assert.equal(formatDivinationCategory('career_business', 'en-US'), 'Career & Work');
  assert.equal(formatDivinationCategory('legacy_value', 'en-US'), 'legacy_value');
});

test('formats source symbols without changing the engine-facing source value', () => {
  assert.equal(formatGan('甲', 'en-US'), 'Jia (甲)');
  assert.equal(formatLifeEventImpact(-1, 'en-US'), 'Challenging');
});
```

- [ ] **Step 2: Implement explicit maps, not computed translation keys from user data.**

```js
import i18n from './index.mjs';

const DIVINATION_CATEGORY_KEYS = Object.freeze({
  career_business: 'enum.divination.careerBusiness',
  finance_wealth: 'enum.divination.financeWealth',
  relationship: 'enum.divination.relationship',
  health_action: 'enum.divination.healthAction',
  item_transaction: 'enum.divination.itemTransaction',
  exam_study: 'enum.divination.examStudy',
  lawsuit_legal: 'enum.divination.lawsuitLegal',
  fengshui_house: 'enum.divination.fengshuiHouse',
  pregnancy_birth: 'enum.divination.pregnancyBirth',
  general: 'enum.divination.general',
});

function translate(value, mapping, locale) {
  const key = mapping[value];
  return key ? i18n.global.t(key, {}, { locale }) : String(value ?? '');
}

export const formatDivinationCategory = (value, locale) => translate(value, DIVINATION_CATEGORY_KEYS, locale);
```

Add similarly explicit mappings for subcategories used by `HomeView`, life-event `value` codes used by `BaziView`, score bands, genders, heavenly stems, earthly branches, five elements, ten gods, and Qimen doors/stars/gods that are rendered in Milestone A.

- [ ] **Step 3: Add both Chinese and English values for every mapped key.**

The English catalogue must use an unambiguous glossary. Required examples are `Career & Work`, `Wealth & Finance`, `Relationship`, `Health`, `Favorable`, `Challenging`, `Male`, `Female`, `Jia (甲)`, `Zi (子)`, `Direct Wealth (正财)`, and `Open Door (开门)`.

- [ ] **Step 4: Run the adapter tests.**

Run: `node --test src/i18n/domainLabels.test.mjs`
Expected: PASS and no test relies on changing a raw Chinese domain field.

- [ ] **Step 5: Commit the adapter.**

```bash
git add src/i18n/domainLabels.mjs src/i18n/domainLabels.test.mjs src/i18n/locales
git commit -m "feat(i18n): add safe domain label formatters"
```

## Task 5: Convert Qimen and Bazi deterministic presentation

**Files:**
- Modify: `src/views/HomeView.vue`
- Modify: `src/views/BaziView.vue`
- Modify: `src/components/BaziPillarTable.vue`
- Modify: `src/components/BaziStaticPanel.vue`
- Modify: `src/components/BaziDynamicPanel.vue`
- Modify: `src/components/BaziBackingPanel.vue`
- Modify: `src/views/FortuneView.vue`
- Test: `src/views/HomeView.domain-view.test.mjs`, `src/views/BaziView.layout.test.mjs`, new focused formatter assertions

- [ ] **Step 1: Write failing source-level tests for the adapter boundary.**

```js
test('HomeView formats category codes instead of storing translated display values', () => {
  const source = readFileSync(new URL('./HomeView.vue', import.meta.url), 'utf8');
  assert.match(source, /formatDivinationCategory\(item\.category/);
  assert.doesNotMatch(source, /catLabel:\s*categories\.find\([^\n]+\)\?\.label/);
});

test('BaziView uses locale-aware date formatting', () => {
  const source = readFileSync(new URL('./BaziView.vue', import.meta.url), 'utf8');
  assert.match(source, /formatDate\(value, locale\.value\)/);
  assert.doesNotMatch(source, /toLocaleDateString\('zh-CN'\)/);
});
```

- [ ] **Step 2: Refactor UI option records to retain only stable values.**

```js
// Before: { value: 'career_business', label: '事业职场' }
// After:
const categories = Object.freeze([
  { value: 'all' },
  { value: 'career_business' },
  { value: 'finance_wealth' },
]);

const categoryLabel = (value) => value === 'all'
  ? t('common.all')
  : formatDivinationCategory(value, locale.value);
```

Use the same pattern for Bazi life events and impacts. Preserve values submitted to Supabase exactly as they are today.

- [ ] **Step 3: Localize user-facing Qimen chrome before dynamic report HTML.**

Convert history, login/register, input labels, category filter, validation errors, loading stages, score labels, and static result headings. Dynamic HTML assembled in `HomeView` must receive translated headings as explicit function parameters; it must not reach into global DOM or hardcode English strings.

- [ ] **Step 4: Localize Bazi form and deterministic panel labels.**

Convert input labels, solar/lunar options, gender labels, profile management, life-event categories, validation messages, stream status labels, and panel headings. Render raw engine symbols using `formatGan`, `formatZhi`, `formatWuxing`, `formatShiShen`, and related adapter functions. Do not translate `bazi_detail` in place.

- [ ] **Step 5: Localize Fortune page tabs and locale-sensitive dates.**

Replace hardcoded tab labels, score labels, `年/月/日` suffixes, and `toLocaleDateString()` calls with catalogue keys and `formatDate`. Keep Beijing calculation/time-zone functions unchanged; only presentation formatting is locale-aware.

- [ ] **Step 6: Run the focused suite and build.**

Run: `node --test src/views/HomeView.domain-view.test.mjs src/views/BaziView.layout.test.mjs src/i18n/*.test.mjs && npm run build`
Expected: PASS. A locale toggle changes UI labels without changing a category code, profile payload, or engine symbol.

- [ ] **Step 7: Commit deterministic UI localization.**

```bash
git add src/views/HomeView.vue src/views/BaziView.vue src/views/FortuneView.vue src/components/BaziPillarTable.vue src/components/BaziStaticPanel.vue src/components/BaziDynamicPanel.vue src/components/BaziBackingPanel.vue src/i18n
git commit -m "feat(i18n): localize deterministic qimen and bazi UI"
```

## Task 6: Complete the remaining static pages and English legal copy

**Files:**
- Modify: `src/views/ReportView.vue`
- Modify: `src/views/EngineeringView.vue`
- Modify: `src/views/AdminView.vue`
- Modify: `src/views/LegalView.vue`
- Modify: `src/views/BaziStaticPanelDemo.vue`
- Modify: `src/views/BaziDynamicPanelDemo.vue`
- Modify: `src/i18n/locales/*.mjs`
- Test: `src/views/EngineeringView.test.mjs`, new `src/views/LegalView.test.mjs`

- [ ] **Step 1: Add a failing legal-view test for language-specific content selection.**

```js
test('LegalView selects the English terms document when locale is en-US', () => {
  const source = readFileSync(new URL('./LegalView.vue', import.meta.url), 'utf8');
  assert.match(source, /const documentForLocale/);
  assert.match(source, /locale\.value === 'en-US'/);
});
```

- [ ] **Step 2: Move legal documents into locale catalogues as structured sections.**

```js
// LegalView reads this shape from the active locale.
legal: {
  terms: { title: 'Terms of Service', sections: [{ title: '1. Service', paragraphs: ['These Terms govern your use of Qimen Dao.'] }] },
  privacy: { title: 'Privacy Policy', sections: [{ title: '1. Information We Collect', paragraphs: ['We collect account and usage information needed to provide the service.'] }] },
}
```

Use legally reviewed English content before release. The implementation must not label a machine-translated draft as the production Terms or Privacy Policy.

- [ ] **Step 3: Convert Engineering/Admin/Demo visible copy through `t()` and formatters.**

Keep demo fixture fields in their original raw format and format them at render time. Change Admin timestamps from `'zh-CN'` to the active locale through `formatDate`/a `formatDateTime` companion.

- [ ] **Step 4: Run tests and build.**

Run: `node --test src/views/EngineeringView.test.mjs src/views/LegalView.test.mjs src/i18n/*.test.mjs && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit remaining static page conversion.**

```bash
git add src/views/ReportView.vue src/views/EngineeringView.vue src/views/AdminView.vue src/views/LegalView.vue src/views/BaziStaticPanelDemo.vue src/views/BaziDynamicPanelDemo.vue src/i18n
git commit -m "feat(i18n): localize static pages and legal documents"
```

## Task 7: Add the client-to-Worker locale contract

**Files:**
- Create: `src/i18n/requestLocale.mjs`
- Create: `src/i18n/requestLocale.test.mjs`
- Modify: `src/views/HomeView.vue`
- Modify: `src/views/BaziView.vue`
- Modify: `src/views/FortuneView.vue`
- Modify: `worker/src/index.js`
- Modify: `src/workerBaziSse.test.mjs`

- [ ] **Step 1: Write failing request and Worker normalization tests.**

```js
import { buildLocaleRequestInit } from './requestLocale.mjs';

test('locale request helper sends normalized body and Accept-Language header', () => {
  assert.deepEqual(buildLocaleRequestInit({ method: 'POST', body: { question: 'test' } }, 'en'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept-language': 'en-US' },
    body: JSON.stringify({ question: 'test', locale: 'en-US' }),
  });
});

test('worker normalizes unsupported locale to zh-CN', () => {
  assert.match(workerSource, /function resolveRequestLocale/);
  assert.match(workerSource, /return candidate === 'en-US' \? 'en-US' : 'zh-CN'/);
});
```

- [ ] **Step 2: Create one request helper and use it for every Worker call.**

```js
// src/i18n/requestLocale.mjs
import i18n, { normalizeLocale } from './index.mjs';

export function buildLocaleRequestInit(init = {}, locale = i18n.global.locale.value) {
  const normalizedLocale = normalizeLocale(locale);
  const payload = init.body && typeof init.body !== 'string' ? { ...init.body, locale: normalizedLocale } : undefined;
  return {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers || {}), 'accept-language': normalizedLocale },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  };
}
```

Apply it to Qimen question, Bazi generation, Bazi follow-up, calibration, daily interpretation, and monthly interpretation calls. For GET endpoints append `locale=en-US` using `URLSearchParams`.

- [ ] **Step 3: Normalize locale once at Worker request boundaries.**

```js
function resolveRequestLocale(request, body = {}) {
  const candidate = String(body.locale || request.headers.get('accept-language') || '').split(',')[0].trim();
  return candidate === 'en-US' || candidate.startsWith('en-') ? 'en-US' : 'zh-CN';
}
```

Pass the returned locale through each endpoint handler. Preserve event `type`, `status`, `section`, `category`, and `subcategory` codes; translate event labels on the client in Milestone A or emit a separate `messageKey`.

- [ ] **Step 4: Make streamed errors display-safe.**

For predictable errors, emit `{ type: 'error', code: 'QIMEN_UNAVAILABLE' }` and map the code in the client locale catalogue. Continue including legacy `message` during the compatibility window, but the client must prefer `code` when present.

- [ ] **Step 5: Run contract tests.**

Run: `node --test src/i18n/requestLocale.test.mjs src/workerBaziSse.test.mjs src/workerQimenAudit.test.mjs`
Expected: PASS; tests assert stable machine codes rather than Chinese event labels.

- [ ] **Step 6: Commit the locale wire contract.**

```bash
git add src/i18n/requestLocale.mjs src/i18n/requestLocale.test.mjs src/views/HomeView.vue src/views/BaziView.vue src/views/FortuneView.vue worker/src/index.js src/workerBaziSse.test.mjs src/workerQimenAudit.test.mjs
git commit -m "feat(i18n): carry locale through worker requests and streams"
```

## Task 8: Generate and cache report prose by locale

**Files:**
- Modify: `worker/src/index.js`
- Modify: `lib/qimenPromptSections.js`
- Modify: `lib/baziQuestionCore.js`
- Modify: `lib/baziLlmSections.js`
- Modify: `lib/wenshiFollowup.js`
- Modify: `lib/fortuneDailyCore.js`
- Modify: `lib/fortuneMonthlyInterpretationCore.js`
- Create: `lib/outputLanguage.js`
- Create: `lib/outputLanguage.test.js`
- Modify: `src/fortuneCache.mjs`
- Modify: corresponding `*.test.js` / `*.test.mjs`
- Create: `docs/sql/i18n-localized-reports.sql`

- [ ] **Step 1: Add failing prompt tests that require an output language instruction.**

```js
const { buildOutputLanguageInstruction } = require('./outputLanguage');

test('English output instruction requires English prose and preserves source symbols', () => {
  const instruction = buildOutputLanguageInstruction('en-US');
  assert.match(instruction, /Write every user-facing title, explanation, advice, and error message in clear English/);
  assert.match(instruction, /Chinese metaphysical source symbols in parentheses/);
});

test('Chinese is the default output language for legacy callers', () => {
  assert.match(buildOutputLanguageInstruction(), /使用简体中文/);
});
```

- [ ] **Step 2: Add one shared output-language instruction with a Chinese default.**

```js
function buildOutputLanguageInstruction(locale = 'zh-CN') {
  return locale === 'en-US'
    ? 'Write every user-facing title, explanation, advice, and error message in clear English. Preserve essential Chinese metaphysical source symbols in parentheses on first use; do not translate JSON field names or enum codes.'
    : '所有面向用户的标题、解释、建议与错误信息均使用简体中文。不要翻译 JSON 字段名或枚举 code。';
}

module.exports = { buildOutputLanguageInstruction };
```

Thread `locale` into all user-facing report builders: initial Qimen, initial Bazi, Qimen/Bazi follow-up, daily fortune interpretation, monthly interpretation, and calibration. Classification prompts remain Chinese/internal because their output is machine codes, not user prose.

- [ ] **Step 3: Version cache keys by locale and prompt version.**

```js
export function buildLocalizedCacheKey(baseKey, locale, promptVersion) {
  return `${baseKey}:locale=${locale}:prompt=${promptVersion}`;
}
```

Use it in browser fortune cache and Worker/Supabase lookup keys. An old cache key is readable only for the default Chinese locale; an English request must produce a miss and regenerate English text.

- [ ] **Step 4: Persist localized report fields additively.**

Create `docs/sql/i18n-localized-reports.sql` with a table keyed by the source record ID, locale, engine version, and prompt version:

```sql
create table if not exists public.localized_reports (
  source_type text not null,
  source_id text not null,
  locale text not null check (locale in ('zh-CN', 'en-US')),
  engine_version text not null,
  prompt_version text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_type, source_id, locale, engine_version, prompt_version)
);
```

Do not update or delete existing Chinese columns. Read localized storage first, then retain the legacy Chinese response only when `locale === 'zh-CN'`.

- [ ] **Step 5: Add regression tests for cache isolation and fallback.**

```js
test('English report cache does not reuse Chinese prose', () => {
  rememberLocalizedCache(storage, 'daily:user-1:2026-07-26', 'zh-CN', 'v1', { summary: '中文' });
  assert.equal(loadLocalizedCache(storage, 'daily:user-1:2026-07-26', 'en-US', 'v1'), null);
});
```

- [ ] **Step 6: Run all prompt, cache, and Worker suites.**

Run: `node --test lib/outputLanguage.test.js lib/qimenPromptSections.test.js lib/baziQuestionCore.test.js lib/baziLlmSections.test.js lib/wenshiFollowup.test.js lib/fortuneDailyCore.test.js lib/fortuneMonthlyInterpretationCore.test.js src/fortuneCache.test.mjs src/workerBaziSse.test.mjs`
Expected: PASS; English and Chinese tests produce separate cache identities.

- [ ] **Step 7: Commit report localization independently from UI changes.**

```bash
git add worker/src/index.js lib/outputLanguage.js lib/outputLanguage.test.js lib/qimenPromptSections.js lib/baziQuestionCore.js lib/baziLlmSections.js lib/wenshiFollowup.js lib/fortuneDailyCore.js lib/fortuneMonthlyInterpretationCore.js src/fortuneCache.mjs docs/sql/i18n-localized-reports.sql
git add lib/*.test.js src/fortuneCache.test.mjs src/workerBaziSse.test.mjs
git commit -m "feat(i18n): generate and cache reports by locale"
```

## Task 9: Localize bot output and establish discoverable English URLs

**Files:**
- Modify: `functions/_middleware.js`
- Modify: `src/router/index.js`
- Modify: `src/seoExposure.test.mjs`
- Modify: `functions/_middleware.test.js` (create if absent)

- [ ] **Step 1: Write failing middleware tests for English body text and language annotations.**

```js
test('English bot response localizes title, h1, intro, navigation, and html lang', async () => {
  const response = await onRequest({ request: botRequest('/', 'en-US'), next: () => null });
  const html = await response.text();
  assert.match(html, /<html lang="en-US">/);
  assert.match(html, /<h1>Qimen Dunjia AI/);
  assert.doesNotMatch(html, /<h1>奇门遁甲/);
});
```

- [ ] **Step 2: Store complete locale variants in each route record.**

```js
const ROUTE_META = {
  '/': {
    zh: { title: '奇门遁甲 AI 引擎 — 免费在线排盘推演', h1: '奇门遁甲 AI 引擎', intro: '先让规则落盘，再让模型开口。' },
    en: { title: 'Qimen Dunjia AI — Online Divination', h1: 'Qimen Dunjia AI', intro: 'Rules first, then AI interprets.' },
  },
};
```

`buildBotHtml` must select `title`, `description`, `h1`, `intro`, navigation labels, `og:site_name`, and the `lang` attribute from the same locale object.

- [ ] **Step 3: Choose and implement one canonical SEO strategy.**

Use `/en`, `/en/bazi`, `/en/fortune`, `/en/engineering`, `/en/terms`, and `/en/privacy` as English route aliases. Add `hreflang="zh-CN"`, `hreflang="en-US"`, and `hreflang="x-default"` links; use each language-specific URL as its own canonical URL. The locale menu should navigate between paired paths when a localized alias exists.

- [ ] **Step 4: Run SEO and middleware tests.**

Run: `node --test src/seoExposure.test.mjs functions/_middleware.test.js && npm run build`
Expected: PASS; bot HTML and SPA document metadata agree for each locale path.

- [ ] **Step 5: Commit SEO localization.**

```bash
git add functions/_middleware.js functions/_middleware.test.js src/router/index.js src/seoExposure.test.mjs
git commit -m "feat(i18n): localize bot SEO and English routes"
```

## Task 10: Localize birthplace search without changing birthplace identity

**Files:**
- Modify: `src/data/birthplaces.mjs`
- Modify: `src/utils/birthplaceSearch.mjs`
- Modify: `src/utils/birthplaceSearch.test.mjs`
- Modify: `src/views/BaziView.vue`

- [ ] **Step 1: Write failing search tests for English display and Chinese lookup compatibility.**

```js
test('English locale displays Beijing while Chinese aliases still find the same stable id', () => {
  const english = searchBirthplaces('Beijing', 1, 'en-US')[0];
  const chinese = searchBirthplaces('北京', 1, 'zh-CN')[0];
  assert.equal(english.id, chinese.id);
  assert.match(english.label, /Beijing/);
});
```

- [ ] **Step 2: Extend records additively with optional English fields.**

```js
{
  id: 10000000,
  name: '北京市',
  nameEn: 'Beijing',
  admin1: '北京',
  admin1En: 'Beijing',
  country: '中国',
  countryEn: 'China',
  // existing coordinates, aliases, and stable fields remain unchanged
}
```

Populate English fields from the existing GeoNames generation source where available. Keep original Chinese names and aliases in the search token index.

- [ ] **Step 3: Make formatting and sorting locale-aware.**

```js
export function formatPlaceLabel(place, locale = 'zh-CN') {
  const en = locale === 'en-US';
  const name = en ? (place.nameEn || place.name) : place.name;
  const admin1 = en ? (place.admin1En || place.admin1) : place.admin1;
  const country = en ? (place.countryEn || place.country) : place.country;
  return [name, admin1, country].filter(Boolean).join(en ? ', ' : ' · ');
}
```

Pass `locale.value` from `BaziView` to search and option helpers. Keep the selected record's `id`, coordinates, and original saved profile fields unchanged.

- [ ] **Step 4: Run birthplace and profile-input tests.**

Run: `node --test src/utils/birthplaceSearch.test.mjs src/utils/baziProfileInput.test.mjs`
Expected: PASS; Chinese historical searches and English user input resolve to the same record IDs.

- [ ] **Step 5: Commit birthplace localization.**

```bash
git add src/data/birthplaces.mjs src/utils/birthplaceSearch.mjs src/utils/birthplaceSearch.test.mjs src/views/BaziView.vue
git commit -m "feat(i18n): localize birthplace search and display"
```

## Task 11: Add release gates and execute the bilingual acceptance matrix

**Files:**
- Modify: `src/i18n/index.test.mjs`
- Create: `src/i18n/catalogueParity.test.mjs`
- Create: `docs/i18n-manual-acceptance.md`
- Modify: `README.md`

- [ ] **Step 1: Add catalogue parity tests.**

```js
function leafPaths(object, prefix = '') {
  return Object.entries(object).flatMap(([key, value]) =>
    value && typeof value === 'object'
      ? leafPaths(value, `${prefix}${key}.`)
      : [`${prefix}${key}`]
  );
}

test('English and Chinese catalogues have identical leaf keys', () => {
  assert.deepEqual(leafPaths(enUS).sort(), leafPaths(zhCN).sort());
});
```

- [ ] **Step 2: Add a manual browser acceptance checklist for each shipped Milestone A behavior.**

The repository has Playwright installed but no existing Playwright configuration or browser-test directory. Create `docs/i18n-manual-acceptance.md` with the following exact acceptance scenario, then execute it against a local production preview before each release:

```markdown
1. Open `/`, choose `English` from the Language control, and confirm the bottom navigation shows `Divination`, `Bazi`, `Reports`, and `Fortune`.
2. Reload `/` and confirm English remains selected and the URL has not changed from `/`.
3. Open the Qimen history drawer and verify its category filter displays `Career & Work` while a loaded record still sends `career_business` to the API.
4. Open `/bazi`, confirm gender and life-event labels are English, enter an English birthplace query, and verify the chosen record retains its original numeric birthplace ID and coordinates.
5. Switch to `中文`, reload, and confirm all labels return to Chinese without clearing the selected profile or historical record.
6. In Milestone B, submit one English Qimen request and one Chinese Qimen request; verify their streamed prose and cache entries remain in their requested language.
```

The checklist must additionally record the browser version, preview URL, tester, date, and whether the browser console contains an error.

- [ ] **Step 3: Run the complete quality gate.**

Run: `npm test && npm run build`
Expected: all existing tests plus new i18n tests pass, build/prerender completes, and no missing-translation warnings appear.

- [ ] **Step 4: Add operating guidance to README.**

Document the supported locales, how to add a catalogue key, the rule that codes are never translated, how locale enters Worker requests, and the cache-version requirement for a changed LLM prompt.

- [ ] **Step 5: Commit release gates and documentation.**

```bash
git add src/i18n/index.test.mjs src/i18n/catalogueParity.test.mjs docs/i18n-manual-acceptance.md README.md
git commit -m "test(i18n): add bilingual release gates"
```

## Release checklist

- [ ] Milestone A: locale picker persists `en-US` and `zh-CN`; refreshing preserves the selection.
- [ ] Milestone A: no static visible UI text remains hardcoded in the application shell, Qimen input/history, Bazi form/profile/event flow, Fortune tabs, or shared dialogs.
- [ ] Milestone A: changing locale changes only display copy; category, subcategory, profile, database, routing, SSE type, and engine symbols remain stable.
- [ ] Milestone A: English and Chinese catalogue leaf keys match exactly.
- [ ] Milestone B: every interpretation request includes normalized locale; every English report cache key differs from the Chinese key.
- [ ] Milestone B: English LLM reports are generated in English and retain source symbols where helpful; legacy Chinese reports remain intact.
- [ ] Milestone B: English crawler output has localized title, description, `h1`, intro, navigation, canonical URL, and `hreflang` links.
- [ ] Milestone B: English and Chinese birthplace searches resolve the same stable birthplace record and coordinates.
- [ ] Full suite passes: `npm test && npm run build`.

## Implementation notes for reviewers

- Reject any change that replaces a raw rule value with its English label before computation or persistence.
- Reject dynamic `$t(\`enum.${value}\`)` calls where `value` comes from a user, model, or database. Add the value to an explicit adapter map instead.
- Reject a cache lookup that omits locale or prompt version for generated prose.
- Reject English Terms/Privacy production copy that has not been legally reviewed.
- Keep commits scoped to the tasks above so Milestone A can ship independently of Worker/report work.

## Self-review

Coverage check: Tasks 1–6 cover i18n runtime, catalogue, language selection, static interface, deterministic enum formatting, route metadata, legal copy, dates, and page-level UI. Tasks 7–8 cover locale propagation, stable SSE codes, generated reports, and cache/persistence isolation. Tasks 9–10 cover crawler SEO and birthplace presentation/search. Task 11 supplies catalogue parity, browser acceptance, the full quality gate, and operating documentation.

Compatibility check: no task changes existing engine symbols, category codes, profile column meanings, or historical Chinese prose. New localized report storage is additive and locale-scoped.

Naming check: `setLocale`, `formatDate`, `formatScore`, `formatDivinationCategory`, `buildLocaleRequestInit`, `resolveRequestLocale`, and `buildLocalizedCacheKey` are defined before later tasks refer to them.
