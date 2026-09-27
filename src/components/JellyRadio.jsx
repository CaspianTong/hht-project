/* =====================================================================
 * JellyRadio —— 果冻质感单选组（React Bits 组件 · JavaScript + CSS 变体）
 *
 * 来源：reactbits.dev 的 <JellyRadio />（实现基于 motion）
 * 上游逻辑完整保留：弹簧位移 / “先宽后高”的 jelly 形变 / 邻居让位与推挤 /
 * 交错 stagger / 方向键 · Home · End / RTL 镜像 / disabled /
 * prefers-reduced-motion 降级 / radiogroup 无障碍语义。
 *
 * 为适配本项目 eslint-plugin-react-hooks v7 的 React Compiler 规则
 * （禁止渲染期写 ref），只做三处「行为等价」改写：
 *
 *   1) 渲染期直写 cfg.current（物理参数快照）→ 改为 useLayoutEffect 同步。
 *      该布局副作用声明在 settle 副作用之前 —— 布局副作用按声明顺序执行，
 *      所以 apply() 读到的永远是本轮 props，语义与上游完全一致。
 *   2) 渲染期惰性创建 motionValue 池（mvFor）→ 改为 useMemo 池，
 *      与 CodeSlots.jsx 用的同一手法：items 变化才重建，其余情况复用。
 *      同样为了让 StrictMode 的「挂载 → 卸载 → 再挂载」安全，不做销毁。
 *   3) 默认配色 → 改为本项目 index.css 设计令牌（暖白轻奢：
 *      未选中 = 白玻璃 chip / 选中 = 墨色块 + 白字），调用方仍可 props 覆盖。
 *
 * 另加一条纯无障碍补强（不改变观感）：键盘焦点环画在 pill 皮肤上，
 * 免得全局 :focus-visible 的圆角默认环破坏胶囊外形。
 * ===================================================================== */
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, motionValue, useReducedMotion, useTransform } from 'motion/react';

import './JellyRadio.css';

const DEFAULT_ITEMS = ['Off', 'Low', 'Medium', 'High', 'Max'];
const SIZES = { sm: [28, 12, 12], md: [36, 13, 16], lg: [44, 14, 20] };

const spring = (k, m, bounce) => ({
  type: 'spring',
  stiffness: k,
  damping: 2 * Math.sqrt(k * m) * (1 - bounce),
  mass: m
});

const Chip = forwardRef(function Chip({ mv, children, ...rest }, ref) {
  const transform = useTransform(() => `translateX(${mv.x.get()}px) scale(${mv.sx.get()}, ${mv.sy.get()})`);
  return (
    <motion.button ref={ref} style={{ transform }} {...rest}>
      {children}
    </motion.button>
  );
});

