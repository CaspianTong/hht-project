import { useEffect, useRef } from 'react';
import { PLATFORM_NAME, PLATFORM_SLOGAN } from '../data/mockSongs';

/**
 * Hero —— 首屏氛围区（静态氛围文案 + 滚动视差渐隐）
 *
 * 首屏四个动作按钮（左边第一个就是「兑换投票次数」入口）：
 *   兑换投票次数（浮层卡片）    立即进入投票区 → #voting
 *   逛专辑封面墙 → #albums      作者的话（浮层信笺）
 * 原先的实时数据徽章（首参赛 / 票已投出 / 前三登台）已移除，
 * 票数信息在「当前热门榜」的分类计数与歌曲卡片里查看，首屏视觉更干净。
 *
 * props:
 *  extraVotes     已兑换、还能加投的票数（>0 时按钮上挂一枚小徽章）
 *  onOpenRedeem() 打开「兑换投票次数」浮层卡片
 *  onOpenAuthor() 打开「作者的话」信笺浮层
 */
function Hero({ extraVotes = 0, onOpenRedeem, onOpenAuthor }) {
  const heroRef = useRef(null);

  /* 滑动叙事：把首屏滚动进度写入 --hero-progress（0 → 1），
   * App.css 中 .hero__inner 借助它做「轻微视差 + 渐隐」；
   * 系统开启“减少动态效果”时完全跳过，保持静态。 */
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let frame = 0;

    const update = () => {
      frame = 0;
      const span = el.offsetHeight || window.innerHeight;
      const progress = Math.min(1, Math.max(0, window.scrollY / (span * 0.92)));
      el.style.setProperty('--hero-progress', progress.toFixed(3));
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
    };
  }, []);

  return (
    <section className="hero" id="home" ref={heroRef}>
      <div className="hero__inner">
        <p className="hero__eyebrow">
          🏟️ SCHOOL GAMES 2026 · SOUND FEST · 音乐征集投票平台
        </p>

        <h1 className="hero__title">
          <span className="hero__title-main grad-text">{PLATFORM_NAME}</span>
          <span className="hero__title-sub">
            {PLATFORM_SLOGAN} <span aria-hidden="true">🎵</span>
          </span>
        </h1>

        {/* 主操作区：兑换投票次数（亮一档高级蓝）+ 进入投票区（高级蓝主色）
            + 专辑封面墙 + 作者的话（后两者都是白玻璃） */}
        <div className="hero__actions">
          <button
            type="button"
            className="btn btn--gold btn--lg"
            onClick={onOpenRedeem}
          >
            🎟️ 兑换投票次数
            {extraVotes > 0 && (
              <span className="btn__badge">可加投 {extraVotes} 票</span>
            )}
          </button>
          <a className="btn btn--primary btn--lg" href="#voting">
            🎯 立即进入投票区
          </a>
          <a className="btn btn--ghost btn--lg" href="#albums">
            🎧 逛专辑封面墙
          </a>
          <button
            type="button"
            className="btn btn--ghost btn--lg"
            onClick={onOpenAuthor}
          >
            ✍️ 作者的话
          </button>
        </div>
      </div>

      <div className="hero__scroll-hint" aria-hidden="true">
        <span className="hero__scroll-line" />
        <span>往下看 · 今日热单</span>
      </div>
    </section>
  );
}

export default Hero;
