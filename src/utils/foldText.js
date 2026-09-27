/* =====================================================================
 * foldText —— 「折叠翻页文字」动画的纯逻辑层（无 React、无 DOM，可单独验证）
 *
 *   foldFrame(p)        循环进度（0–1）→ 这一帧的折叠系数 / 透明度 / 折痕强度
 *   buildRows(...)      文本 → 「行 → 段 → 字」结构（每个字带全局序号与铰链）
 *   FOLD_HINGES         铰链 → 旋转轴 / 旋转原点 / 折离方向
 *
 * 组件 src/components/start-carton.jsx 只负责把这里的结果接到 DOM 上（逐帧写 style），
 * 样式契约在 src/components/start-carton.css（.fold-text-piece / --fold-crease / data-fold-hinge）。
 * ===================================================================== */

/* 一个完整折叠循环 + 每个字的错峰间隔（毫秒） */
export const FOLD_CYCLE_MS = 1600;
export const FOLD_STAGGER_MS = 70;
/* 折到「看不见」需要的角度：略过 90°，让 backface-visibility 彻底把它翻过去 */
export const FOLD_FLIP_DEG = 92;

/* 铰链 → 旋转轴 / 旋转原点 / 折离方向。
 * 相邻两个字一个向上折、一个向下折，看起来就像纸带翻面（原点贴着「门轴」那条边）。 */
export const FOLD_HINGES = {
  bottom: { axis: 'X', origin: '50% 100%', dir: -1 },
  top: { axis: 'X', origin: '50% 0%', dir: 1 },
  left: { axis: 'Y', origin: '0% 50%', dir: 1 },
  right: { axis: 'Y', origin: '100% 50%', dir: -1 },
};
export const FALLBACK_HINGE = 'bottom';

/* 完全隐形的一帧：还没轮到 / 已经折走 —— 不赋这个值的话，负数时刻会被取模成循环中段 */
export const HIDDEN_FRAME = { k: -1, opacity: 0, crease: 0 };

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInCubic = (t) => t ** 3;

/**
 * 循环进度 p（0–1，越界自动取模）→ 该帧的折叠系数 / 透明度 / 折痕强度
 *   k        -1 = 完全折离（隐形）   0 = 平铺正面   +1 = 朝观众折走（淡出）
 *   opacity  0–1
 *   crease   0–1，写进 --fold-crease，驱动 ::after 的折痕阴影
 * @param {number} p 循环进度（0–1）
 * @returns {{ k: number, opacity: number, crease: number }}
 */
export function foldFrame(p) {
  const t = ((p % 1) + 1) % 1;

  if (t < 0.32) {
    /* 折入：从反面（-1）翻到正面（0），折痕最浓 → 消失 */
    const e = easeOutCubic(t / 0.32);
    return { k: -1 + e, opacity: e, crease: 0.85 * (1 - e) };
  }
  if (t < 0.62) {
    /* 停驻：±0.035 的轻微起伏，像纸还在轻轻呼吸，折痕几乎不见 */
    const w = Math.sin(((t - 0.32) / 0.3) * Math.PI);
    return { k: -0.035 * w, opacity: 1, crease: 0.05 * w };
  }
  if (t < 0.84) {
    /* 折出：从正面（0）折到反方向（+1）并淡出，折痕重新变浓 */
    const e = easeInCubic((t - 0.62) / 0.22);
    return { k: e, opacity: 1 - 0.92 * e, crease: 0.85 * e };
  }
  /* 归位：隐形等下一轮，避免「折回去」被看见 */
  return HIDDEN_FRAME;
}

/**
 * 把文本拆成「行 → 段 → 字」三层结构，并给每个字编号 + 定铰链
 * @param {string} text      原始文本（\n 换行）
 * @param {string} split     'word' 每个词一段（默认，透视按词算，长句更稳）
 *                           'line' 整行一段（配 .fold-text-segment[data-fold-split='line']）
 * @param {string[]} hinges  铰链列表，按字的全局序号循环取用
 */
export function buildRows(text, split, hinges) {
  let pieceIndex = -1;

  const rows = String(text ?? '')
    .split('\n')
    .map((line, li) => {
      /* 空白字符单独成段：保留宽度，但不参与折叠（否则空格会翻成一个方块） */
      const chunks = split === 'line' ? [line] : line.split(/(\s+)/).filter(Boolean);

      const segments = chunks.map((chunk, si) => {
        if (/^\s+$/.test(chunk)) {
          return { key: `ws-${li}-${si}`, blank: true, text: chunk, pieces: [] };
        }
        const pieces = [...chunk].map((char) => {
          pieceIndex += 1;
          return {
            key: `piece-${pieceIndex}`,
            char,
            index: pieceIndex,
            hinge: hinges[pieceIndex % hinges.length] ?? FALLBACK_HINGE,
          };
        });
        return { key: `seg-${li}-${si}`, blank: false, text: chunk, pieces };
      });

      return { key: `line-${li}`, segments };
    });

  return { rows, pieceCount: pieceIndex + 1 };
}
