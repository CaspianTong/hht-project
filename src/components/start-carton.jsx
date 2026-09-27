/* =====================================================================
 * FoldText —— 折叠翻页文字动画（逐字 3D 折纸翻转 + 折痕阴影）
 *
 * 视觉契约全在 ./start-carton.css（本次不动样式，只补上配套的 JS 逻辑）：
 *   .fold-text              根节点：颜色 / 字号 / 字重可被 CSS 变量覆盖
 *   .fold-text-sr-only      读屏文本（视觉层整体 aria-hidden，读屏只读这一份）
 *   .fold-text-visual       视觉层（下面 -line / -segment / -piece / -whitespace 都在它里面）
 *   .fold-text-line         一行
 *   .fold-text-segment      透视容器（perspective: var(--fold-perspective)）
 *   .fold-text-piece        单个「字」：3D 翻转本体
 *                             data-fold-hinge 决定绕哪条边翻（top/bottom/left/right）
 *                             --fold-crease  控制 ::after 折痕阴影的深浅
 *
 * 动画节奏：一个 cycle = 「折入 → 停驻 → 折出 → 隐形归位」，每个字错峰 staggerMs 毫秒，
 *           所以 7 个字母的 "loading" 会像纸带一样依次翻上来、停一下、再依次翻走。
 *
 * 可用 CSS 变量（都在根节点上，会继承下去）：
 *   --fold-text-color / --fold-text-font-size / --fold-text-font-weight / --fold-perspective
 *
 * 无障碍：视觉层 aria-hidden，读屏只读 srText（默认取 text）；prefers-reduced-motion: reduce
 *         时不做任何逐帧动画，直接把字平铺显示。
 * ===================================================================== */
import { useEffect, useRef } from 'react';
import './start-carton.css';
import {
  FOLD_CYCLE_MS,
  FOLD_STAGGER_MS,
  FOLD_FLIP_DEG,
  FOLD_HINGES as HINGES,
  FALLBACK_HINGE,
  HIDDEN_FRAME,
  foldFrame,
  buildRows,
} from '../utils/foldText';

/* 折叠动画的纯逻辑（时间轴 / 文本拆分 / 铰链表）都在 utils/foldText.js 里 ——
   组件文件只允许导出组件（react-refresh/only-export-components），所以这里只做接线：
   把 foldFrame 算出的每一帧写进字块的 inline style。 */

/* 时间戳统一走模块级函数：组件体内直接调 performance.now() 会被 react-hooks/purity
   判成「渲染期调用非纯函数」，而这里只会出现在 rAF 回调里（渲染期一次都不调）。 */
const now = () => performance.now();

/**
 * @component
 * @param {Object} props
 * @param {string} props.text        要展示的文字（支持 \n 换行）
 * @param {string} [props.className] 追加到根节点（通常在这里给 .fold-text 配色 / 字号）
 * @param {Object} [props.style]     追加内联样式
 * @param {string} [props.as]        根节点标签，默认 span
 * @param {string} [props.srText]    读屏文本，默认取 text
 * @param {string} [props.split]     'word' | 'line'（见 buildRows）
 * @param {string|string[]} [props.hinge] 铰链：单个值或列表，默认 ['bottom','top'] 交替
 * @param {number} [props.cycleMs]   一个循环的时长
 * @param {number} [props.staggerMs] 每个字的错峰间隔
 * @param {number} [props.perspective] 3D 透视距离（px）
 */
export default function FoldText({
  text,
  className = '',
  style,
  as: Tag = 'span',
  srText,
  split = 'word',
  hinge = ['bottom', 'top'],
  cycleMs = FOLD_CYCLE_MS,
  staggerMs = FOLD_STAGGER_MS,
  perspective = 700,
}) {
  const pieceRefs = useRef([]);

  const hingeKey = Array.isArray(hinge) ? hinge.join('|') : String(hinge);
  const { rows, pieceCount } = buildRows(text, split, hingeKey.split('|'));

  /* 逐帧折叠：只写 inline transform / opacity / --fold-crease，绝不碰 className ——
     className 一旦被 React 重写，外部样式与 JS 写的标记都会跟着闪断。 */
  useEffect(() => {
    const nodes = pieceRefs.current.filter(Boolean);
    if (!nodes.length) return undefined;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduce) {
      /* 减弱动效：直接平铺显示（CSS 里也有 !important 兜底，双保险） */
      nodes.forEach((el) => {
        el.style.transform = 'none';
        el.style.opacity = '1';
        el.style.setProperty('--fold-crease', '0');
      });
      return undefined;
    }

    let raf = 0;
    const start = now();

    const paint = (frameTime) => {
      const elapsed = frameTime - start;
      nodes.forEach((el, i) => {
        const local = elapsed - i * staggerMs;
        const frame = local < 0 ? HIDDEN_FRAME : foldFrame(local / cycleMs);
        const { axis, dir } = HINGES[el.dataset.foldHinge] ?? HINGES[FALLBACK_HINGE];
        el.style.transform = `rotate${axis}(${(-dir * FOLD_FLIP_DEG * frame.k).toFixed(2)}deg)`;
        el.style.opacity = frame.opacity.toFixed(3);
        el.style.setProperty('--fold-crease', frame.crease.toFixed(3));
      });
      raf = window.requestAnimationFrame(paint);
    };

    raf = window.requestAnimationFrame(paint);
    return () => window.cancelAnimationFrame(raf);
  }, [text, split, hingeKey, cycleMs, staggerMs, pieceCount]);

  return (
    <Tag
      className={`fold-text${className ? ` ${className}` : ''}`}
      style={{ '--fold-perspective': `${perspective}px`, ...style }}
    >
      <span className="fold-text-sr-only">{srText ?? text}</span>

      <span className="fold-text-visual" aria-hidden="true">
        {rows.map((row) => (
          <span className="fold-text-line" key={row.key}>
            {row.segments.map((seg) =>
              seg.blank ? (
                <span className="fold-text-whitespace" key={seg.key}>
                  {'\u00A0'.repeat(seg.text.length)}
                </span>
              ) : (
                <span className="fold-text-segment" data-fold-split={split} key={seg.key}>
                  {seg.pieces.map((piece) => (
                    <span
                      className="fold-text-piece"
                      data-fold-hinge={piece.hinge}
                      key={piece.key}
                      /* 旋转原点贴着「门轴」那条边：像折纸一样沿线翻，而不是原地打转 */
                      style={{ transformOrigin: HINGES[piece.hinge].origin }}
                      ref={(el) => {
                        pieceRefs.current[piece.index] = el;
                      }}
                    >
                      {piece.char}
                    </span>
                  ))}
                </span>
              ),
            )}
          </span>
        ))}
      </span>
    </Tag>
  );
}

