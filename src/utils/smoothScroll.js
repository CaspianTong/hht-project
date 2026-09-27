/* =====================================================================
 * smoothScroll —— 站内锚点平滑滚动工具
 *
 * 背景：浏览器默认的锚点跳转是“瞬间传送”，页面直接闪到目标位置，
 * 既没有滚动过程，也会跳过路径上依赖 scroll 帧的滚动动效。
 *
 * 做法：拦截站内 a[href^="#"] 点击，用 requestAnimationFrame 逐帧滚动，
 * 让跳转过程可见；同时用 pushState 更新地址栏。
 * ===================================================================== */

/** 是否开启了系统“减少动态效果” */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** easeInOutCubic 缓动 */
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** 上一次滚动的令牌，用于打断尚未结束的旧动画 */
let animationToken = 0;

/** 读取顶部导航高度（CSS 变量 --nav-h），用于计算落点偏移 */
const getNavHeight = () => {
  if (typeof window === 'undefined') return 72;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 72;
};

/**
 * 平滑滚动到指定 Y 坐标
 * @param {number} targetY 目标位置（px）
 * @param {number} duration 动画时长（ms）
 */
export function smoothScrollToY(targetY, duration = 900) {
  if (typeof window === 'undefined') return;

  const startY = window.scrollY;
  const distance = targetY - startY;

  // 减少动态效果 / 距离过近 → 直接定位
  if (prefersReducedMotion() || duration <= 0 || Math.abs(distance) < 1) {
    window.scrollTo(0, targetY);
    return;
  }

  // 临时关闭 CSS scroll-behavior，避免与 JS 逐帧动画互相干扰
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;
  root.style.scrollBehavior = 'auto';

  const token = ++animationToken;
  let startTime = null;

  const finish = () => {
    if (token === animationToken) root.style.scrollBehavior = previousBehavior;
  };

  const step = (now) => {
    if (token !== animationToken) {
      finish();
      return;
    }
    if (startTime === null) startTime = now;

    const progress = Math.min((now - startTime) / duration, 1);
    window.scrollTo(0, startY + distance * easeInOutCubic(progress));

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      finish();
    }
  };

  requestAnimationFrame(step);
}

/**
 * 平滑滚动到某个锚点
 * @param {string} hash 形如 "#voting"
 * @param {{ duration?: number, offset?: number, updateHistory?: boolean }} [options]
 * @returns {boolean} 是否成功找到目标元素
 */
export function scrollToHash(hash, options = {}) {
  if (typeof window === 'undefined') return false;

  const id = String(hash).replace(/^#/, '');
  if (!id) return false;

  const el = document.getElementById(id);
  if (!el) return false;

  const { updateHistory = true } = options;
  const offset =
    options.offset ?? (id === 'home' ? 0 : getNavHeight() + 14);

  const rawTarget = el.getBoundingClientRect().top + window.scrollY - offset;
  const maxY = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  const targetY = Math.min(Math.max(rawTarget, 0), maxY);

  // 距离越远，动画稍长一点，观感更自然
  const distance = Math.abs(targetY - window.scrollY);
  const duration =
    options.duration ?? Math.min(1500, Math.max(650, distance * 0.45));

  smoothScrollToY(targetY, duration);

  if (updateHistory && window.location.hash !== `#${id}`) {
    window.history.pushState(null, '', `#${id}`);
  }
  return true;
}

/**
 * 全局拦截站内锚点点击（菜单 / CTA / 页脚通用）
 * @returns {() => void} 解绑函数
 */
export function bindAnchorScroll() {
  const handleClick = (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target?.closest?.('a[href^="#"]');
    if (!link) return;

    const hash = link.getAttribute('href');
    if (!hash || hash.length < 2) return;

    if (scrollToHash(hash)) event.preventDefault();
  };

  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}
