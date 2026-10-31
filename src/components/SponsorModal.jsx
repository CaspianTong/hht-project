import { useCallback, useEffect, useRef, useState } from 'react';
import './SponsorModal.css';

/* 两个 Tab 的静态定义：数组顺序就是键盘 ← / → 的切换顺序 */
const TABS = [
  { id: 'feedback', label: '💬 交流与反馈' },
  { id: 'sponsor', label: '☕ 投喂站长' },
];

/* 与 CSS 里的退场动画时长保持一致：动画播完再真正卸载 */
const CLOSE_ANIM_MS = 200;

/**
 * SponsorModal —— 支持与反馈 / 投喂站长 弹窗
 *
 * 设计约定：
 *  · 遮罩：半透明墨色 + 4px 毛玻璃（等价 Tailwind 的 backdrop-blur-sm），
 *    进出场都有淡入淡出，关闭动画播完才卸载；
 *  · 两个 Tab：默认「交流与反馈」（微信二维码），另一页是「投喂站长」（赞赏码）；
 *  · 关闭方式：✕ / 底部「关闭」/ 点遮罩 / Esc 都走同一条带退场动画的关闭流程；
 *  · 无障碍：tablist + tab / tabpanel 语义、方向键 / Home / End 切换、焦点归还触发按钮。
 *
 * ⚠️ 与 RedeemPanel / AuthorNote 同一约定：App 只在需要时挂载它，
 *    关闭即卸载，组件内部不需要「打开时重置」的副作用。
 *
 * props:
 *  onClose()              关闭弹窗
 *  initialTab             'feedback'（默认）| 'sponsor' —— 从 Toast 进来时直达投喂页
 */
function SponsorModal({ onClose, initialTab = 'feedback' }) {
  const [tab, setTab] = useState(() =>
    TABS.some((item) => item.id === initialTab) ? initialTab : 'feedback',
  );
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef(null);
  const tabRefs = useRef({});

  /* 统一关闭入口：先播 200ms 退场动画，再由 App 卸载；重复点击不会叠加计时器 */
  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => onClose?.(), CLOSE_ANIM_MS);
  }, [onClose]);

  /* 卸载时清掉计时器，避免 StrictMode / 快速开关时回调打到已卸载的组件 */
  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    [],
  );

  /* Esc 关闭 + 浮层期间锁住正文滚动（关掉还原），与站内其它浮层行为一致 */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      requestClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  /* Tab 键盘操作：← / → 循环切换，Home / End 跳到首尾 */
  const handleTabKeyDown = (e) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let nextId = null;

    if (e.key === 'ArrowRight') nextId = TABS[(index + 1) % TABS.length].id;
    else if (e.key === 'ArrowLeft') nextId = TABS[(index - 1 + TABS.length) % TABS.length].id;
    else if (e.key === 'Home') nextId = TABS[0].id;
    else if (e.key === 'End') nextId = TABS[TABS.length - 1].id;

    if (!nextId) return;
    e.preventDefault();
    setTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  return (
    <div
      className={`sponsor-modal${closing ? ' sponsor-modal--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sponsor-modal-title"
    >
      {/* 点遮罩关闭（背面内容可读，但不参与 Tab 焦点） */}
      <div
        className="sponsor-modal__backdrop"
        onClick={requestClose}
        aria-hidden="true"
      />

      <div className="sponsor-modal__card">
        <button
          type="button"
          className="sponsor-modal__close"
          onClick={requestClose}
          aria-label="关闭支持与反馈弹窗"
          autoFocus
        >
          ✕
        </button>

        <header className="sponsor-modal__head">
          <p className="sponsor-modal__eyebrow">A LITTLE SUPPORT</p>
          <h2 className="sponsor-modal__title" id="sponsor-modal-title">
            支持与反馈
          </h2>
          <p className="sponsor-modal__subtitle">让这个小站继续唱下去</p>
        </header>

        <div
          className="sponsor-modal__tabs"
          role="tablist"
          aria-label="支持与反馈分类"
          onKeyDown={handleTabKeyDown}
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              ref={(el) => {
                tabRefs.current[item.id] = el;
              }}
              type="button"
              role="tab"
              id={`sponsor-tab-${item.id}`}
              className={`sponsor-modal__tab${
                tab === item.id ? ' sponsor-modal__tab--active' : ''
              }`}
              aria-selected={tab === item.id}
              aria-controls={`sponsor-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* key={tab}：切页时重新挂载面板，触发一次轻量的淡入位移 */}
        <div
          key={tab}
          className="sponsor-modal__panel"
          id={`sponsor-panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`sponsor-tab-${tab}`}
          tabIndex={0}
        >
          {tab === 'feedback' ? (
            <>
              <div className="sponsor-modal__lead sponsor-modal__lead--notice">
                <p>
                  用苹果手机的同学可能会因为系统原因在网站体验不佳，请见谅，本人已在尽力修复。
                </p>
                <p>
                  另外，在校运会后在空余时间我会将本网站改造为关于本校的问卷及论坛网站，尽可能让学校能知道学生对校务的观点和建议，比如说早餐品种的投票等（其实我想多吃点肠粉）若期待的话请支持作者。
                </p>
              </div>

              <figure className="sponsor-modal__qr">
                <div className="sponsor-modal__qr-frame">
                  <img
                    src="/QR-code.jpg"
                    alt="站长微信二维码"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>扫码或长按识别，添加站长微信</figcaption>
              </figure>

              <p className="sponsor-modal__note">
                加好友时备注一下「投票网站」，通过更快。
              </p>
            </>
          ) : (
            <>
              <p className="sponsor-modal__lead">
                用爱发电、自费运维中。投喂 1~2 元，给服务器加根内存条～丰俭由人。
              </p>

              <figure className="sponsor-modal__qr">
                <div className="sponsor-modal__qr-frame">
                  <img
                    src="/moneyQRCODE.png"
                    alt="站长赞助收款码"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption>微信扫码赞赏</figcaption>
              </figure>

              <p className="sponsor-modal__note">转账可备注昵称，感谢支持。</p>
            </>
          )}
        </div>

        <div className="sponsor-modal__foot">
          <button type="button" className="sponsor-modal__done" onClick={requestClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default SponsorModal;
