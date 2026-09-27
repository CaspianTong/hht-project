import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import './bottom2.css';

const TAP_MS = 250;
/* 手指长按的容错半径（px）：轻微抖动 / 拇指微移仍算「按住了」，
   只有真的滑出按钮外这么远才判为取消 —— 手机上一次 2 秒的长按不可能纹丝不动，
   这里给足余量，避免按到一半被误中断、进度条白白回弹。 */
const HIT_PAD = 16;
/* Pointer Events 是主路径（现代 Chrome / Safari / 微信内置浏览器都支持）；
   老内核（iOS 12 及更早的 WKWebView、部分安卓 X5）没有 PointerEvent，
   改用 touch 事件兜底。两者互斥，绝不会同时生效，避免一次长按被处理两遍。 */
const HAS_POINTER = typeof window !== 'undefined' && 'PointerEvent' in window;
const LINEAR = t => t;
const EASE_OUT = t => 1 - Math.pow(1 - t, 3);
/* 时间戳统一走模块级函数：组件体内直接调用 performance.now() 会被
   react-hooks/purity 判成「渲染期调用非纯函数」，而这里只可能在事件回调 /
   rAF / 定时器里执行（渲染期一次都不会调）。 */
const now = () => performance.now();

export default function HoldButton({
  children = 'Hold to delete',
  doneLabel = 'Deleted',
  icon = null,
  doneIcon = null,
  backgroundColor = '#27272a',
  fillColor = '#5227FF',
  textColor = '#f5f5f5',
  fillTextColor = '#ffffff',
  size = 'md',
  radius = 14,
  fillDirection = 'right',
  holdTime = 2000,
  releaseTime = 200,
  pressScale = 0.97,
  wave = true,
  waveAmplitude = 6,
  glow = true,
  resetAfter = 1200,
  disabled = false,
  onHold,
  onTap,
  className = ''
}) {
  const [phase, setPhase] = useState('idle');
  const [input, setInput] = useState(null);
  const phaseRef = useRef('idle');
  const inputRef = useRef(null);
  const buttonRef = useRef(null);
  const gesture = useRef({ pointerId: null, start: 0, rect: null });
  const timers = useRef({ complete: 0, reset: 0 });
  const hintId = useId();

  const go = (next, kind = null) => {
    phaseRef.current = next;
    inputRef.current = kind;
    setPhase(next);
    setInput(kind);
  };

  const clearTimers = () => {
    clearTimeout(timers.current.complete);
    clearTimeout(timers.current.reset);
  };

  const motion = useRef({ raf: 0, p: 0, from: 0, to: 0, start: 0 });
  const drive = (to, duration, ease) => {
    const m = motion.current;
    cancelAnimationFrame(m.raf);
    m.from = m.p;
    m.to = to;
    m.start = now();
    const step = now => {
      const t = duration > 0 ? Math.min(1, (now - m.start) / duration) : 1;
      m.p = m.from + (m.to - m.from) * ease(t);
      buttonRef.current?.style.setProperty('--hb-p', m.p.toFixed(4));
      if (t < 1) {
        m.raf = requestAnimationFrame(step);
        return;
      }
      m.raf = 0;
      if (m.to === 1) complete();
    };
    m.raf = requestAnimationFrame(step);
  };

  const complete = () => {
    if (phaseRef.current !== 'holding') return;
    if (now() - gesture.current.start < holdTime - 50) return;
    clearTimers();
    go('done', inputRef.current);
    onHold?.();
    if (resetAfter > 0) {
      timers.current.reset = setTimeout(() => {
        go('idle');
        drive(0, releaseTime, EASE_OUT);
      }, resetAfter);
    }
  };

  const begin = kind => {
    if (disabled || phaseRef.current !== 'idle') return false;
    const button = buttonRef.current;
    if (!button) return false;
    gesture.current.start = now();
    gesture.current.rect = button.getBoundingClientRect();
    go('holding', kind);
    drive(1, holdTime, LINEAR);
    timers.current.complete = setTimeout(complete, holdTime + 100);
    return true;
  };

  const release = ({ drifted = false } = {}) => {
    if (phaseRef.current !== 'holding') return;
    clearTimers();
    const held = now() - gesture.current.start;
    go('idle');
    drive(0, releaseTime, EASE_OUT);
    if (!drifted && held < TAP_MS) onTap?.();
  };
  const releaseRef = useRef(release);
  /* 在 effect 里同步最新 release（原先是渲染期直接赋值 ref，会触发 react-hooks/refs）；
     监听器在 phase 变为 holding 的 effect 中注册，那时这里已经跑过，读到的一定是最新版本 */
  useEffect(() => {
    releaseRef.current = release;
  });

  const handlePointerDown = e => {
    if (e.button !== 0 || !e.isPrimary || gesture.current.pointerId !== null) return;
    if (!begin('pointer')) return;
    gesture.current.pointerId = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* 指针捕获在不支持 / 已被释放时会抛错，忽略即可（后续判断仍靠 pointerId） */
    }
  };

  const endPointer = (e, options) => {
    if (e.pointerId !== gesture.current.pointerId) return;
    gesture.current.pointerId = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* 同上：捕获早已丢失时 releasePointerCapture 会抛错，不影响后续流程 */
    }
    release(options);
  };

  const handlePointerMove = e => {
    if (e.pointerId !== gesture.current.pointerId) return;
    const r = gesture.current.rect;
    if (!r) return;
    const out =
      e.clientX < r.left - HIT_PAD ||
      e.clientX > r.right + HIT_PAD ||
      e.clientY < r.top - HIT_PAD ||
      e.clientY > r.bottom + HIT_PAD;
    if (out) endPointer(e, { drifted: true });
  };

  const handlePointerLeave = e => {
    if (e.pointerType !== 'touch') endPointer(e, { drifted: true });
  };

  /* ---------- 触摸兜底（只挂在没有 PointerEvent 的老内核上，见文件头 HAS_POINTER） ----------
     三件套 start / end / cancel 齐全：抬手、来电、切后台、系统手势打断都能正确收尾，
     绝不会把按钮永远卡在「长按中」。坐标容错统一走 HIT_PAD。 */
  const handleTouchStart = e => {
    if (HAS_POINTER || gesture.current.pointerId !== null) return;
    const touch = e.changedTouches[0];
    if (!touch || !begin('pointer')) return;
    gesture.current.pointerId = touch.identifier;
  };

  const handleTouchEnd = e => {
    const id = gesture.current.pointerId;
    if (HAS_POINTER || id === null) return;
    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i += 1) {
      if (touches[i].identifier !== id) continue;
      gesture.current.pointerId = null;
      release();
      return;
    }
  };

  const handleTouchCancel = () => {
    if (HAS_POINTER || gesture.current.pointerId === null) return;
    gesture.current.pointerId = null;
    release({ drifted: true });
  };

  const handleKeyDown = e => {
    if (e.key === 'Escape') {
      if (inputRef.current === 'key') release({ drifted: true });
      return;
    }
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!e.repeat) begin('key');
    }
  };

  const handleKeyUp = e => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (inputRef.current === 'key') release();
    }
  };

  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;
    const measure = () => {
      button.style.setProperty('--hb-w', `${button.offsetWidth}px`);
      button.style.setProperty('--hb-h', `${button.offsetHeight}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(button);
    return () => ro.disconnect();
  }, []);

  /* ---------- 长按期间的触摸锁：手机端体验最关键的一条 ----------
     CSS 上按钮是 touch-action: manipulation（保留页面滚动、去掉双击缩放与点击延迟），
     代价是：长按中手指一旦挪动超过浏览器的滚动阈值，浏览器就会接管这份手势并发出
     pointercancel → 长按进度条瞬间回弹（用户眼里就是「按到一半突然中断 + 页面乱跳」）。
     解法：长按进行中把这份手势的 touchmove 全部 preventDefault 掉 —— 在滚动真正开始
     之前就拦下，浏览器就不会开始滚，也就不会 cancel，轻微滑动彻底不影响长按。
     必须自己用 addEventListener 挂：React 在根节点上的 touchmove 是 passive 的，
     里面的 preventDefault() 会被忽略（还会在控制台报 warning）。 */
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return undefined;
    const onTouchMove = e => {
      if (phaseRef.current !== 'holding') return;
      if (e.cancelable) e.preventDefault();
      /* 老内核没有 pointermove：滑动容错在这里判（半径同 HIT_PAD）——
         只认「发起这次长按的那根手指」，多指操作不会互相干扰 */
      const id = gesture.current.pointerId;
      if (HAS_POINTER || id === null) return;
      const r = gesture.current.rect;
      const moved = e.changedTouches;
      let touch = null;
      for (let i = 0; i < moved.length; i += 1) {
        if (moved[i].identifier === id) touch = moved[i];
      }
      if (!r || !touch) return;
      const out =
        touch.clientX < r.left - HIT_PAD ||
        touch.clientX > r.right + HIT_PAD ||
        touch.clientY < r.top - HIT_PAD ||
        touch.clientY > r.bottom + HIT_PAD;
      if (!out) return;
      gesture.current.pointerId = null;
      releaseRef.current({ drifted: true });
    };
    button.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => button.removeEventListener('touchmove', onTouchMove);
  }, []);

  useEffect(() => {
    if (phase !== 'holding') return undefined;
    const cancel = () => releaseRef.current({ drifted: true });
    const onVisibility = () => {
      if (document.hidden) cancel();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase]);

  useEffect(() => {
    const t = timers.current;
    const m = motion.current;
    return () => {
      clearTimeout(t.complete);
      clearTimeout(t.reset);
      cancelAnimationFrame(m.raf);
    };
  }, []);

  const direction = fillDirection === 'up' ? 'up' : 'right';
  const labels = (
    <>
      <span className="hold-button__idle" aria-hidden={phase === 'done'}>
        {icon ? <span className="hold-button__icon">{icon}</span> : null}
        {children}
      </span>
      <span className="hold-button__done" aria-hidden={phase !== 'done'}>
        {doneIcon ? <span className="hold-button__icon">{doneIcon}</span> : null}
        {doneLabel}
      </span>
    </>
  );

  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={disabled}
      className={`hold-button hold-button--${size}${className ? ` ${className}` : ''}`}
      data-phase={phase}
      data-input={input ?? undefined}
      data-direction={direction}
      data-glow={glow ? 'true' : undefined}
      aria-describedby={hintId}
      style={{
        '--hb-radius': `${radius}px`,
        '--hb-bg': backgroundColor,
        '--hb-fill': fillColor,
        '--hb-text': textColor,
        '--hb-fill-text': fillTextColor,
        '--hb-hold': `${holdTime}ms`,
        '--hb-cycles': holdTime / 1100,
        '--hb-release': `${releaseTime}ms`,
        '--hb-press': pressScale,
        '--hb-wave': `${wave ? waveAmplitude : 0}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={e => endPointer(e)}
      onPointerCancel={e => endPointer(e, { drifted: true })}
      onLostPointerCapture={e => endPointer(e, { drifted: true })}
      onPointerLeave={handlePointerLeave}
      /* 触摸兜底（仅在无 PointerEvent 的老内核生效，见文件头 HAS_POINTER） */
      onTouchStart={HAS_POINTER ? undefined : handleTouchStart}
      onTouchEnd={HAS_POINTER ? undefined : handleTouchEnd}
      onTouchCancel={HAS_POINTER ? undefined : handleTouchCancel}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      onContextMenu={e => e.preventDefault()}
    >
      <span className="hold-button__pulse" aria-hidden="true" />
      <span className="hold-button__label">{labels}</span>
      <span className="hold-button__clip" aria-hidden="true">
        <span className="hold-button__fill">
          <span className="hold-button__label hold-button__label--fill">{labels}</span>
        </span>
        <span className="hold-button__crest" aria-hidden="true">
          <span className="hold-button__label hold-button__label--fill">{labels}</span>
        </span>
      </span>
      <span id={hintId} className="hold-button__sr">
        Press and hold for {Math.round(holdTime / 100) / 10} seconds to confirm
      </span>
    </button>
  );
}
