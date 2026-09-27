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
 * 【后端接入点】把 verifyVoteCode 换成真实请求即可：
 *   POST /api/votes/redeem  { code }  →  { ok: boolean }
 * 前端只依赖「返回 true / false」这一个契约，其余 UI 无需改动；
 * “一个码只能用一次”由 App 的 usedCodes 状态在本地兜住。
 * ===================================================================== */

/** 兑换验证码长度（8 位数字，与首屏浮层里的 <CodeSlots length={8} /> 一一对应） */
export const VOTE_CODE_LENGTH = 8;

/** 每成功兑换一次增加的投票次数 */
export const VOTES_PER_CODE = 5;

/** 演示环境的 8 位兑换验证码（正式上线由校广播站按班级 / 社团下发，一码一次） */
export const DEMO_VOTE_CODES = ['20260926', '20261008', '20261120'];

/** 校验兑换验证码（Mock：模拟一次网络往返后返回结果） */
export async function verifyVoteCode(code) {
  await new Promise((resolve) => setTimeout(resolve, 620));
  return DEMO_VOTE_CODES.includes(String(code ?? '').trim());
}
