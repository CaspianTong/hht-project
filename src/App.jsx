/* =====================================================================
 * App —— 尚雅2026校运会音乐展示 · 校运会入选歌单展示平台
 *  - 数据按 Supabase songs 表的 id 升序排列（与入选下载歌单顺序完全一致）
 *  - 保留搜索功能，隐藏投稿与兑换模块
 * ===================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AlbumCovers from './components/AlbumCovers';
import VotingSection from './components/VotingSection';
import Footer from './components/Footer';
import Toast from './components/Toast';
import AuthorNote from './components/AuthorNote';
import SponsorModal from './components/SponsorModal';
import Grainient from './components/Grainient';
import LoadingScreen from './components/LoadingScreen';
import { supabase, isSupabaseReady } from './lib/supabase';
import { bindAnchorScroll } from './utils/smoothScroll';
import { useScrollProgress } from './utils/reveal';
import './App.css';

const readError = (error) => error?.message || '未知错误，请稍后再试';

const toSong = (row) => ({
  id: row.id,
  title: row.title ?? '未命名曲目',
  artist: row.artist ?? '佚名',
  votes: Number(row.votes_count) || 0,
});

const sortByOrder = (list) => [...list].sort((a, b) => Number(a.id) - Number(b.id));

const NOT_READY_HINT =
  '还没有配置 Supabase：请在项目根目录的 .env.local 里填好 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，然后重启 dev server。';

function App() {
  const [songs, setSongs] = useState([]);
  const [songsLoading, setSongsLoading] = useState(isSupabaseReady);
  const [songsRefreshing, setSongsRefreshing] = useState(false);
  const [songsError, setSongsError] = useState(isSupabaseReady ? '' : NOT_READY_HINT);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [toasts, setToasts] = useState([]);

  const [authorOpen, setAuthorOpen] = useState(false);
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorTab, setSponsorTab] = useState('notice');
  const [booting, setBooting] = useState(true);

  const timerRef = useRef({});

  const openSponsor = useCallback((tab = 'notice') => {
    setSponsorTab(
      tab === 'sponsor' ? 'sponsor' : tab === 'feedback' ? 'feedback' : 'notice',
    );
    setSponsorOpen(true);
  }, []);

  const closeSponsor = useCallback(() => setSponsorOpen(false), []);

  const finishBoot = useCallback(() => {
    setBooting(false);
    openSponsor('notice');
  }, [openSponsor]);

  const dismissToast = useCallback(
    (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const pushToast = useCallback(
    (text, tone = 'info', action = null) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, text, tone, action }]);
      if (timerRef.current[id]) clearTimeout(timerRef.current[id]);
      timerRef.current[id] = setTimeout(() => dismissToast(id), 2800);
    },
    [dismissToast],
  );

  useEffect(() => bindAnchorScroll(), []);
  useScrollProgress();

  /* 按 id 升序拉取入选歌单，严格保持导入顺序 */
  const loadSongs = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, votes_count')
        .order('id', { ascending: true });

      if (error) throw error;

      setSongsError('');
      setSongs(sortByOrder((data ?? []).map(toSong)));
    } catch (err) {
      setSongsError(readError(err));
    } finally {
      setSongsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;
    loadSongs();
  }, [loadSongs]);

  const reloadSongs = useCallback(async () => {
    if (!supabase || songsRefreshing) return;
    setSongsError('');
    setSongsRefreshing(true);
    try {
      await loadSongs();
    } finally {
      setSongsRefreshing(false);
    }
  }, [loadSongs, songsRefreshing]);

  /* 保留搜索过滤功能 */
  const visible = useMemo(() => {
    const kw = query.trim().toLowerCase();
    if (!kw) return songs;
    return songs.filter(
      (s) =>
        (s.title ?? '').toLowerCase().includes(kw) ||
        (s.artist ?? '').toLowerCase().includes(kw),
    );
  }, [songs, query]);

  const rankById = useMemo(
    () => new Map(songs.map((song, index) => [String(song.id), index + 1])),
    [songs],
  );

  /* 屏蔽投票动作 */
  const handleVote = useCallback(async () => false, []);
  const handleDisabledRedeem = useCallback(() => {
    pushToast('投票活动已结束，当前为入选歌单展示模式。', 'info');
  }, [pushToast]);

  const openAuthor = useCallback(() => setAuthorOpen(true), []);
  const closeAuthor = useCallback(() => setAuthorOpen(false), []);

  return (
    <div
      className="playlist-only-mode"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        color: 'var(--text-main)',
      }}
    >
      {/* 1. 底层背景 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.92,
        }}
      >
        <Grainient
          color1="#fbf9f6"
          color2="#f3efea"
          color3="#f6ece6"
          timeSpeed={0.3}
          warpStrength={1}
          warpFrequency={5}
          warpSpeed={2.0}
          warpAmplitude={50}
          grainAmount={0.05}
          grainScale={2}
          contrast={1.06}
          saturation={1.05}
          zoom={0.9}
        />
      </div>

      {/* 1.5 环境层 */}
      <div className="bg-decor" aria-hidden="true">
        <span className="bg-decor__grid" />
        <span className="bg-decor__glow bg-decor__glow--coral" />
        <span className="bg-decor__glow bg-decor__glow--blue" />
        <span className="bg-decor__glow bg-decor__glow--gold" />
      </div>

      {/* 2. 主内容层 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar onOpenSponsor={openSponsor} />

        <main>
          <Hero
            extraVotes={0}
            onOpenRedeem={handleDisabledRedeem}
            onOpenAuthor={openAuthor}
          />

          <AlbumCovers />

          {/* 入选歌单展示区（保留搜索框，隐藏票数与投票按钮） */}
          <VotingSection
            visible={visible}
            rankById={rankById}
            query={query}
            onQueryChange={setQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onVote={handleVote}
            votesLeft={0}
            loading={songsLoading}
            refreshing={songsRefreshing}
            error={songsError}
            onReload={reloadSongs}
          />
        </main>

        <Footer onOpenSponsor={openSponsor} />
      </div>

      <Toast toasts={toasts} onDismiss={dismissToast} />
      {authorOpen && <AuthorNote onClose={closeAuthor} />}
      {sponsorOpen && (
        <SponsorModal
          key={sponsorTab}
          initialTab={sponsorTab}
          onClose={closeSponsor}
        />
      )}
      {booting && <LoadingScreen onDone={finishBoot} />}
    </div>
  );
}

export default App;