/* =====================================================================
 * 平台常量 + 兑换投票次数（8 位验证码）工具
 *
 * 歌曲数据已全部改为实时来自 Supabase 的 songs 表
 * （读取 / 按 votes_count 降序 / Realtime 监听都集中在 App.jsx 的
 *   【Supabase 数据层】一段），原先写死的 6 首静态 Mock 歌曲已按需求删除。
 * ===================================================================== */

export const PLATFORM_NAME = '尚雅2026校运会音乐投票';
export const PLATFORM_SLOGAN = '为赛场热血，投出你的 BGM';

/* =====================================================================
 * 兑换投票次数（8 位验证码 → +5 票）
 *
 * 【后端接入点】核销已接 Supabase：App.jsx 的 handleRedeem 直接读写
 * redemption_codes 表（查 code 且 used = false → 置 used = true + used_at → 加票），
 * 一码一次由数据库兜住；本文件只保留下面两个纯常量。
 * ===================================================================== */

/** 兑换码长度（8 位：数字 / 字母，与首屏浮层里的 <CodeSlots length={8} allowLetters /> 一一对应） */
export const VOTE_CODE_LENGTH = 8;

/** 每成功兑换一次增加的投票次数 */
export const VOTES_PER_CODE = 5;

/* 兑换码不再有客户端演示值：有效性 / 是否已核销一律以 redemption_codes 表为准 */
