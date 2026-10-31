/* =====================================================================
 * App —— 尚雅2026校运会音乐投票 · 校运会音乐征集投票平台
 *
 * 【本版 = 你的当前页面 + 第一版完整功能 + Supabase 实战】
 *  - 保留：Grainient 颗粒动态背景、Navbar、氛围 Hero、专辑封面墙、
 *          兑换投票次数浮层、搜索 / 排序工具栏、投票成功 Toast、投稿上架、
 *          功能型 Footer、锚点联动、作者的话信笺、支持与反馈弹窗（交流 / 投喂）、首屏加载界面
 *  - 数据：榜单歌曲全部来自 Supabase 的 songs 表（原先写死的 6 首 Mock 已删除）
 *
 * 【Supabase 数据层】—— 集中在下面几段 useCallback / useEffect 里
 *  1. 拉取：supabase.from('songs').select(...).order('votes_count', 降序) → 票数榜
 *  2. 实时：Realtime 监听 songs 表的 UPDATE 事件 → 就地写回票数并重新排序（无刷新）
 *  3. 投票：supabase.rpc('increment_vote', { target_song_id, user_id_str })，
 *          投票人身份 = localStorage 的 shangya_voter_id（匿名设备标识，
 *          首次投票静默生成，不弹任何输入框、不要求登记班级 / 学号）
 *  4. 投稿：先按「歌名 + 歌手」查重（忽略大小写与首尾空格）——
 *          榜上已有 → 不重复插记录，直接转成第 3 条的投票流程给已有歌曲 +1 票；
 *          榜上没有 → supabase.from('songs').insert() 落库（保留原格式大小写），
 *          成功后前插本地榜单
 *  客户端实例见 src/lib/supabase.js（连接信息读 .env.local 的 VITE_SUPABASE_*）
 *
 * 【状态中心】
 *  songs          全部歌曲（来自 Supabase；票数变动由 Realtime 同步）
 *  songsLoading   首次拉取是否进行中（榜单显示「正在拉取」而不是空态）
 *  songsRefreshing 手动同步是否进行中（只影响按钮 Loading 与榜单淡出，不重置票池）
 *  songsError     拉取失败的提示文案（榜单显示「重新加载」）
 *  extraVotes     可用投票张数（唯一来源 = 兑换码核销，每个码 +5；写入 localStorage 持久化）
 *  toasts         全局轻提示
 *
 * 【票池】没有免费票：votesLeft = extraVotes —— 只能靠兑换码换票，
 *        兑多少就有多少，投一张减一张，见底就把投票拦下来引导去兑换。
 *        → 交给「提交我的音乐」卡片右上角的剩余票数仪表显示
 *        （票池只是本地票闸：真正加票的是数据库存储过程，
 *          而且只在「服务端确认投票成功」之后才扣掉一张）
 *
 * 【兑换核销】8 位兑换码已接 Supabase 的 redemption_codes 表：
 *  大小写不敏感：ilike 查 code → 用实际存储的 code 置 used = true + used_at → 再加票
 *  （一码一次由数据库兜住）。
 * ===================================================================== */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AlbumCovers from './components/AlbumCovers';
import VotingSection from './components/VotingSection';
import SubmitPanel from './components/SubmitPanel';
import Footer from './components/Footer';
import Toast from './components/Toast';
import RedeemPanel from './components/RedeemPanel';
import AuthorNote from './components/AuthorNote';
import SponsorModal from './components/SponsorModal';
import Grainient from './components/Grainient';
import LoadingScreen from './components/LoadingScreen';
import { VOTES_PER_CODE, VOTE_CODE_LENGTH } from './data/mockSongs';
import { supabase, isSupabaseReady } from './lib/supabase';
import { bindAnchorScroll } from './utils/smoothScroll';
import { useScrollProgress } from './utils/reveal';
import './App.css';

/* =====================================================================
 * 数据层小工具（Supabase ↔ 卡片之间那层薄薄的搬运工）
 * ===================================================================== */

/** Supabase 的报错统一转成人话（网络断了 / RLS 拒绝 / 表名不对都会走到这里） */
const readError = (error) => error?.message || '未知错误，请稍后再试';

