// English catalogue. Keys must mirror zh-CN.mjs exactly (see catalogueParity.test.mjs).
import home from './en-US/home.mjs'
import bazi from './en-US/bazi.mjs'
import resetPassword from './en-US/resetPassword.mjs'
import feedbackPage from './en-US/feedbackPage.mjs'
import reports from './en-US/reports.mjs'
import fortune from './en-US/fortune.mjs'
import about from './en-US/about.mjs'
import legal from './en-US/legal.mjs'
import ziwei from './en-US/ziwei.mjs'
import error from './en-US/error.mjs'
import sse from './en-US/sse.mjs'
import result from './en-US/result.mjs'

export default {
  home,
  bazi,
  resetPassword,
  feedbackPage,
  reports,
  fortune,
  about,
  legal,
  ziwei,
  error,
  sse,
  result,
  common: {
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    save: 'Save',
    loading: 'Loading…',
    retry: 'Retry',
    back: 'Back',
    all: 'All',
    none: 'None yet',
    pending: 'Pending',
    generating: 'Generating…',
  },
  brand: {
    name: 'Qimen Dao',
    tagline: 'See the pattern, choose the moment',
  },
  nav: {
    ask: 'Ask',
    bazi: 'Bazi',
    reports: 'Reports',
    fortune: 'Fortune',
    qimen: 'Qimen',
  },
  account: {
    menu: 'Account menu',
    menuTitle: 'Account',
    identityGuest: 'Guest mode',
    identityAnonymous: 'Not signed in',
    about: 'About',
    changePassword: 'Change password',
    signIn: 'Sign in',
    register: 'Sign up',
    signOut: 'Sign out',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeSystem: 'System',
    language: 'Language',
    feedback: 'Feedback & ideas',
  },
  seo: {
    defaultTitle: 'Qimen Dunjia Online Chart, AI Reading & Bazi Fortune - Qimen Dao',
    home: { title: 'Qimendao — Qimen Dunjia Online Chart & AI Reading', description: 'Qimendao: free online Qimen Dunjia chart, AI reading, Bazi four-pillar chart and daily fortune. A rule engine computes the chart first; AI explains it.' },
    bazi: { title: 'Bazi Four Pillars — Qimen AI', description: 'Professional Bazi four-pillars chart: ten gods, patterns, major cycles and yearly luck in one click.' },
    reports: { title: 'Reports — Qimen AI', description: 'Your Bazi, compatibility and fortune reports.' },
    fortune: { title: 'Daily Fortune — Qimen AI', description: 'Rule-engine powered daily, weekly and monthly fortune analysis based on Qimen Dunjia and your Bazi.' },
    engineering: { title: 'Engineering Mode — Qimen AI', description: 'Visual Qimen rule engine with open scoring audit and palace details for technical research.' },
    feedback: { title: 'Feedback & Ideas — Qimen AI', description: 'Send product feedback, feature ideas or content corrections.' },
    resetPassword: { title: 'Reset Password — Qimen AI', description: '' },
    terms: { title: 'Terms of Service — Qimen AI', description: '' },
    privacy: { title: 'Privacy Policy — Qimen AI', description: '' },
  },
  timePicker: {
    unitYear: '',
    unitMonth: '',
    unitDay: '',
    unitHour: 'h',
    unitMinute: 'm',
    preview: '{year}-{month}-{day} {hour}:{minute}',
    title: 'Choose chart time · Gregorian',
    inputPlaceholder: 'Type 202606121416 or scroll',
    recognize: 'Apply',
    hintNeedDigits: 'Enter 12 digits: year(4) month day hour minute',
    hintOutOfRange: 'Date or time out of range',
    hintRecognized: 'Applied',
  },
  links: {
    openSource: 'Open-source links',
    viewGithub: 'View source on GitHub',
    githubSource: 'GitHub source',
    afdian: 'Support on Afdian',
    supportCreator: 'Support the creator',
  },
  auth: {
    passwordTooShort: 'New password must be at least 6 characters',
    passwordMismatch: 'The two passwords do not match',
  },
  qimenFeedback: {
    accuracy: {
      fulfilled: 'Came true',
      partially_fulfilled: 'Partly came true',
      not_fulfilled: 'Did not come true',
      pending: 'Too early to tell',
    },
    direction: {
      better: 'Better than predicted',
      matched: 'About as predicted',
      worse: 'Worse than predicted',
      pending: 'No outcome yet',
    },
  },
  enum: {
    category: {
      career_business: 'Career',
      finance_wealth: 'Wealth & Investment',
      relationship: 'Love & Relationships',
      health_action: 'Health',
      item_transaction: 'Deals & Lost Items',
      exam_study: 'Exams & Study',
      lawsuit_legal: 'Legal Matters',
      fengshui_house: 'Home & Feng Shui',
      pregnancy_birth: 'Pregnancy & Children',
      general: 'General',
    },
    scoreBand: {
      aboveAverage: 'Above Average',
      average: 'Average',
      belowAverage: 'Below Average',
    },
    verdict: {
      great: 'Highly Favorable',
      good: 'Favorable',
      neutral: 'Neutral',
      bad: 'Unfavorable',
    },
    gender: {
      M: 'Male',
      F: 'Female',
      zaoM: 'Male chart',
      zaoF: 'Female chart',
    },
  },
};
