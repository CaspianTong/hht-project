import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEMO_VOTE_CODES,
  VOTES_PER_CODE,
  VOTE_CODE_LENGTH,
} from '../data/mockSongs';
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
 *  onRedeem(code)  兑换回调，返回 { ok, reason? }；
 *                  reason = 'invalid' 验证码不存在 / 'used' 该码已经兑换过
 */
function RedeemPanel({ onClose, onRedeem }) {
  /* status : 'idle' | 'error' | 'success' —— 直接喂给 CodeSlots 的 status */
  const [status, setStatus] = useState('idle');
  const [checking, setChecking] = useState(false);
  const [reason, setReason] = useState('');
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

  /** 8 位数字填满时触发（onComplete 只在填满瞬间调用一次） */
  const handleVerify = useCallback(
    async (code) => {
      setChecking(true);
      const res = await onRedeem(code);
      setChecking(false);

      if (res?.ok) {
        setStatus('success');
        closeTimer.current = setTimeout(onClose, 1400);
        return;
      }

      setReason(res?.reason ?? 'invalid');
      setStatus('error');
    },
    [onRedeem, onClose],
  );

  const tone = checking ? 'checking' : status;
  const text = checking
    ? '⏳ 正在核验兑换码…'
    : status === 'success'
      ? `✅ 兑换成功！投票次数 +${VOTES_PER_CODE}，可以为喜欢的歌继续加投啦`
      : status === 'error'
        ? reason === 'used'
          ? '⚠️ 这个兑换码已经用过了（一码一次哦）'
          : '⚠️ 兑换码不正确，请核对后重新输入'
        : `输入 ${VOTE_CODE_LENGTH} 位数字后自动兑换`;

  return (
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
        <div className={`passcode is-${status}`}>
          <div className="passcode__head">
            <span className="passcode__label">{VOTE_CODE_LENGTH} 位验证码 *</span>
            <span className="passcode__hint">
              演示验证码 <code className="passcode__demo">{DEMO_VOTE_CODES[0]}</code>
              （正式上线由校广播站按班级下发）
            </span>
          </div>

          <CodeSlots
            length={VOTE_CODE_LENGTH}
            status={status}
            disabled={checking}
            autoFocus
            onChange={() => setStatus('idle')}
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

        <p className="redeem__foot">
          🎟️ 一码一次 · 兑换后可给任意歌曲继续加投 {VOTES_PER_CODE} 票
        </p>
      </div>
    </div>
  );
}

export default RedeemPanel;
