import { useEffect } from 'react';

/* 作者的话 —— 正文段落
 * 措辞与语气保持作者原文，只做「分段 + 标点 / 空格」的排版整理
 * （原文的“memu”按网站里的菜单叫法写成「菜单」） */
const LETTER = [
  '同学们你们好，我是 HHT。',
  '我参加了尚雅 8 年的校运会。通过自己的感受以及朋友的言论，我认为大家认为学校的校运会应该更有激情，以至于在看台观赛的同学们不这么无聊。所以经过考虑，我向梁雪雯老师提出将歌曲下载到 U 盘带到操场广播室播歌的请求，并得到同意。',
  '若无特殊情况，应同学们的需求，我会将本投票网站的前至少 50 首歌曲下载到个人 U 盘，并在初中校运会当天播。',
  '也请大家投积极上进、符合主题的歌。当然 kpop、jpop、普通话、粤语都没有问题，但前提是歌词需要正能量。',
  '同时，我将我的个人网站的网址挂在了本网站的菜单里。虽然说因为时间以及成本原因，我的个人主页还处于毛坯风格，甚至不如这个投票网站，但也请大家包容。如果 someone 对我的项目感到有兴趣，想看到我未来更多的项目，也可以到个人站投喂我，这些投喂我会全额用于项目开发当中。',
  '然后呢，这个网站需要通过兑换码换票。本人在投票活动截止之前会随身携带纸质兑换码，如果你能在学校认出我，我很乐意将兑换码交予你，但本人比较 I，也请包容。',
  '最后，如果发现我的项目网站有漏洞或者有意见反馈，请积极联系我，谢谢大家。',
];

/**
 * AuthorNote —— 首屏「✍️ 作者的话」浮层信笺
 *
 * 视觉（对应 App.css 的 .author 一组）：
 *   · 框：纸白微渐变 + 极细暖灰外边框，再压一圈 inset 9px 的第二道细框（信笺双框）
 *   · 字：正文走 --font-display 衬线展示字（与专辑封面墙的专辑名同一套字），
 *         行高 2.05、两端对齐，适合读长文；首段首字下沉 + 右上角超大衬线引号水印
 *   · 长文多于一屏时只有 .author__letter 内部滚动，信头与落款始终留在原位
 *
 * ⚠️ 与 RedeemPanel 同一约定：App 只在需要时挂载它（{authorOpen && <AuthorNote />}），
 *    关闭即卸载，组件内不需要做「打开时重置」的副作用。
 *
 * props:
 *  onClose() 关闭信笺（✕ / 点遮罩 / 按 Esc 都会调用）
 */
function AuthorNote({ onClose }) {
  /* Esc 关闭 + 浮层期间锁住正文滚动（关掉还原），与 RedeemPanel 行为一致 */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="author" role="dialog" aria-modal="true" aria-labelledby="author-title">
      {/* 点遮罩关闭（背面可读但不抢焦点，纯装饰） */}
      <div className="author__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="author__card">
        <button
          type="button"
          className="author__close"
          onClick={onClose}
          aria-label="关闭作者的话"
          autoFocus
        >
          ✕
        </button>

        <div className="author__head">
          <p className="author__eyebrow">A LETTER FROM THE AUTHOR</p>
          <h2 className="author__title" id="author-title">
            写给同学们的一封信
          </h2>
          <span className="author__rule" aria-hidden="true" />
          <p className="author__meta">尚雅 2026 校运会 · 音乐征集投票平台</p>
        </div>

        {/* tabIndex：长文可能超出一屏，让键盘用户也能聚焦到这里用方向键 / PgDn 继续读 */}
        <div className="author__letter" tabIndex={0}>
          {LETTER.map((para, index) => (
            <p key={index}>{para}</p>
          ))}
        </div>

        <div className="author__sign">
          <span className="author__sign-name">—— HHT</span>
          <span className="author__sign-tip">尚雅 2026 校运会音乐投票 · 作者</span>
        </div>
      </div>
    </div>
  );
}

export default AuthorNote;
