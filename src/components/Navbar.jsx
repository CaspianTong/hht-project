import { useEffect, useRef, useState } from 'react';
import { PLATFORM_NAME } from '../data/mockSongs';

/* 下拉菜单内容（点击后平滑滚动到对应锚点）
 * 说明：① 菜单项原先各配了一枚彩色 emoji 图标方块，按需求已全部去掉 ——
 *         只保留「标题 + 描述」两行文字，菜单更干净，也少一层视觉噪音；
 *       ② 原先排在分隔线之下的「我的个人网站」外链条目也已整体移除，
 *         菜单现在只剩站内锚点。 */
const NAV_LINKS = [
  { id: 'home', label: '首页', desc: '赛事氛围与快速入口' },
  { id: 'albums', label: '专辑封面墙', desc: '翻转卡片 · 看参赛专辑' },
  { id: 'voting', label: '当前热门榜', desc: '实时票数与分类打榜' },
  { id: 'submit', label: '提交我的音乐', desc: '为你班级点一首战歌' },
];

/**
 * Navbar —— 吸顶毛玻璃导航
 * - 左：品牌 Logo（火焰 SVG）+ 平台名
 * - 右：汉堡按钮，点击展开/收起下拉菜单
 * - 点击菜单项 / 点击外部 / 按 Esc 自动收起
 */
function Navbar() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="navbar">
      <div className="navbar__inner">
        <a
          className="navbar__brand"
          href="#home"
          onClick={close}
          aria-label={`${PLATFORM_NAME} - 回到首页`}
        >
          <span className="navbar__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
              <defs>
                <linearGradient id="flameGrad" x1="0" y1="1" x2="1" y2="0">
                  {/* 火焰渐变：亮一档的高级蓝 --accent-secondary → 主色高级蓝 --accent-primary
                      （原「奶杏金 → 落日珊瑚」暖色渐变已按全站改色一起换掉；
                       这里用 CSS 变量而不是写死色值，logo 才会跟着 index.css 的令牌走） */}
                  <stop offset="0%" style={{ stopColor: 'var(--accent-secondary)' }} />
                  <stop offset="100%" style={{ stopColor: 'var(--accent-primary)' }} />
                </linearGradient>
              </defs>
              <path
                fill="url(#flameGrad)"
                d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
              />
            </svg>
          </span>
          <span className="navbar__text">
            <strong className="navbar__title">{PLATFORM_NAME}</strong>
            <small className="navbar__subtitle">校运会音乐征集 · 投票平台</small>
          </span>
        </a>

        <div className="navbar__menu" ref={wrapRef}>
          <button
            type="button"
            className={`menu-btn${open ? ' menu-btn--open' : ''}`}
            aria-expanded={open}
            aria-label={open ? '收起导航菜单' : '展开导航菜单'}
            aria-controls="navbar-dropdown"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="menu-btn__box" aria-hidden="true">
              <span className="menu-btn__line menu-btn__line--1" />
              <span className="menu-btn__line menu-btn__line--2" />
              <span className="menu-btn__line menu-btn__line--3" />
            </span>
          </button>

          {open && (
            <nav className="dropdown" id="navbar-dropdown" aria-label="主导航">
              {NAV_LINKS.map((item) => (
                <a
                  key={item.id}
                  className="dropdown__link"
                  href={`#${item.id}`}
                  onClick={close}
                >
                  <span className="dropdown__meta">
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </span>
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
