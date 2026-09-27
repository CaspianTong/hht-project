import { useRef } from 'react';
import SongCard from './SongCard';
import { useRevealGroup } from '../utils/reveal';

/**
 * VotingSection —— 投票大厅（搜索 + 排序 + 精简卡片列表）
 *
 * 说明：歌曲分类筛选（全部 / 燃向热血 / 赛道电音 / 流行精选 的果冻胶囊）
 *      已按需求整块移除 —— 工具栏只保留「搜索」与「排序」两项；
 *      每张卡片只展示 歌名 + 歌手，最右侧显示票数。
 *      榜单数据不再有静态 Mock：由 App 从 Supabase 的 songs 表拉取
 *      （按 votes_count 降序）+ Realtime 监听 UPDATE 后重新排序，
 *      这里只负责把结果画出来，外加「加载中 / 连接失败」两种状态。
 *
 * props:
 *  visible         已经过滤/排序后的展示列表
 *  query           搜索关键字
 *  onQueryChange(value)
 *  sortBy          'default' | 'votes'
 *  onSortChange(value)
 *  onVote(id)      长按投票 → Promise<boolean>（这一票是否真的投出去了）
 *  votesLeft       票池里还能投出的票数（免费票 + 兑换票）；>0 时每张卡片都能继续投
 *  extraVotes      剩余「兑换票」张数（提示行里单独说明）
 *  onOpenRedeem()  打开「兑换投票次数」浮层卡片
 *  loading         首次拉取 songs 表是否还在进行中
 *  error           拉取失败的提示文案（空串 = 正常）
 *  onReload()      失败后点「重新加载」重新拉取
 *
 * 注意：这里不向卡片下发「我投过哪些歌」—— 投完票的卡片保持原样留在榜上，
 *      投票成功只由 App 的 Toast + 卡片内的 +1 浮字表达。
 */
function VotingSection({
  visible,
  query,
  onQueryChange,
  sortBy,
  onSortChange,
  onVote,
  votesLeft = 0,
  extraVotes = 0,
  onOpenRedeem,
  loading = false,
  error = '',
  onReload,
}) {
  /* 滑动叙事：卡片进入视口时交错淡入（延迟由 SongCard 注入 --reveal-delay）
     ⚠️ 网格是数据到位后才挂载的：这里必须把「网格是否已经渲染」当开关传给
     useRevealGroup，否则挂载那一刻 ref 还是 null，观察器永远绑不上，
     卡片会停在 App.css 的 opacity: 0 上凭空消失。 */
  const gridRef = useRef(null);
  const gridMounted = !loading && !error && visible.length > 0;
  useRevealGroup(gridRef, gridMounted);

  return (
    <section className="section voting" id="voting">
      <div className="section__head">
        <p className="section__eyebrow">🔥 LIVE · 实时打榜</p>
        <h2 className="section__title">当前热门榜</h2>
        <p className="section__sub">你投出的每一票，都可能改变主舞台的暖场歌单。</p>
      </div>

      {/* 工具栏：搜索 + 排序（分类筛选已移除） */}
      <div className="toolbar">
        <label className="toolbar__search">
          <span className="toolbar__search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜歌名 / 歌手…"
          />
          {query && (
            <button
              type="button"
              className="toolbar__clear"
              onClick={() => onQueryChange('')}
              aria-label="清空搜索"
            >
              ×
            </button>
          )}
        </label>

        <label className="toolbar__sort">
          <span aria-hidden="true">↕️</span>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            aria-label="排序方式"
          >
            <option value="default">实时票数榜（降序）</option>
            <option value="votes">票数最高优先</option>
          </select>
        </label>
      </div>

      {/* 歌曲卡片网格：加载中 / 连接失败 / 搜不到 / 榜上还没歌 / 正常 —— 五种情况
          都复用 .empty 这枚既有空态卡片的样式，不新增任何 CSS */}
      {loading ? (
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">⏳</p>
          <h3>正在拉取实时榜单…</h3>
          <p>票数直接来自数据库，稍等一下就好。</p>
        </div>
      ) : error ? (
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">📡</p>
          <h3>榜单没能连上</h3>
          <p>{error}</p>
          <button type="button" className="btn btn--ghost" onClick={onReload}>
            重新加载
          </button>
        </div>
      ) : gridMounted ? (
        <div className="song-grid" ref={gridRef}>
          {visible.map((song, index) => (
            <SongCard
              key={song.id}
              song={song}
              index={index}
              votesLeft={votesLeft}
              onVote={onVote}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <p className="empty__icon" aria-hidden="true">🎧</p>
          {query ? (
            <>
              <h3>没有匹配的歌曲</h3>
              <p>换个关键词（歌名 / 歌手）再试试？</p>
              <button type="button" className="btn btn--ghost" onClick={() => onQueryChange('')}>
                清除关键词
              </button>
            </>
          ) : (
            <>
              <h3>还没有歌曲上榜</h3>
              <p>到下方「提交我的音乐」投递第一首班级战歌，就能开始打榜啦。</p>
            </>
          )}
        </div>
      )}

      <p className="voting__tip">
        💡 有票就能投，同一首歌可以反复加投（投票按钮长按 2 秒确认，松手才计票）；票数排名前 3 的歌曲将入选校运会开幕主舞台播放单。
        {votesLeft > 0
          ? ` 🎫 剩余投票次数 ${votesLeft} 张${extraVotes > 0 ? `（含兑换票 ${extraVotes} 张）` : ''}。`
          : ' 🎫 投票次数已用完，兑换后可继续加投。'}
        <button type="button" className="link-btn" onClick={onOpenRedeem}>
          🎟️ 兑换投票次数
        </button>
      </p>
    </section>
  );
}

export default VotingSection;
