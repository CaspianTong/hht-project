/* =====================================================================
 * supabase —— Supabase 客户端实例
 * ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tnwrnisjsgxfscicmgpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud3JuaXNqc2d4ZnNjaWNtZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mjg0MzcsImV4cCI6MjEwNjAwNDQzN30.HvG8K9GpZJj30XdDXNNwpMqSV0uQwzsel-JMhn4RdGc';

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

/* iOS Safari / 微信内置浏览器有时会复用旧的 GET 缓存（兑换码刚被用过，
   手机仍读到旧状态）。所有 Supabase 请求统一加 cache: 'no-store'，
   只影响浏览器缓存策略，不改请求头、不会触发额外 CORS 预检。 */
const noStoreFetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' });

export const supabase = isSupabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: noStoreFetch },
    })
  : null;

if (!isSupabaseReady) {
  console.warn('[supabase] 缺少配置');
}