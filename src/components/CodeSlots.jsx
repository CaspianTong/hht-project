/* =====================================================================
 * CodeSlots —— 一次性验证码输入（React Bits 组件 · JavaScript + CSS 变体）
 *
 * 来源：reactbits.dev 的 <CodeSlots />（实现基于 motion + @hugeicons）
 * 上游逻辑完整保留（状态机 / 弹簧落定 / 错误退场 / 键盘 · 粘贴交互 / 无障碍播报），
 * 仅做两处「行为等价」改写，以适配本项目 eslint-plugin-react-hooks v7
 * 的 React Compiler 规则（禁止渲染期写 ref、禁止渲染期 setState）：
 *
 *   1) slotsRef.current / live.current 的渲染期直写 → 改为提交后副作用同步
 *   2) <Slot /> 渲染期 setState 换字符        → 改为副作用同步
 *      （“清空”时依旧保留上一位字符，等填充动画收干后再消失，观感一致）
 *
 * 另加一个 opt-in 开关（默认 false，完全不改上游数字输入行为）：
 *   3) allowLetters —— 开启后接受「数字 + 大小写字母」（兑换码可能是字母数字混合），
 *      键盘门控 / 粘贴清洗 / 值同步统一走同一个字符过滤器 codeCharsOf()。
 *
 * props 见 README / 集成说明：length · value · defaultValue · onChange ·
 * onComplete · status · mask · caret · disabled · autoFocus · allowLetters +
 * 一组配色与尺寸参数（本项目统一传 index.css 的设计令牌，保持暖白轻奢主题一致）。
 * ===================================================================== */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { animate, motion, motionValue, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';

import './CodeSlots.css';

const EASE_OUT = [0.23, 1, 0.32, 1];
const WASH_IN = 0.3;
const WASH_OUT = 0.2;
const SINK_DELAY = 0.06;
const SINK_STEP = 0.03;
const CHECK_DELAY = 0.28;
const CHECK_RISE = 8;
const SINK_FADE = 0.6;

const clamp01 = v => Math.min(1, Math.max(0, v));
const digitsOf = raw => String(raw ?? '').replace(/\D/g, '');
/* 统一字符过滤器：allowLetters=false → 纯数字（上游行为）；
   true → 保留 0-9 / A-Z / a-z（大小写原样保留），空格 / 标点 / 中文一律剔除 */
const codeCharsOf = (raw, allowLetters) =>
  allowLetters ? String(raw ?? '').replace(/[^0-9A-Za-z]/g, '') : digitsOf(raw);
const toSlots = (raw, n, allowLetters = false) => {
  const d = codeCharsOf(raw, allowLetters).slice(0, n);
  return Array.from({ length: n }, (_, i) => d[i] ?? '');
};
const firstEmptyOf = slots => {
  const i = slots.indexOf('');
  return i === -1 ? slots.length - 1 : i;
};
const isFull = slots => slots.every(Boolean);

export default function CodeSlots({
  length = 6,
  allowLetters = false,
  value,
  defaultValue = '',
  onChange,
  onComplete,
  status = 'idle',
  mask = false,
  caret = true,
  disabled = false,
  autoFocus = false,
  accentColor = '#f5f5f5',
  inkColor = '#f5f5f5',
  slotColor = '#27272a',
  digitColor = '#18181b',
  dangerColor = '#ff3b30',
  slotSize = 44,
  gap = 8,
  radius = 12,
  bounce = 0.2,
  settle = 0.3,
  rise = 8,
  cascade = 20,
  ariaLabel = 'One-time code',
  className = ''
}) {
  const uid = useId();
  const reduce = useReducedMotion();
  const inputRef = useRef(null);
  const rowRef = useRef(null);
  const [slots, setSlots] = useState(() => toSlots(value ?? defaultValue, length, allowLetters));
  const [active, setActive] = useState(() => firstEmptyOf(slots));
  const [focused, setFocused] = useState(false);
  const [veiled, setVeiled] = useState(status === 'success');
  const activeMv = useMotionValue(active);
  const openMv = useMotionValue(status === 'success' ? 1 : 0);
  const checkMv = useMotionValue(status === 'success' ? 1 : 0);
  const glide = useRef(new Set());
  const target = useRef([]);
  const draining = useRef(false);
  const drainTimer = useRef(undefined);
  const statusRef = useRef(status);
  const emitted = useRef(codeCharsOf(value ?? defaultValue, allowLetters).slice(0, length));
  const slotsRef = useRef(slots);
  const live = useRef({ settle, bounce, cascade, reduce });

  /* 上游在渲染期直接写这两个 ref（slotsRef / live），编译器规则不允许；
     改为每次提交后同步 —— 与事件回调内的显式同步互相兜底，语义等价。
     必须声明在其它副作用之前，保证它们读到的是最新值。 */
  useEffect(() => {
    slotsRef.current = slots;
    live.current = { settle, bounce, cascade, reduce };
  });

  /* 成功色带的开合驱动“光标遮罩”：openMv > 0 时锁住光标，收干到 0 再解锁。
     在 motion 订阅回调里 setState（而不是在副作用体内同步 setState），
     与上游「wash 打开 → setVeiled(true) / 收干 → setVeiled(false)」时序一致。 */
  useMotionValueEvent(openMv, 'change', v => setVeiled(v > 0));

  /* 弹簧值只在 length 变化时重建；初始快照取自当前 slots / status，
     与上游读 slotsRef / statusRef 的快照等价，但不在渲染期访问 ref。 */
  const springs = useMemo(
    () => ({
      mvs: Array.from({ length }, (_, i) => motionValue(slots[i] ? 1 : 0)),
      drops: Array.from({ length }, () => motionValue(status === 'success' ? 1 : 0))
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [length]
  );
  const { mvs, drops } = springs;
  const pitch = slotSize + gap;
  const height = Math.round(slotSize * 1.18);
  const washRadius = Math.min(radius, slotSize / 2);

  const drive = useCallback(
    (i, to, delayMs = 0) => {
      const mv = mvs[i];
      if (!mv) return;
      target.current[i] = to;
      const L = live.current;
      if (L.reduce) {
        mv.jump(to);
        return;
      }
      animate(mv, to, { type: 'spring', duration: L.settle, bounce: L.bounce, delay: delayMs / 1000 });
    },
    [mvs]
  );
  const land = useCallback(
    (i, delayMs = 0) => {
      if (mvs[i].get() > 0) mvs[i].jump(0);
      drive(i, 1, delayMs);
    },
    [mvs, drive]
  );
  const moveActive = useCallback(
    (next, crossed) => {
      crossed.forEach(j => glide.current.add(j));
      activeMv.jump(next);
      setActive(next);
    },
    [activeMv]
  );
  const jumpActive = useCallback(
    next => {
      glide.current.clear();
      activeMv.jump(next);
      setActive(next);
    },
    [activeMv]
  );

  const caretX = useTransform(() => {
    const a = activeMv.get();
    let x = a * pitch;
    for (let j = 0; j < mvs.length; j++) {
      const h = clamp01(mvs[j].get());
      if (!glide.current.has(j)) continue;
      const to = target.current[j];
      if (to === undefined || h === clamp01(to)) {
        glide.current.delete(j);
        continue;
      }
      x += j < a ? -(1 - h) * pitch : h * pitch;
    }
    return Math.min(Math.max(x, 0), (mvs.length - 1) * pitch);
  });
  const caretTransform = useTransform(caretX, x => `translateX(${x}px)`);
  const washClip = useTransform(openMv, o => `inset(0 ${(1 - clamp01(o)) * 50}% round ${washRadius}px)`);
  const checkTransform = useTransform(
    checkMv,
    c => `translateY(${(1 - c) * CHECK_RISE}px) scale(${0.85 + 0.15 * Math.max(c, 0)})`
  );
  const checkOpacity = useTransform(checkMv, clamp01);

  const commit = useCallback(
    next => {
      const prev = slotsRef.current;
      slotsRef.current = next;
      setSlots(next);
      const code = next.join('');
      emitted.current = code;
      onChange?.(code);
      if (!isFull(prev) && isFull(next)) onComplete?.(code);
    },
    [onChange, onComplete]
  );

  const insert = (raw, from = active) => {
    const chars = codeCharsOf(raw, allowLetters);
    if (!chars) return;
    const next = [...slotsRef.current];
    const crossed = [];
    const step = reduce ? 0 : cascade;
    let i = from;
    for (const ch of chars) {
      if (i >= length) break;
      next[i] = ch;
      land(i, (i - from) * step);
      crossed.push(i);
      i += 1;
    }
    if (!crossed.length) return;
    commit(next);
    moveActive(Math.min(i, length - 1), crossed);
  };
  const clearSlot = (i, stepBack = false) => {
    if (!slotsRef.current[i]) {
      if (stepBack) jumpActive(i);
      return;
    }
    const next = [...slotsRef.current];
    next[i] = '';
    drive(i, 0);
    commit(next);
    if (stepBack) moveActive(i, [i]);
  };

  /* 是否忽略输入：已禁用 / 错误退场中 / 成功已锁定。
     读 ref 只能发生在事件回调里，所以包成函数而不是渲染期常量。 */
  const isBusy = () => disabled || draining.current || status === 'success';
  const onKeyDown = e => {
    if (isBusy() || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    /* allowLetters 时把字母也放进来；只认单字符，避免 Shift / Enter 等被误吃 */
    const typed = allowLetters ? /^[0-9A-Za-z]$/.test(k) : /^[0-9]$/.test(k);
    if (typed) {
      e.preventDefault();
      insert(k);
    } else if (k === 'Backspace') {
      e.preventDefault();
      if (slots[active]) clearSlot(active);
      else if (active > 0) clearSlot(active - 1, true);
    } else if (k === 'Delete') {
      e.preventDefault();
      clearSlot(active);
    } else if (k === 'ArrowLeft') {
      e.preventDefault();
      jumpActive(Math.max(active - 1, 0));
    } else if (k === 'ArrowRight') {
      e.preventDefault();
      jumpActive(Math.min(active + 1, length - 1));
    } else if (k === 'Home') {
      e.preventDefault();
      jumpActive(0);
    } else if (k === 'End') {
      e.preventDefault();
      jumpActive(length - 1);
    }
  };
  const onPaste = e => {
    if (isBusy()) return;
    e.preventDefault();
    insert(e.clipboardData.getData('text'));
  };
  const onInput = e => {
    if (isBusy()) return;
    const d = codeCharsOf(e.target.value, allowLetters);
    if (!d) return;
    insert(d, d.length === 1 ? active : 0);
  };
  const onRowMouseDown = e => {
    if (disabled) return;
    e.preventDefault();
    const row = rowRef.current;
    if (row && !draining.current && status !== 'success') {
      const rect = row.getBoundingClientRect();
      const zoom = rect.width / (row.offsetWidth || rect.width) || 1;
      const i = Math.floor((e.clientX - rect.left) / zoom / pitch);
      jumpActive(Math.max(0, Math.min(i, firstEmptyOf(slotsRef.current))));
    }
    inputRef.current?.focus();
  };

  useEffect(() => {
    glide.current.clear();
    target.current = [];
    const next = Array.from({ length }, (_, i) => slotsRef.current[i] ?? '');
    slotsRef.current = next;
    setSlots(next);
    jumpActive(firstEmptyOf(next));
    const code = next.join('');
    if (code !== emitted.current) {
      emitted.current = code;
      onChange?.(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  useEffect(() => {
    if (value === undefined) return;
    const clean = codeCharsOf(value, allowLetters).slice(0, length);
    if (clean === emitted.current) return;
    emitted.current = clean;
    const prev = slotsRef.current;
    const next = toSlots(clean, length, allowLetters);
    const hidden = statusRef.current === 'success';
    const landing = [];
    const leaving = [];
    next.forEach((ch, i) => {
      if (ch === prev[i]) return;
      (ch ? landing : leaving).push(i);
    });
    const step = live.current.reduce || hidden ? 0 : live.current.cascade;
    landing.forEach((i, k) => land(i, k * step));
    leaving.reverse().forEach((i, k) => {
      if (hidden) {
        target.current[i] = 0;
        mvs[i].jump(0);
        drops[i].jump(0);
      } else drive(i, 0, k * step);
    });
    slotsRef.current = next;
    setSlots(next);
    moveActive(firstEmptyOf(next), [...landing, ...leaving]);
    if (!isFull(prev) && isFull(next)) onComplete?.(clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, length]);

  useEffect(() => {
    const was = statusRef.current;
    const L = live.current;
    if (status === 'success') {
      /* veiled 由 openMv 的 change 订阅统一驱动（见上方 useMotionValueEvent） */
      if (L.reduce) {
        openMv.jump(1);
        drops.forEach(d => d.jump(1));
        checkMv.jump(1);
        return;
      }
      animate(openMv, 1, { duration: WASH_IN, ease: EASE_OUT });
      drops.forEach((d, k) =>
        animate(d, 1, { type: 'spring', duration: 0.3, bounce: 0, delay: SINK_DELAY + k * SINK_STEP })
      );
      animate(checkMv, 1, { type: 'spring', duration: 0.35, bounce: L.bounce, delay: CHECK_DELAY });
      return;
    }
    if (was !== 'success') return;
    if (L.reduce) {
      openMv.jump(0);
      checkMv.jump(0);
      drops.forEach(d => d.jump(0));
      setVeiled(false);
      return;
    }
    animate(checkMv, 0, { duration: 0.15, ease: EASE_OUT });
    animate(openMv, 0, { duration: WASH_OUT, ease: EASE_OUT, delay: 0.06 });
    drops.forEach(d => animate(d, 0, { type: 'spring', duration: 0.3, bounce: 0, delay: 0.1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== 'error') return;
    const filled = slotsRef.current.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
    if (!filled.length) return;
    filled.reverse();
    draining.current = true;
    const L = live.current;
    const step = L.reduce ? 0 : L.cascade;
    filled.forEach((i, k) => drive(i, 0, k * step));
    moveActive(
      0,
      slotsRef.current.map((_, j) => j)
    );
    clearTimeout(drainTimer.current);
    drainTimer.current = setTimeout(
      () => {
        draining.current = false;
        commit(Array.from({ length }, () => ''));
      },
      L.reduce ? 300 : (filled.length - 1) * step + L.settle * 1000
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => () => clearTimeout(drainTimer.current), []);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const view = slots.length === length ? slots : Array.from({ length }, (_, i) => slots[i] ?? '');
  const showCaret =
    caret && focused && !disabled && !veiled && status !== 'success' && (status === 'error' || !view[active]);

  return (
    <div
      className={`code-slots${className ? ` ${className}` : ''}`}
      style={{
        '--cs-accent': accentColor,
        '--cs-ink': inkColor,
        '--cs-slot': slotColor,
        '--cs-digit': digitColor,
        '--cs-danger': dangerColor,
        '--cs-size': `${slotSize}px`,
        '--cs-height': `${height}px`,
        '--cs-gap': `${gap}px`,
        '--cs-radius': `${Math.min(radius, slotSize / 2)}px`,
        '--cs-font': `${Math.round(slotSize * 0.5)}px`
      }}
    >
      <div
        ref={rowRef}
        className="code-slots__row"
        data-status={status}
        data-focused={focused ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
        onMouseDown={onRowMouseDown}
      >
        <input
          ref={inputRef}
          className="code-slots__input"
          type="text"
          inputMode={allowLetters ? 'text' : 'numeric'}
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          pattern={allowLetters ? '[0-9A-Za-z]*' : '[0-9]*'}
          value=""
          maxLength={length}
          aria-label={ariaLabel}
          aria-invalid={status === 'error'}
          aria-describedby={`${uid}-count`}
          disabled={disabled}
          readOnly={status === 'success'}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onChange={onInput}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {view.map((ch, i) => (
          <Slot
            key={i}
            mv={mvs[i]}
            drop={drops[i]}
            char={mask && ch ? '•' : ch}
            active={focused && i === active}
            rise={rise}
            sink={Math.round(height * 0.5)}
          />
        ))}
        <motion.span className="code-slots__wash" aria-hidden="true" style={{ clipPath: washClip }}>
          <motion.span className="code-slots__check" style={{ transform: checkTransform, opacity: checkOpacity }}>
            <HugeiconsIcon icon={Tick02Icon} size={Math.round(slotSize * 0.6)} strokeWidth={2.2} />
          </motion.span>
        </motion.span>
        <motion.span
          className="code-slots__caret"
          aria-hidden="true"
          data-show={showCaret ? '' : undefined}
          style={{ transform: caretTransform }}
        >
          <span key={active} className="code-slots__caret-line" />
        </motion.span>
      </div>
      <span id={`${uid}-count`} className="code-slots__sr" aria-live="polite">
        {status === 'success' ? 'Code accepted' : `${view.filter(Boolean).length} of ${length} ${allowLetters ? 'characters' : 'digits'} entered`}
      </span>
    </div>
  );
}

function Slot({ mv, drop, char, active, rise, sink }) {
  const [shown, setShown] = useState(char);
  useEffect(() => {
    /* 上游在渲染期 setState 换字符（React Compiler 规则禁止）；
       这里放到副作用里同步：清空时保留上一位字符，等填充动画收干后自然消失。 */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 保留退场期间的旧字符
    if (char) setShown(char);
  }, [char]);

  const fill = useTransform(mv, t => `scale(${Math.max(t, 0)})`);
  const lift = useTransform([mv, drop], ([t, d]) => `translateY(${(1 - t) * rise + Math.max(d, 0) * sink}px)`);
  const ink = useTransform([mv, drop], ([t, d]) => clamp01(t) * (1 - clamp01(d / SINK_FADE)));
  return (
    <span
      className="code-slots__slot"
      data-active={active ? '' : undefined}
      data-filled={char ? '' : undefined}
      aria-hidden="true"
    >
      <motion.span className="code-slots__fill" style={{ transform: fill }} />
      {shown ? (
        <motion.span className="code-slots__digit" style={{ transform: lift, opacity: ink }}>
          {shown}
        </motion.span>
      ) : null}
    </span>
  );
}