export default function JellyRadio({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onChange,
  chipColor = 'var(--bg-inset)',
  activeColor = 'var(--ink-strong)',
  textColor = 'var(--text-secondary)',
  activeTextColor = 'var(--text-on-accent)',
  size = 'md',
  gap = 8,
  radius = 18,
  swell = 0.2,
  barge = 6,
  shrink = 0.05,
  jelly = 1,
  bounce = 0.25,
  stagger = 22,
  stiffness = 580,
  disabled = false,
  ariaLabel = 'Options',
  className = ''
}) {
  const list = items.map(it => (typeof it === 'string' ? { value: it, label: it } : it));
  const [inner, setInner] = useState(() => defaultValue ?? list[0]?.value);
  const current = value ?? inner;
  const at = Math.max(
    0,
    list.findIndex(it => it.value === current)
  );
  const reduce = useReducedMotion();
  const groupRef = useRef(null);
  const chipRefs = useRef([]);
  const widths = useRef([]);
  const applied = useRef(at);
  const cfg = useRef({});
  const [h, font, px] = SIZES[size] ?? SIZES.md;
  const itemsKey = list.map(it => it.value).join('|');

  /* 弹簧值池（上游为渲染期惰性创建 + ref 缓存，二者等价）：
     每个 chip 一支 x / sx / sy，items 变化时按新长度重建。 */
  const mvs = useMemo(
    () =>
      Array.from({ length: list.length }, () => ({
        x: motionValue(0),
        sx: motionValue(1),
        sy: motionValue(1)
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey]
  );

  /* 物理参数快照：必须声明在 settle 之前，保证 apply() 读到本轮 props */
  useLayoutEffect(() => {
    cfg.current = {
      swell,
      barge,
      shrink,
      jelly,
      bounce,
      stagger,
      stiffness,
      reduce,
      count: list.length
    };
  });

  const apply = (sel, instant) => {
    const C = cfg.current;
    const group = groupRef.current;
    const rtl = group ? getComputedStyle(group).direction === 'rtl' : false;
    const push = ((widths.current[sel] ?? 0) * C.swell) / 2 + C.barge;
    for (let i = 0; i < C.count; i++) {
      const mv = mvs[i];
      if (!mv) continue;
      const on = i === sel;
      const far = Math.abs(i - sel);
      const dir = Math.sign(i - sel) * (rtl ? -1 : 1);
      const x = dir * push;
      const s = on ? 1 + C.swell : 1 - C.shrink;
      if (instant || C.reduce) {
        mv.x.jump(x);
        mv.sx.jump(s);
        mv.sy.jump(s);
        continue;
      }
      const k = C.stiffness * (1 - 0.12 * Math.min(far, 3));
      const inFlight = mv.x.isAnimating() || mv.sx.isAnimating() || mv.sy.isAnimating();
      const delay = inFlight ? 0 : (far * C.stagger) / 1000;
      animate(mv.x, x, { ...spring(k, 0.9, C.bounce), delay });
      const j = C.jelly;
      animate(mv.sx, s, {
        ...spring(k * (1 + 0.24 * j), 0.9 - 0.1 * j, Math.min(0.85, C.bounce + 0.3 * j)),
        delay
      });
      animate(mv.sy, s, {
        ...spring(k * (1 - 0.14 * j), 0.9 + 0.05 * j, C.bounce),
        delay: delay + 0.05 * j
      });
    }
  };

  const measure = () => {
    const group = groupRef.current;
    if (!group) return;
    const C = cfg.current;
    widths.current = chipRefs.current.map(el => el?.offsetWidth ?? 0);
    const chipH = chipRefs.current[0]?.offsetHeight ?? 0;
    const maxW = Math.max(0, ...widths.current);
    group.style.setProperty('--jr-pad-x', `${Math.ceil((maxW * C.swell * 1.3) / 2 + C.barge) + 2}px`);
    group.style.setProperty('--jr-pad-y', `${Math.ceil((chipH * C.swell) / 2) + 2}px`);
  };

  useLayoutEffect(() => {
    const settle = () => {
      measure();
      apply(applied.current, true);
    };
    settle();
    const observer = new ResizeObserver(settle);
    if (groupRef.current) observer.observe(groupRef.current);
    document.fonts?.ready.then(settle);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, size, gap, swell, barge, shrink]);

  useEffect(() => {
    if (applied.current === at) return;
    applied.current = at;
    apply(at, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  /* 注意：弹簧值池刻意不做 unmount 销毁 —— 与 CodeSlots.jsx 同一考量，
     StrictMode 的「挂载 → 卸载 → 再挂载」会复用 useMemo 的同一批实例，
     真销毁会让第二次挂载后的形变全部失效。组件卸载后订阅者自然清空，
     没有监听泄漏，交给 GC 即可。 */

  const commit = (i, instant) => {
    if (disabled || i === at || !list[i] || list[i].disabled) return;
    applied.current = i;
    apply(i, instant);
    if (value === undefined) setInner(list[i].value);
    onChange?.(list[i].value, i);
  };
  const stepFrom = (i, dir) => {
    const n = list.length;
    let j = i;
    for (let tries = 0; tries < n; tries++) {
      j = (j + dir + n) % n;
      if (!list[j].disabled) return j;
    }
    return i;
  };
  const onKeyDown = (e, i) => {
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = stepFrom(i, 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = stepFrom(i, -1);
    else if (e.key === 'Home') next = stepFrom(-1, 1);
    else if (e.key === 'End') next = stepFrom(list.length, -1);
    else if (e.key === ' ' || e.key === 'Enter') next = i;
    if (next === null) return;
    e.preventDefault();
    commit(next, true);
    chipRefs.current[next]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      data-disabled={disabled ? '' : undefined}
      className={`jelly-radio${className ? ` ${className}` : ''}`}
      style={{
        '--jr-chip': chipColor,
        '--jr-active': activeColor,
        '--jr-text': textColor,
        '--jr-active-text': activeTextColor,
        '--jr-gap': `${gap}px`,
        '--jr-radius': `${radius}px`,
        '--jr-h': `${h}px`,
        '--jr-font': `${font}px`,
        '--jr-px': `${px}px`
      }}
    >
      {list.map((it, i) => (
        <Chip
          key={it.value}
          mv={mvs[i]}
          ref={el => {
            chipRefs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === at}
          tabIndex={i === at ? 0 : -1}
          disabled={disabled || !!it.disabled}
          className="jelly-radio__chip"
          data-on={i === at ? 'true' : 'false'}
          onClick={e => commit(i, e.detail === 0)}
          onKeyDown={e => onKeyDown(e, i)}
        >
          <span className="jelly-radio__skin">
            {it.icon ? <span className="jelly-radio__icon">{it.icon}</span> : null}
            <span className="jelly-radio__label">{it.label}</span>
          </span>
        </Chip>
      ))}
    </div>
  );
}
