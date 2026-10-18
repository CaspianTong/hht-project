import { useCallback, useEffect, useRef, useState } from 'react';

/* 微信图标：两个对话气泡（纯 SVG，不依赖任何图标库） */
function WeChatMark() {
  return (
    <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10.6 3C5.3 3 1 6.5 1 10.9c0 2.5 1.4 4.8 3.5 6.3l-.9 2.8 3.3-1.6c1.1.3 2.3.5 3.7.5h.4c-.2-.6-.3-1.2-.3-1.9 0-4.1 3.8-7.5 8.5-7.5h.4C18.4 5.7 14.8 3 10.6 3Zm-3.4 4.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Zm6.5 0a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M27 18.1c0-3.7-3.5-6.7-7.8-6.7s-7.8 3-7.8 6.7 3.5 6.7 7.8 6.7c1 0 2-.2 2.9-.5l2.9 1.4-.7-2.3c1.6-1.3 2.7-3.2 2.7-5.3Zm-10.3-1.4a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Zm5 0a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z"
      />
    </svg>
  );
}

/**
 * AuthorContact —— 作者联系与投喂卡片
 *
 * 加载界面结束后由 App 自动打开；关闭后可从右上角菜单再次打开。
 * 二维码藏在微信图标按钮里，点击图标后才弹出二维码浮层；
 * 关闭按钮固定在主卡片下方。
 *
 * props:
 *  onClose() 关闭卡片（点关闭按钮 / 点遮罩 / 按 Esc 都会调用）
 */
function AuthorContact({ onClose }) {
  const [qrOpen, setQrOpen] = useState(false);
  const wechatBtnRef = useRef(null);

  /* 收起二维码：状态复位后把焦点还给微信图标，键盘操作不会丢位置 */
  const closeQr = useCallback(() => {
    setQrOpen(false);
    wechatBtnRef.current?.focus();
  }, []);

  /* Esc 关闭（二维码先收，再关卡片）+ 浮层期间锁住正文滚动 */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      if (qrOpen) {
        closeQr();
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeQr, onClose, qrOpen]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div className="author-contact">
      {/* 点遮罩关闭（背面可读但不抢焦点，纯装饰） */}
      <div className="author-contact__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="author-contact__dialog">
        <div
          className="author-contact__card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="author-contact-title"
          aria-describedby="author-contact-desc"
        >
          <header className="author-contact__head">
            <p className="author-contact__eyebrow">A NOTE FROM THE AUTHOR</p>
            <h2 className="author-contact__title" id="author-contact-title">
              欢迎使用该网站
            </h2>
            <span className="author-contact__badge">作者联系与投喂</span>
          </header>

          <div className="author-contact__body" id="author-contact-desc">
            <p>
              作者目前很希望能交到知心的朋友。如果你想要大量兑换码，或者只是想和作者交个朋友，都欢迎加我的微信。
            </p>
            <p>
              另外，如果对我的项目感兴趣、想与我合作，尤其是在 AI、网站开发、Vibe Coding
              等领域有兴趣的同学，我特别希望能够认识你。
            </p>
          </div>

          <button
            type="button"
            ref={wechatBtnRef}
            className="author-contact__wechat"
            onClick={() => setQrOpen(true)}
            aria-label="查看作者微信二维码"
            aria-haspopup="dialog"
            aria-expanded={qrOpen}
          >
            <span className="author-contact__wechat-icon" aria-hidden="true">
              <WeChatMark />
            </span>
            <span className="author-contact__wechat-text">
              <strong>点击查看微信二维码</strong>
              <small>加微信 · 兑换码 · 项目合作</small>
            </span>
          </button>

          <p className="author-contact__hint">添加时备注一下来意，方便我们更快认识。</p>
        </div>

        <button
          type="button"
          className="author-contact__close"
          onClick={onClose}
          aria-label="关闭作者联系与投喂卡片"
          autoFocus
        >
          关闭
        </button>
      </div>

      {/* 点击微信图标后弹出的二维码浮层：点遮罩 / 收起按钮 / Esc 都会关掉它 */}
      {qrOpen && (
        <div
          className="author-contact__qr-pop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="author-contact-qr-title"
        >
          <div
            className="author-contact__qr-backdrop"
            onClick={closeQr}
            aria-hidden="true"
          />

          <div className="author-contact__qr-panel">
            <span className="author-contact__qr-badge" aria-hidden="true">
              <WeChatMark />
            </span>
            <h3 className="author-contact__qr-title" id="author-contact-qr-title">
              作者微信二维码
            </h3>
            <div className="author-contact__qr-frame">
              <img
                className="author-contact__qr"
                src="/QR-code.jpg"
                alt="作者的微信二维码"
                decoding="async"
              />
            </div>
            <p className="author-contact__qr-caption">扫码或长按识别，添加作者微信</p>
            <button
              type="button"
              className="author-contact__qr-close"
              onClick={closeQr}
              autoFocus
            >
              收起二维码
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthorContact;
