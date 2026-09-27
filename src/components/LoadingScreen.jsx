/* =====================================================================
 * LoadingScreen —— 首屏加载界面
 *
 *   纯白满屏 + 一个「克莱因蓝」的折纸文字 loading（文字动画来自 ./start-carton）
 *
 * 【现在是假的判定】挂载后自己数 duration 毫秒（默认 1.5 秒）→ 淡出 exitMs → 通知外部卸载。
 *   将来接真实数据时：删掉这两个定时器，改成在数据 / 首屏资源就绪时调用 setLeaving(true)，
 *   其余结构（遮罩、层级、无障碍、锁滚动）都不用动。
 *
 * 无障碍：role="status" + aria-live，读屏播报 srText；视觉层文字本身是 aria-hidden 的装饰。
 * ===================================================================== */
import { useEffect, useState } from 'react';
import FoldText from './start-carton';
import './LoadingScreen.css';

/* 假加载时长（毫秒） */
const FAKE_LOAD_MS = 1500;
/* 淡出时长：必须与 LoadingScreen.css 里的 transition 保持一致 */
const EXIT_MS = 360;

/**
 * @component
 * @param {Object} props
 * @param {number} [props.duration] 展示时长（毫秒，默认 1500）
 * @param {number} [props.exitMs]   淡出时长（毫秒，默认 360）
 * @param {string} [props.text]     视觉文字（默认 'loading'）
 * @param {string} [props.srText]   读屏文字（默认 '加载中'）
 * @param {Function} [props.onDone] 彻底结束时回调（父组件用它卸载本组件）
 */
export default function LoadingScreen({
  duration = FAKE_LOAD_MS,
  exitMs = EXIT_MS,
  text = 'loading',
  srText = '加载中',
  onDone,
}) {
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);

  /* 假判定：到点先进入淡出态，淡完再宣告结束 */
  useEffect(() => {
    const leaveTimer = setTimeout(() => setLeaving(true), duration);
    const goneTimer = setTimeout(() => {
      setGone(true);
      onDone?.();
    }, duration + exitMs);

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(goneTimer);
    };
  }, [duration, exitMs, onDone]);

  /* 加载期间锁住页面滚动（遮罩下面别乱动），淡出结束即恢复原值 */
  useEffect(() => {
    if (gone) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [gone]);

  if (gone) return null;

  return (
    <div
      className={`loading-screen${leaving ? ' loading-screen--leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* 折纸文字 loading：配色 / 字号由 .loading-screen__text 里的 CSS 变量给定 */}
      <FoldText className="loading-screen__text" text={text} srText={srText} />
    </div>
  );
}
