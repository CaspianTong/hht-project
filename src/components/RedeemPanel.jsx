import { useCallback, useEffect, useRef, useState } from 'react';
import { VOTES_PER_CODE, VOTE_CODE_LENGTH } from '../data/mockSongs';
import CodeSlots from './CodeSlots';

/* CodeSlots 配色：全部引用 index.css 设计令牌，与暖白轻奢主题保持同一套语言
 *  · accent 樱花粉   → 已落定数字的填充块 / 校验成功时合并成的整条色带
 *  · ink    高级蓝   → 光标线 + 激活槽位的蓝色晕染（“正在输入”的信号）
 *  · slot   白玻璃   → 空槽位，与 .field input 内嵌底一致
 *  · digit  深墨色   → 填充块上的数字 + 成功勾号（浅粉底必须配深字才看得清）
 *  · danger 高级蓝加深 → 与 .passcode__status.is-error 复用同一套错误色
 */
const SLOT_COLORS = {
  accentColor: 'var(--accent-pink)',
  inkColor: 'var(--accent-primary)',
  slotColor: 'var(--bg-inset)',
  digitColor: 'var(--ink-strong)',
  dangerColor: 'var(--accent-primary-hover)',
};

/* 失败原因 → 用户能看懂的提示（App 若给了更具体的 message，会优先用 App 的） */
const REDEEM_ERROR_TEXT = {
  invalid: '兑换码无效，请核对 8 位卡券内容',
  used: '该卡券已被使用，请换一张',
  permission: '数据库写入受限，请联系管理员',
  network: '网络连接异常，请检查网络后重试',
  error: '核销失败，请稍后重试或联系负责人',
};

/**
 * RedeemPanel —— 首屏「兑换投票次数」浮层卡片
 *
 * 卡片里只有一个输入框：React Bits <CodeSlots />，8 位验证码填满即自动兑换，
 * 成功则 +5 票并自动收起卡片（无需再点一次按钮），失败留在卡片里提示重输。
 *
 * ⚠️ 本组件不做“打开时重置”的副作用 —— App 只在需要时挂载它
 *    （{redeemOpen && <RedeemPanel />}），每次打开都是全新状态。
 *
 * props:
 *  onClose()       关闭卡片（✕ / 点遮罩 / 按 Esc 都会调用）
 *  onRedeem(code)  兑换回调（App 侧查 Supabase 的 redemption_codes 表并核销），
 *                  返回 { ok, reason?, message? }；
 *                  reason = 'invalid' 无效 / 'used' 已使用 / 'permission' 权限受限
 *                         / 'network' 网络异常 / 'error' 其它异常
 */
function RedeemPanel({ onClose, onRedeem }) {
  /* status : 'idle' | 'error' | 'success' —— 直接喂给 CodeSlots 的 status */
  const [status, setStatus] = useState('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const submittingRef = useRef(false); /* 同步锁：setState 还没生效时也能挡住第二次请求 */
  const closeTimer = useRef(undefined);

  /* Esc 关闭 + 浮层期间锁住正文滚动（关掉还原） */
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

  /* 卸载时清理“兑换成功后自动关闭”的定时器 */
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  /** 8 位兑换码填满时触发（onComplete 只在填满瞬间调用一次）
   *  —— 手机双击 / 回车 / 连按最后一位都可能让 onComplete 触发两次，
   *     这里用 submittingRef 做同步防抖：第一次进来立刻上锁，后续调用直接返回。
   *  onRedeem 内部已兜住 Supabase 异常；try/finally 保证 isSubmitting 一定复位。 */
  const handleVerify = useCallback(
    async (code) => {
      if (submittingRef.current) return;

      submittingRef.current = true;
      setIsSubmitting(true);
      setErrorMessage('');

      try {
        const res = await onRedeem(code);

        if (res?.ok) {
          setStatus('success');
          closeTimer.current = setTimeout(onClose, 1400);
          return;
        }

        setErrorMessage(
          res?.message ||
            REDEEM_ERROR_TEXT[res?.reason] ||
            REDEEM_ERROR_TEXT.error,
        );
        setStatus('error');
      } catch (err) {
        console.error('兑换报错详情:', err);
        setErrorMessage(REDEEM_ERROR_TEXT.network);
        setStatus('error');
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [onRedeem, onClose],
  );

  const tone = isSubmitting ? 'checking' : status;
  const text = isSubmitting
    ? '⏳ 正在核验兑换码…'
    : status === 'success'
      ? `✅ 兑换成功！投票次数 +${VOTES_PER_CODE}，可以为喜欢的歌继续加投啦`
      : status === 'error'
        ? `⚠️ ${errorMessage || REDEEM_ERROR_TEXT.error}`
        : `输入 ${VOTE_CODE_LENGTH} 位兑换码后自动兑换 · 字母大小写均可`;

  return (
    /* 注意：这里是 dialog 而不是 form —— 不存在原生 submit / 页面 reload；
       CodeSlots 的 Enter 键也已 preventDefault，双保险。 */
    <div className="redeem" role="dialog" aria-modal="true" aria-labelledby="redeem-title">
      {/* 点遮罩关闭（背面可读但不抢焦点，纯装饰） */}
      <div className="redeem__backdrop" onClick={onClose} aria-hidden="true" />

      <div className="redeem__card">
        <button
          type="button"
          className="redeem__close"
          onClick={onClose}
          aria-label="关闭兑换卡片"
        >
          ✕
        </button>

        <div className="redeem__head">
          <span className="redeem__icon" aria-hidden="true">
            🎟️
          </span>
          <h2 className="redeem__title" id="redeem-title">
            兑换投票次数
          </h2>
          <p className="redeem__sub">
            输入 {VOTE_CODE_LENGTH} 位验证码，即可兑换 {VOTES_PER_CODE} 票
          </p>
        </div>

        {/* 验证码输入：React Bits <CodeSlots />（8 位填满即自动校验） */}
        <div className={`passcode is-${status}`} aria-busy={isSubmitting ? 'true' : undefined}>
          <div className="passcode__head">
            <span className="passcode__label">{VOTE_CODE_LENGTH} 位验证码 *</span>
          </div>

          <CodeSlots
            length={VOTE_CODE_LENGTH}
            allowLetters
            uppercase
            status={status}
            disabled={isSubmitting}
            autoFocus
            onChange={() => {
              setStatus('idle');
              setErrorMessage('');
            }}
            onComplete={handleVerify}
            ariaLabel={`${VOTE_CODE_LENGTH} 位投票兑换验证码`}
            slotSize={40}
            gap={8}
            radius={12}
            bounce={0.2}
            settle={0.3}
            rise={8}
            cascade={20}
            {...SLOT_COLORS}
          />

          <p className={`passcode__status is-${tone}`} role="status">
            {text}
          </p>
        </div>

        <p className="redeem__contact">
          兑换码由广播站按班级下发；如有疑问请联系负责人微信：[填写你的微信号]
        </p>

        <p className="redeem__foot">
          🎟️ 一码一次 · 兑换后可给任意歌曲继续加投 {VOTES_PER_CODE} 票
        </p>
      </div>
    </div>
  );
}

export default RedeemPanel;
