/* =====================================================================
 * supabase —— Supabase 客户端实例（全站唯一入口）
 *
 * 连接信息来自项目根目录的 .env.local（Vite 只把 VITE_ 前缀的变量注入
 * import.meta.env）：
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon public key>
 * ⚠️ 改完 .env.local 必须重启 dev server（npm run dev）才会生效。
 *
 * anon key 属于「可以公开的前端密钥」，真正的权限由 Supabase 侧的
 * RLS 策略与存储过程决定：本站只在浏览器里读 songs 表、调 increment_vote。
 * ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** 环境变量是否齐备：缺任意一个都不建客户端，交给调用方渲染「未配置」提示，避免整站白屏 */
export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey, {
      /* 本站没有登录体系（投票人身份走 localStorage + 存储过程参数），
         关掉会话持久化 / 自动续期，免得 localStorage 里多出一份用不上的 auth token */
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!isSupabaseReady) {
  console.warn(
    '[supabase] 缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY：请在项目根目录的 .env.local 里补齐，然后重启 dev server。',
  );
}
