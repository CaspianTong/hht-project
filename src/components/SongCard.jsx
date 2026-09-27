import { useEffect, useRef, useState } from 'react';
import HoldButton from './bottom2';

/** 长按判定时长（毫秒）：与 VotingSection 底部提示里的「2 秒」保持一致 */
const VOTE_HOLD_MS = 2000;

/**
 * SongCard —— 单曲投票卡片（精简版：一行只放三样东西）
 *
 *   左：歌名（主）+ 歌手（次）      中右：投票按钮      最右：当前票数
 *
 * 精简掉的内容（数据仍在 song 上，只是不再展示）：
 *   封面图 / 封面 emoji、TOP 名次徽章、分类标签、音浪可视化条、
 *   虚拟播放按钮、一句话推荐、投稿班级与时长徽章 —— 扫榜更快、视觉更干净。
 *
 * 【投票后的表现：卡片「保持不变」，只弹成功提示】
 *   投完票，这张卡片的外观 / 位置 / 可点性一律不变，绝不消失、不变淡、不换色：
 *     · 卡片根节点 className 恒定（永远是 "song-card"）—— 这一点很关键：
 *       滚动淡入标记（data-revealed / .is-revealed）是 JS 直写在 DOM 上的，
 *       一旦这里因「已投票」而改 className，React 会整体重写 class 属性，
 *       把淡入标记冲掉，卡片就退回 opacity: 0 凭空消失（曾经的真实 bug）。
 *     · 因此卡片没有「已投票 / 绿边 / 再投一票」这类持久态；投票成功只用三处
 *       瞬时反馈表达：按钮短暂显示「已投票」、票数旁浮起「+1 🔥」、页面右下角「投票成功」Toast。
 *
 * 投票按钮状态（票池见底才锁定；长按判定特效来自 components/bottom2 的 HoldButton）：
 *   票池还有票 → 恒定显示「投 TA 一票」（高级蓝胶囊；按住 2 秒，蓝底上漫过一道白浪，
 *                 松手才计票；同一首歌可以投任意多次，每确认一次消耗票池里 1 张票）
 *   票池已空   → 显示「票已用完」（中性灰锁定态，禁用）
 *   按钮文案一律纯文本（不加 emoji）；轻点不会投票，只有按满 VOTE_HOLD_MS 才触发。
 *
 * ⚠️ 将来想无缝替换为 3D / 视差 / WebGL 卡片时：
 *   只要保持下方这套 props 契约不变，直接整体替换本文件即可，
 *   App.jsx 与其余逻辑一行都不用改。
 *
 * @component
 * @param {Object}  props
 * @param {Object}  props.song
 *   song.id     歌曲唯一 id
 *   song.title  歌曲名（卡片主信息）
 *   song.artist 歌手 / 乐队（卡片次信息）
 *   song.votes  得票数（卡片最右侧信息）
 * @param {number}  props.index     在展示列表中的序号（用于交错淡入延迟）
 * @param {number}  props.votesLeft 票池里还能投出的票数（>0 时任何歌都能继续投）
 * @param {Function} props.onVote   投票回调 onVote(song.id) → Promise<boolean>，
 *                                  返回值 = 这一票是否真的投出去了（决定要不要飘 +1）
 */
export default function SongCard({ song, index = 0, votesLeft = 0, onVote }) {
  /* 票池模型：票池里还有票 → 任何一首歌都能投（同一首也能反复投）；票池见底才锁定。
     这里刻意不记录「我投没投过这首歌」—— 投完票卡片保持原样，不做任何持久态变化。 */
  const locked = votesLeft <= 0;
  const idleLabel = locked ? '票已用完' : '投 TA 一票';
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef(null);

  /** 长按满 VOTE_HOLD_MS（由 HoldButton 判定通过）→ 真投票：
   *  onVote 返回「这一票是否真的投出去了」（App 内部已兜住所有异常，不会抛错），
   *  只有 true 才飘 +1 浮字 —— 取消了登记 / 服务端拒绝 / 网络失败都不该假装成功。
   *  卡片外观、结构、className 一律不变。 */
  const handleVote = async () => {
    if (locked) return; // 票池见底：双重保险
    let ok = false;
    try {
      ok = (await onVote?.(song.id)) === true;
    } catch {
      /* 兜底：onVote 正常不会抛错；真抛了也只当作没投出去，静静回到初始态 */
    }
    if (!ok) return;
    setBurst(true);
    if (burstTimer.current) clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), 950);
  };

  // 卸载时清理 +1 动画定时器
  useEffect(() => () => clearTimeout(burstTimer.current), []);

  return (
    <article
      /* ⚠️ className 必须恒定：一旦随投票状态变化，React 会整体重写 class 属性，
         把 useRevealGroup 写上的 .is-revealed / data-revealed 冲掉 → 卡片 opacity:0 消失。
         所以投票成功只走「按钮瞬时文案 + +1 浮字 + Toast」，这里不加任何状态类。 */
      className="song-card"
      data-reveal
      style={{
        /* 交错淡入：每张卡片延后 45ms，形成自上而下的叙事节奏 */
        '--reveal-delay': `${Math.min(index, 11) * 45}ms`,
      }}
    >
      {/* 左：歌名 + 歌手（卡片只保留这两项歌曲信息） */}
      <div className="song-card__main">
        <h3 className="song-card__title" title={song.title}>
          {song.title}
        </h3>
        <p className="song-card__artist" title={song.artist}>
          {song.artist}
        </p>
      </div>

      {/* 中右：投票按钮（长按判定 —— 按住 VOTE_HOLD_MS 毫秒才会真的投票，轻点不误投）
          长按推进色 = 纯白：高级蓝底上漫过一道白浪（不再是金色），浪峰扫过的文案同步翻成深墨色。
          className 只在「票池见底」时加一个中性锁定态，与「我投没投过这首歌」无关 */}
      <HoldButton
        className={`vote-hold${locked ? ' vote-hold--spent' : ''}`}
        size="md"
        radius={999}
        holdTime={VOTE_HOLD_MS}
        backgroundColor={locked ? 'var(--surface-veil-strong)' : 'var(--accent-primary)'}
        fillColor={locked ? 'var(--surface-veil-strong)' : '#ffffff'}
        textColor={locked ? 'var(--text-muted)' : 'var(--text-on-accent)'}
        fillTextColor={locked ? 'var(--text-muted)' : 'var(--text-main)'}
        doneLabel="已投票"
        disabled={locked}
        onHold={handleVote}
      >
        {idleLabel}
        {/* 屏幕上只有按钮文案，读屏时补上歌名，免得整页都是同一个「投 TA 一票」 */}
        <span className="hold-button__sr">，歌曲《{song.title}》</span>
      </HoldButton>

      {/* 最右：票数（+1 飘字反馈） */}
      <div className="song-card__votes">
        {burst && <span className="song-card__plus">+1 🔥</span>}
        <span className="song-card__flame" aria-hidden="true">🔥</span>
        <strong>{song.votes}</strong>
        <em>票</em>
      </div>
    </article>
  );
}
