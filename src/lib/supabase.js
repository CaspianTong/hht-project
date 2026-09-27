/* =====================================================================
 * supabase —— Supabase 客户端实例
 * ===================================================================== */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tnwrnisjsgxfscicmgpm.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRud3JuaXNqc2d4ZnNjaWNtZ3BtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mjg0MzcsImV4cCI6MjEwNjAwNDQzN30.HvG8K9GpZJj30XdDXNNwpMqSV0uQwzsel-JMhn4RdGc';

export const isSupabaseReady = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseReady
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

if (!isSupabaseReady) {
  console.warn('[supabase] 缺少配置');
}