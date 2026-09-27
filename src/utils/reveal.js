/* =====================================================================
 * reveal —— 滑动叙事工具（Scrollytelling helpers）
 *
 * createRevealGroup(root) / useRevealGroup(ref)
 *   观察容器内所有 [data-reveal] 元素，进入视口时打上「已出现」标记，
 *   让 App.css 里的过渡（opacity + translateY）按元素自身的
 *   --reveal-delay 交错播放，形成“卡片依次浮现”的叙事节奏。
 *
 * ⚠️ 标记为什么同时写 class 与 data-revealed（曾经的真实 bug）：
 *   React 在元素的 className 变化时会「整体重写」class 属性，把 JS 直写的
 *   .is-revealed 一并冲掉 —— 元素于是退回 opacity: 0 凭空消失，而且它已经被
 *   unobserve 过，IntersectionObserver 不会再补一次，卡片就永久不见了。
 *   （典型触发场景：投票后给卡片加上「已投票」状态类。）
 *   所以标记以 data-revealed 为准：它不在任何 props 里，React 永远不会动它；
 *   App.css 里两套选择器并列（[data-revealed] 与 .is-revealed）互为兜底。
 *
 * useScrollProgress()
 *   把整页滚动进度写入 :root 的 --scroll-progress（0 → 1），
 *   供背景弥散光晕做随滚动变化的光感呼吸。
 *
 * 两者都遵循 prefers-reduced-motion：系统要求减少动效时直接跳过，
 * 并立即把元素标记为可见，绝不出现“内容永远不显示”的风险。
 * ===================================================================== */
import { useEffect } from 'react';

/** 是否开启了系统“减少动态效果” */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 一次性的滚动进度监听（多个组件调用时共享同一套监听） */
let progressListeners = 0;
let progressCleanup = null;

const bindScrollProgress = () => {
  const root = document.documentElement;
  let frame = 0;

  const update = () => {
    frame = 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    root.style.setProperty('--scroll-progress', progress.toFixed(3));
  };

  const onScroll = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    if (frame) window.cancelAnimationFrame(frame);
    root.style.removeProperty('--scroll-progress');
  };
};

/**
 * 给元素打上「已进入视口」标记
 *   同时写 .is-revealed（旧选择器）与 data-revealed（React 不会覆盖的锚点）——
 *   详见文件头注释：className 被 React 重写时，只有 data-revealed 能活下来。
 * @param {HTMLElement} el
 */
export function markRevealed(el) {
  el.classList.add('is-revealed');
  el.setAttribute('data-revealed', '');
}

/**
 * 绑定「进入视口交错淡入」：扫描 root 内所有 [data-reveal] 元素，
 * 进入视口时打上标记（markRevealed），并用 MutationObserver 持续补观察
 * 筛选 / 排序 / 新投稿带来的节点变化。纯 DOM 逻辑，抽出来便于单独验证。
 * @param {HTMLElement|null} root 容器
 * @returns {() => void} 清理函数
 */
export function createRevealGroup(root) {
  if (!root) return () => {};

  const targets = () => Array.from(root.querySelectorAll('[data-reveal]'));

  // 兜底：不支持 IntersectionObserver / 系统要求减少动效 → 全部立即显示（含后续新增）
  if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
    const revealAll = () => targets().forEach(markRevealed);
    revealAll();
    const moAll = new MutationObserver(revealAll);
    moAll.observe(root, { childList: true, subtree: true });
    return () => moAll.disconnect();
  }

  const observed = new WeakSet();
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        markRevealed(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
  );

  const scan = () => {
    targets().forEach((el) => {
      if (observed.has(el)) return;
      observed.add(el);
      io.observe(el);
    });
  };

  scan();
  // 筛选 / 排序 / 新投稿会动态增删卡片，这里用 MutationObserver 增量补观察
  const mo = new MutationObserver(scan);
  mo.observe(root, { childList: true, subtree: true });

  return () => {
    mo.disconnect();
    io.disconnect();
  };
}

/**
 * 进入视口交错淡入（React 版：把 createRevealGroup 挂到容器 ref 上）
 * @param {{ current: HTMLElement|null }} rootRef 容器 ref（内部扫描 [data-reveal]）
 * @param {*} [ready] 容器「是否已经渲染出来」的开关：榜单要等数据拉回来才出现，
 *   组件挂载那一刻 rootRef.current 还是 null（createRevealGroup 会直接返回空清理函数）。
 *   ready 变化时重新绑一次，扫到的节点才会被观察；不传也能用（容器与组件同时挂载的场景）。
 */
export function useRevealGroup(rootRef, ready) {
  useEffect(() => createRevealGroup(rootRef.current), [rootRef, ready]);
}

/** 把整页滚动进度同步到 :root 的 --scroll-progress */
export function useScrollProgress() {
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    progressListeners += 1;
    if (!progressCleanup) progressCleanup = bindScrollProgress();

    return () => {
      progressListeners -= 1;
      if (progressListeners <= 0 && progressCleanup) {
        progressCleanup();
        progressCleanup = null;
        progressListeners = 0;
      }
    };
  }, []);
}