/**
 * 数据库行 → 卡片数据
 * songs 表用 votes_count 记票数，卡片沿用 song.votes（SongCard 的 props 契约不变，
 * 所以卡片样式 / 结构一行都不用改）。
 * @param {Object} row songs 的一行：{ id, title, artist, votes_count }
 * @returns {{ id: *, title: string, artist: string, votes: number }}
 */
const toSong = (row) => ({
  id: row.id,
  title: row.title ?? '未命名曲目',
  artist: row.artist ?? '佚名',
  votes: Number(row.votes_count) || 0,
});

/** 按票数降序重排（返回新数组，保持 state 不可变）：首次拉取与 Realtime 重排共用 */
const sortByVotes = (list) => [...list].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

/**
 * 存储过程返回值归一化：jsonb 对象 / TABLE 结果集 / 纯布尔都读得出来。
 * 没给 success 字段（或给了 null）时按成功处理 —— 调用本身没报错，
 * 就说明存储过程确实把票加上了，前端不替数据库发明失败。
 */
const readVoteResult = (data) => {
  if (typeof data === 'boolean') return { success: data, message: '' };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return { success: true, message: '' };
  return { success: row.success ?? true, message: row.message ?? '' };
};

/* ---------------- 投票人身份（存储过程参数 user_id_str） ----------------
 * 不再要求投票人登记「班级 + 学号 / 姓名」：首次投票时前端静默生成一个
 * 匿名设备标识（标准 UUID，不含任何个人信息），存进 localStorage 的
 * shangya_voter_id；之后每次投票直接复用，全程不弹任何输入框。
 * 它唯一的用途是喂给存储过程 increment_vote 的 user_id_str 参数
 * （服务端靠它做去重 / 频次判断），与「谁投的」没有任何关系。
 * （手动清掉这条记录，下次投票会重新生成一个新的匿名标识。） */
const VOTER_ID_KEY = 'shangya_voter_id';

