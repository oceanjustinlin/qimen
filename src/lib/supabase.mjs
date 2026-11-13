import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// 单例：整个应用共享一个客户端，避免多实例争抢同一把认证锁（navigator.locks）
// 导致 getSession() 在 token 刷新期间被阻塞数秒。
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
