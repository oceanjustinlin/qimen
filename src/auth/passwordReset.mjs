export const buildPasswordResetEmailArgs = (href) => ({
  redirectTo: `${new URL(href).origin}/reset-password`
})

// t 可选：传入 vue-i18n 的 t 时返回当前语言的提示；不传时返回简体原文（兼容旧调用）。
export const validatePasswordUpdate = (password, confirmPassword, t) => {
  if (!password || password.length < 6) return t ? t('auth.passwordTooShort') : '新密码至少需要 6 位' // i18n-ignore 兼容默认值
  if (password !== confirmPassword) return t ? t('auth.passwordMismatch') : '两次输入的密码不一致' // i18n-ignore 兼容默认值
  return ''
}