/** 生成匿名设备标识：优先用 crypto.randomUUID，老环境退回时间戳 + 随机串 */
const createAnonVoterId = () => {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    /* 老浏览器没有 randomUUID，走下面的兜底 */
  }
  return `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

/** 取身份：读缓存，没有就静默生成一个并写入 —— 不弹窗、不打断投票，永远返回非空串。
 *  隐私模式 / 禁用存储（localStorage 抛错）时用本次临时标识，投票照常进行。 */
const ensureVoterId = () => {
  try {
    const cached = window.localStorage.getItem(VOTER_ID_KEY);
    if (cached) return cached;

    const id = createAnonVoterId();
    window.localStorage.setItem(VOTER_ID_KEY, id);
    return id;
  } catch {
    return createAnonVoterId();
  }
};

/** 环境变量没配齐时榜单要显示的提示（初始状态与「重新加载」共用同一句话） */
const NOT_READY_HINT =
  '还没有配置 Supabase：请在项目根目录的 .env.local 里填好 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY，然后重启 dev server。';

/* ---------------- 本地票池持久化 ----------------
 * 兑换来的票只存在浏览器本地（数据库只记录歌曲票数），
 * 因此必须自己落盘：微信内置浏览器 / 手机浏览器下拉刷新页面后，
 * 未用完的票数要从 localStorage 原样恢复，不能归零。 */
const VOTES_LEFT_KEY = 'user_votes_left';

/** 读取本地票数：缺失 / 非法 / 存储不可用一律回落到 0，绝不打断首屏 */
const readStoredVotes = () => {
  try {
    const raw = window.localStorage.getItem(VOTES_LEFT_KEY);
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

/** 写回本地票数：隐私模式 / 禁用存储时静默降级，投票与兑换照常进行 */
const writeStoredVotes = (n) => {
  try {
    window.localStorage.setItem(VOTES_LEFT_KEY, String(n));
  } catch {
    /* 存不了就只保留在内存里，不影响本次使用 */
  }
};

/* ---------------- 兑换码清洗 / 错误分类 ----------------
 * 手机输入法常见问题：全角字母数字、首字母大写、末尾空格 / 换行、粘贴带隐藏字符。
 * 进数据库前统一转半角 → 去掉所有空白 → 转大写，保证查询串是干净的 8 位大写码。 */
const toHalfWidth = (raw) =>
  String(raw ?? '')
    /* 全角 ASCII 区（！～）整体左移 0xFEE0 → 半角；全角空格单独换普通空格 */
    .replace(/[\uFF01-\uFF5E]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .replace(/\u3000/g, ' ');

const cleanRedemptionCode = (raw) =>
  toHalfWidth(raw)
    /* 零宽空格 / BOM 等不可见字符：部分手机输入法粘贴会带进来 */
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\s\r\n\t]/g, '')
    .trim()
    .toUpperCase();

/** 把错误归类成 RedeemPanel 能展示的明确文案 */
const describeRedeemError = (error, stage) => {
  const code = String(error?.code ?? '');
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();

  const permissionDenied =
    code === '42501' ||
    code === '401' ||
    code === '403' ||
    text.includes('row-level security') ||
    text.includes('permission denied') ||
    text.includes('not allowed');

  if (permissionDenied) {
    return {
      reason: 'permission',
      message:
        stage === 'update'
          ? '数据库写入受限，请联系管理员'
          : '数据库读取受限，请联系管理员',
    };
  }

  const networkFailed =
    error instanceof TypeError ||
    text.includes('failed to fetch') ||
    text.includes('load failed') || /* iOS Safari 的 fetch 失败文案 */
    text.includes('networkerror') ||
    text.includes('network request failed') ||
    text.includes('network connection was lost') ||
    text.includes('could not connect') ||
    text.includes('the internet connection appears to be offline') ||
    text.includes('timed out') ||
    text.includes('timeout');

  if (networkFailed) {
    return { reason: 'network', message: '网络连接异常，请检查网络后重试' };
  }

  return { reason: 'error', message: '核销失败，请稍后重试或联系管理员' };
};

/** Realtime 通道名自增序号：StrictMode 下会「挂载 → 卸载 → 再挂载」，
 *  而 removeChannel 是异步退订的，同名通道可能和新通道撞在一起，
 *  所以每次挂载都取一个全新的话题名（同名话题名还是分开的订阅，互不干扰）。 */
let channelSeq = 0;

function App() {
  /* 榜单歌曲：初始为空数组 —— 挂载后立刻从 Supabase 的 songs 表拉全量（票数降序） */
  const [songs, setSongs] = useState([]);
  /* 拉取状态：loading 时榜单显示「正在拉取」，error 时显示「重新加载」；
     环境变量没配齐就直接以「未配置」的错误态开屏，免得一直转圈。
     songsRefreshing 只用于「手动同步最新榜单」—— 刷新期间保留旧榜单，
     只让同步按钮转圈 + 榜单轻微淡出，绝不切回空空的加载态。 */
  const [songsLoading, setSongsLoading] = useState(isSupabaseReady);
  const [songsRefreshing, setSongsRefreshing] = useState(false);
  const [songsError, setSongsError] = useState(isSupabaseReady ? '' : NOT_READY_HINT);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [toasts, setToasts] = useState([]);

  /* 兑换投票次数：extraVotes = 可用「兑换票」张数；redeemOpen = 浮层开关
     初始值从 localStorage 恢复 —— 刷新页面后未用完的票数不会清零 */
  const [extraVotes, setExtraVotes] = useState(readStoredVotes);
  const [redeemOpen, setRedeemOpen] = useState(false);

  /* 票池持久化：extraVotes 就是 votesLeft 的唯一来源。
     兑换 +5 / 投票 -1 都会触发这里，立刻写回 localStorage['user_votes_left'] */
  useEffect(() => {
    writeStoredVotes(extraVotes);
  }, [extraVotes]);

  /* 作者的话：首屏「✍️ 作者的话」信笺浮层开关（与兑换浮层同一个挂载约定） */
  const [authorOpen, setAuthorOpen] = useState(false);

  /* 支持与反馈 / 投喂站长：页脚常驻入口、菜单、投票成功 Toast 都能唤起；
     sponsorTab 决定默认落在哪个 Tab（feedback 交流 / sponsor 投喂） */
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorTab, setSponsorTab] = useState('feedback');

  /* 打开弹窗：不传参数默认「交流与反馈」，传 'sponsor' 直达投喂页 */
  const openSponsor = useCallback((tab = 'feedback') => {
    setSponsorTab(tab === 'sponsor' ? 'sponsor' : 'feedback');
    setSponsorOpen(true);
  }, []);

  const closeSponsor = useCallback(() => setSponsorOpen(false), []);

  /* 首屏加载界面开关：现在是「假判定」——LoadingScreen 自己数 1.5 秒，淡出后回调关掉 */
  const [booting, setBooting] = useState(true);

  const timerRef = useRef({});

  /* ---------------- 首屏加载界面 ---------------- */
  /* 加载结束：先卸载 loading，同时把「☕ 支持与反馈」弹窗展示出来（默认交流与反馈页）；
     关掉之后仍可从页脚 / 菜单 / 投票成功 Toast 再次打开 */
  const finishBoot = useCallback(() => {
    setBooting(false);
    openSponsor('feedback');
  }, [openSponsor]);

  /* ---------------- Toast ---------------- */
  const dismissToast = useCallback(
    (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  /**
   * @param text   提示文案
   * @param tone   success | info | warn
   * @param action 可选：第二行的动作链接（如投票成功后的「请作者喝瓶可乐 🥤」）
   *               带动作的提示停留更久，留出点击时间
   */
  const pushToast = useCallback(
    (text, tone = 'success', action = null) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, text, tone, action }]);
      if (timerRef.current[id]) clearTimeout(timerRef.current[id]);
      timerRef.current[id] = setTimeout(
        () => dismissToast(id),
        action ? 6500 : 2800,
      );
    },
    [dismissToast],
  );

  /* ---------------- 站内锚点平滑滚动 ----------------
   * 拦截菜单 / CTA / 页脚里的 #锚点 点击，改为逐帧缓动滚动，
   * 避免瞬间“传送”式跳转，页面过渡更自然。
   */
  useEffect(() => bindAnchorScroll(), []);

  /* 背景弥散光晕的“呼吸感”：把整页滚动进度写入 :root 的 --scroll-progress */
  useScrollProgress();

  /* ---------------- Supabase 数据层（榜单的真身） ---------------- */

  /** 拉取 songs 表全量：只取卡片要用的 4 列，按票数降序 —— 这就是默认的榜单顺序。
   *  ⚠️ try 里第一件事就是 await：不在 effect 里同步 setState，避免连锁渲染。 */
  const loadSongs = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, title, artist, votes_count')
        .order('votes_count', { ascending: false });

      if (error) throw error;

      setSongsError('');
      setSongs(sortByVotes((data ?? []).map(toSong)));
    } catch (err) {
      setSongsError(readError(err));
    } finally {
      setSongsLoading(false);
    }
  }, []);

  /** Realtime：songs 表某行被 UPDATE（票数变了）→ 就地把新票数写回本地并重新排序，
   *  不重新拉接口、不刷新页面；本地还没有这行（别人刚投稿、还没被投过票）就补进来。 */
  const applyRealtimeRow = useCallback((row) => {
    if (!row) return;
    const incoming = toSong(row);
    const sameId = (s) => String(s.id) === String(incoming.id);

    setSongs((prev) =>
      sortByVotes(
        prev.some(sameId)
          ? prev.map((s) => (sameId(s) ? incoming : s))
          : [...prev, incoming],
      ),
    );
  }, []);

  /* 挂载：先拉全量榜单，再开 Realtime 通道；卸载时把通道一并撤掉
     （StrictMode 下会「挂载 → 卸载 → 再挂载」，这里必须成对清理，否则会开出两条通道） */
  useEffect(() => {
    if (!supabase) return undefined;

    loadSongs();

    const channel = supabase
      .channel(`songs-live-${(channelSeq += 1)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'songs' },
        (payload) => applyRealtimeRow(payload.new),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSongs, applyRealtimeRow]);

  /** 手动「同步最新榜单」/ 失败重试：只重新拉取 Supabase 的 songs
   *  （排序 + votes_count 全量快照），绝不改动 extraVotes / localStorage 里的本地票池。
   *  刷新期间旧榜单保持可见（VotingSection 负责按钮 Loading + 轻微淡出），
   *  请求结束后再平滑淡入最新排名。 */
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

  /* ---------------- 派生数据 ---------------- */
  /* 过滤 + 排序（关键字 → 排序）：分类筛选已移除，只按歌名 / 歌手搜索 */
  const visible = useMemo(() => {
    let list = songs;
    const kw = query.trim().toLowerCase();
    if (kw) {
      list = list.filter(
        (s) =>
          (s.title ?? '').toLowerCase().includes(kw) ||
          (s.artist ?? '').toLowerCase().includes(kw),
      );
    }
    /* 默认顺序就是接口给的票数榜（App 里 songs 始终按 votes_count 降序 +
       Realtime 重排），这里只在用户显式选了「票数最高优先」时再排一次兜底 */
    if (sortBy === 'votes') {
      list = sortByVotes(list);
    }
    return list;
  }, [songs, query, sortBy]);

  /* 名次映射：以「全量榜单」为基准（songs 始终按票数降序），
     这样搜索过滤后每首歌仍显示真实名次，而不是在结果里重新从 1 开始 */
  const rankById = useMemo(
    () => new Map(songs.map((song, index) => [String(song.id), index + 1])),
    [songs],
  );

  /* 票池（「提交我的音乐」卡片右上角仪表的数据源）
   *  没有免费票：所有票都来自兑换码核销（每个码 +5），兑多少就有多少；
   *  只要它 > 0，任意歌曲都能继续投，同一首歌投几次都行，
   *  票池见底才拦（引导去兑换），会随投票 / 兑换实时变化。 */
  const votesLeft = extraVotes;

  /* ---------------- 交互逻辑 ---------------- */

  /** 长按投票（实战版）：
   *  1) 票池见底先拦下来（本地票闸：有票才能投，票池空了先兑换）
   *  2) 身份：localStorage 的 shangya_voter_id（匿名设备标识）；没有就静默生成一个，
   *     不再弹任何输入框、也不再要求登记「班级 + 学号」
   *  3) supabase.rpc('increment_vote', { target_song_id, user_id_str })：数据库才是唯一权威
   *  4) 只有服务端确认成功（success）才扣票池、才把票数 +1，并按返回的 message 弹 Toast；
   *     失败 / 网络异常一律如实提示，绝不假装投票成功。
   *
   *  返回 Promise<boolean>：这一票是否真的投出去了 —— SongCard 只有拿到 true 才飘 +1，
   *  卡片本身的外观 / 结构 / className 一律不变。
   *
   *  @param id          目标歌曲 id
   *  @param successText 可选：成功时改用这句提示（投稿查重命中「自动转投」时用），
   *                     留空则沿用原来的「投票成功！《歌名》+1 票。」；
   *                     票池见底 / 服务端拒绝一律照原样提示，不受它影响。 */
  const handleVote = useCallback(
    async (id, successText = '') => {
      const song = songs.find((s) => String(s.id) === String(id)) ?? null;

      if (extraVotes <= 0) {
        pushToast('投票次数已用完～ 输入 8 位兑换码换票后即可继续加投。', 'warn');
        return false;
      }

      /* 匿名设备标识：读缓存或静默生成，永远有值（不再要求登记班级 / 学号，也不会有取消分支） */
      const voterId = ensureVoterId();

      if (!supabase) {
        pushToast('本站还没接上投票数据库（缺少 Supabase 环境变量），暂时投不了票。', 'warn');
        return false;
      }

      /* 真正的投票：交给数据库存储过程去加票（去重 / 频次 / 上限都在服务端说了算） */
      let result;
      try {
        const { data, error } = await supabase.rpc('increment_vote', {
          target_song_id: id,
          user_id_str: voterId,
        });
        if (error) throw error;
        result = readVoteResult(data);
      } catch (err) {
        pushToast(`投票失败：${readError(err)}`, 'warn');
        return false;
      }

      if (!result.success) {
        pushToast(result.message || '这次投票没有被记下，请稍后再试。', 'warn');
        return false;
      }

      /* 服务端记上了才扣票池（票只有一个来源：兑换码换来的票，投一张减一张） */
      setExtraVotes((v) => v - 1);

      /* 票数 +1 先做本地乐观更新：Realtime 的 UPDATE 随后会带来服务端的准确值，
         两者结果一致（有人同时投票时以服务端为准）。
         注意：只改 song.votes 这一个数字，卡片 className / 结构一律不动 ——
         否则 React 重写 class 属性会把滚动淡入标记冲掉，卡片会凭空消失。 */
      setSongs((prev) =>
        sortByVotes(
          prev.map((s) =>
            String(s.id) === String(id) ? { ...s, votes: s.votes + 1 } : s,
          ),
        ),
      );

      /* 提示优先级：调用方指定的话（投稿自动转投）> 数据库返回的话（如「投票成功」）> 本地兜底。
         成功提示带一行柔和彩蛋：点一下直达「投喂站长」Tab */
      pushToast(
        successText || result.message || `投票成功！《${song?.title ?? 'TA'}》+1 票。`,
        'success',
        {
          label: '请作者喝瓶可乐 🥤',
          onClick: () => openSponsor('sponsor'),
        },
      );
      return true;
    },
    [songs, extraVotes, pushToast, openSponsor],
  );

  /** 投稿：先按「歌名 + 歌手」查重（忽略大小写与首尾空格），再决定落库还是转投票。
   *
   *  ① 榜上已有这首歌 → 绝不重复插新记录，直接把它转化成一票：
   *     走 handleVote 那条既有投票流程（票闸 → ensureVoterId() 取匿名设备标识 →
   *     rpc('increment_vote') → 扣票池 + 本地 +1），成功后单独说一句
   *     「该歌曲已在榜单中，已自动为您向它投出 1 票！🔥」；
   *     票池见底 / 服务端说「今日票数已达上限」时，按 handleVote 原样提示额度用尽。
   *
   *  ② 榜上没有（真新歌）→ 按原计划 INSERT（保留用户输入时的原格式大小写，
   *     票数依旧从 0 起），成功后前插本地榜单并 Toast。
   *
   *  表单只收集「歌名 + 歌手」两项；提交后清空输入框由 <SubmitPanel /> 负责。 */
  const handleSubmitSong = useCallback(
    async (data) => {
      const title = String(data?.title ?? '').trim();
      const artist = String(data?.artist ?? '').trim();

      /* 防空兜底：空串 / 只输空格一律挡在门外（表单侧也拦了一道） */
      if (!title || !artist) {
        pushToast('歌名和歌手都要填上（不能只输空格）才能投稿哦～', 'warn');
        return;
      }

      if (!supabase) {
        pushToast('本站还没接上数据库（缺少 Supabase 环境变量），暂时无法投稿。', 'warn');
        return;
      }

      /* 查重：把榜上现有的歌名 / 歌手取回来，在本地做「忽略大小写 + 首尾空格」的严格比对。
         不走 ILIKE 是为了绕开两个坑：一是 % _ 会被当成通配符，二是 PostgREST 对筛选值里的
         保留字符（, . : ( ) " \）另有要求，乐队名「AC/DC」「Earth, Wind & Fire」照原样比较
         才不会误判。songs 表本来就要全量拉给榜单，这点开销可以忽略。 */
      const norm = (v) => String(v ?? '').trim().toLowerCase();
      let existing;
      try {
        const { data: list, error } = await supabase
          .from('songs')
          .select('id, title, artist, votes_count');
        if (error) throw error;
        existing =
          (list ?? []).find(
            (r) => norm(r.title) === norm(title) && norm(r.artist) === norm(artist),
          ) ?? null;
      } catch (err) {
        /* 查重没能完成就不敢乱插（免得榜上冒出重复歌曲），如实提示用户稍后再试 */
        pushToast(`查重没能完成：${readError(err)}，稍后再试一次吧。`, 'warn');
        return;
      }

      /* ① 榜上已有同一首歌 → 不重复上架，直接转化成对它的 1 票（复用既有投票全流程） */
      if (existing) {
        await handleVote(existing.id, '该歌曲已在榜单中，已自动为您向它投出 1 票！🔥');
        return;
      }

      /* ② 真新歌 → 直接落库（RLS 不允许 insert / 表结构不对时，这里会如实报错） */
      let rows;
      try {
        const { data, error } = await supabase
          .from('songs')
          .insert([{ title, artist, votes_count: 0 }])
          .select('id, title, artist, votes_count');
        if (error) throw error;
        rows = data;
      } catch (err) {
        pushToast(`投稿没能落库：${readError(err)}`, 'warn');
        return;
      }

      /* 回读到新行就立刻上榜（0 票排在票数榜末尾）；若 RLS 不允许回读，本轮先不显示，
         等它被人投票触发 UPDATE 时 Realtime 会自动补进来。 */
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row) {
        setSongs((prev) => sortByVotes([toSong(row), ...prev.filter((s) => s.id !== row.id)]));
      }
      pushToast(`《${title}》已上架打榜区，喊上同学们来投票吧！`);
    },
    [handleVote, pushToast],
  );

  /** 兑换投票次数：8 位兑换码 → +5 票，一码一次
   *  核销走 Supabase 的 redemption_codes 表（数据库才是唯一权威）：
   *    ⓪ cleanCode：全角转半角 → 去掉空格 / 换行 / 制表符 → 转大写 → 校验 8 位
   *    ① 单次原子 UPDATE：.eq('code', cleanCode).eq('used', false)
   *       绝不链式 .select()；用 count: 'exact' 读取受影响行数
   *    ② error 为 null 且 count === 1（或服务端未返回 count）→ 才本地 +5 票
   *    ③ count === 0 → 已被使用 / 权限静默过滤，提示用户但不加票
   *  返回 { ok, reason, message? } 交给 <RedeemPanel />：
   *    reason = 'invalid' 无效 / 'used' 已使用 / 'permission' 权限受限
   *           / 'network' 网络异常 / 'error' 其它异常 */
  const handleRedeem = useCallback(
    async (inputCode) => {
      const cleanCode = cleanRedemptionCode(inputCode);

      if (
        cleanCode.length !== VOTE_CODE_LENGTH ||
        !/^[0-9A-Z]+$/.test(cleanCode)
      ) {
        return {
          ok: false,
          reason: 'invalid',
          message: `请输入完整的 ${VOTE_CODE_LENGTH} 位卡券码`,
        };
      }

      if (!supabase) {
        pushToast('兑换服务暂不可用，请稍后再试', 'warn');
        return {
          ok: false,
          reason: 'error',
          message: '兑换服务暂不可用，请稍后重试',
        };
      }

      try {
        /* 只执行一次 UPDATE，不先 SELECT、也不链式 .select()。
           count: 'exact' 只返回受影响行数，不返回行数据。
           used = false 是原子闸门：两台手机同时提交时只有一台能改到 1 行。 */
        const { error, count } = await supabase
          .from('redemption_codes')
          .update({ used: true }, { count: 'exact' })
          .eq('code', cleanCode)
          .eq('used', false);

        if (error) {
          console.error('兑换报错详情:', error);
          const info = describeRedeemError(error, 'update');
          pushToast(`兑换失败：${info.message}`, 'warn');
          return { ok: false, ...info };
        }

        /* count 为 0：卡券不存在 / 已被使用 / RLS 静默过滤（都不加票） */
        if (typeof count === 'number' && count !== 1) {
          console.warn('[Redeem] 更新受影响行数异常:', { cleanCode, count });
          if (count === 0) {
            return {
              ok: false,
              reason: 'used',
              message: '该卡券已被使用或核销受限；若确认未使用，请联系管理员',
            };
          }
          return {
            ok: false,
            reason: 'error',
            message: '核销异常：卡券匹配异常，请联系管理员',
          };
        }

        /* error 为 null（且 count 正常）→ 数据库已确认核销，才给本地加票 */
        setExtraVotes((v) => v + VOTES_PER_CODE);
        pushToast(`🎟️ 兑换成功！投票次数 +${VOTES_PER_CODE}，可以给喜欢的歌继续加投啦`);
        return { ok: true, added: VOTES_PER_CODE };
      } catch (err) {
        /* 按要求打印真实报错对象（message / code / details 都在里面） */
        console.error('兑换报错详情:', err);
        const info = describeRedeemError(err, 'update');
        pushToast(`兑换失败：${info.message}`, 'warn');
        return { ok: false, ...info };
      }
    },
    [pushToast],
  );

  /** 兑换浮层开关（关闭即卸载组件 → 下次打开又是全新状态） */
  const openRedeem = useCallback(() => setRedeemOpen(true), []);
  const closeRedeem = useCallback(() => setRedeemOpen(false), []);

  /** 作者的话信笺开关（同样：关闭即卸载） */
  const openAuthor = useCallback(() => setAuthorOpen(true), []);
  const closeAuthor = useCallback(() => setAuthorOpen(false), []);

  /* 支持与反馈弹窗的开关已提前到状态区定义（投票成功 Toast 也要用） */

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        color: 'var(--text-main)',
      }}
    >
      {/* 1. 底层：Grainient 暖白颗粒渐变背景（全局固定，替代纯黑底） */}
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
        {/* 底色三色：象牙白 → 燕麦灰 → 暖粉余晖（对应 index.css 的 --cream-* 令牌） */}
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

      {/* 1.5 环境层：点阵网格 + 弥散光晕（Hero 与榜单后方各一团，随滚动呼吸） */}
      <div className="bg-decor" aria-hidden="true">
        <span className="bg-decor__grid" />
        <span className="bg-decor__glow bg-decor__glow--coral" />
        <span className="bg-decor__glow bg-decor__glow--blue" />
        <span className="bg-decor__glow bg-decor__glow--gold" />
      </div>

      {/* 2. 上层：交互与内容层 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar onOpenSponsor={openSponsor} />

        <main>
          {/* 首屏：氛围主视觉 + 兑换投票次数（浮层卡片）/ 立即进入投票区 / 逛专辑封面墙 / 作者的话 */}
          <Hero
            extraVotes={extraVotes}
            onOpenRedeem={openRedeem}
            onOpenAuthor={openAuthor}
          />

          {/* 专辑封面墙：反转卡片（正面专辑名 / 背面封面）—— 原先吸顶滚动主视觉的位置 */}
          <AlbumCovers />

          {/* 提交我的音乐（卡片右上角挂剩余票数仪表：全部来自兑换码）
              —— 与投票区对调：先投递作品，再进榜单打榜 */}
          <SubmitPanel
            onSubmit={handleSubmitSong}
            votesLeft={votesLeft}
            onOpenRedeem={openRedeem}
          />

          {/* 投票区：搜索 + 排序 + 精简卡片列表（歌名 / 歌手 / 票数）
              数据来自 Supabase：loading / error 两种状态也一并交给它渲染 */}
          <VotingSection
            visible={visible}
            rankById={rankById}
            query={query}
            onQueryChange={setQuery}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onVote={handleVote}
            votesLeft={votesLeft}
            loading={songsLoading}
            refreshing={songsRefreshing}
            error={songsError}
            onReload={reloadSongs}
          />
        </main>

        {/* 版权 + 加油标语 + 「☕ 支持与反馈」常驻入口 */}
        <Footer onOpenSponsor={openSponsor} />
      </div>

      {/* 全局轻提示 */}
      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* 兑换投票次数：首屏按钮 / 提交卡片仪表都能唤起（只在打开时挂载，关闭即卸载） */}
      {redeemOpen && <RedeemPanel onClose={closeRedeem} onRedeem={handleRedeem} />}

      {/* 作者的话：首屏「✍️ 作者的话」唤起（信笺浮层，同样只在打开时挂载） */}
      {authorOpen && <AuthorNote onClose={closeAuthor} />}

      {/* 支持与反馈 / 投喂站长：加载结束后自动展示一次；关闭后仍可从
          页脚「☕ 支持与反馈」/ 导航菜单 / 投票成功 Toast 再次打开 */}
      {sponsorOpen && (
        <SponsorModal
          key={sponsorTab}
          initialTab={sponsorTab}
          onClose={closeSponsor}
        />
      )}

      {/* 首屏加载界面：纯白底 + 克莱因蓝的折纸文字 loading（1.5 秒假判定 → 淡出 → 卸载）
          层级 200：高过 Toast(120) 与兑换浮层(130)，加载期间谁也盖不过它 */}
      {booting && <LoadingScreen onDone={finishBoot} />}
    </div>
  );
}

export default App;
