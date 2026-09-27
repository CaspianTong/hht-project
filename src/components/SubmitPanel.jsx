import { useState } from 'react';
import HoldButton from './bottom2';

/** 长按判定时长（毫秒）：与榜单卡片上的「投 TA 一票」同款 ——
 *  按住 2 秒、白浪漫满整条按钮再松手才真的提交，轻点不误交 */
const SUBMIT_HOLD_MS = 2000;

/* 投稿表单只收集「歌曲名称 + 歌手」两项歌曲信息。
 * 班级/社团、歌曲分类（<JellyRadio />）、试听链接、一句话推荐，
 * 以及原「投稿凭证码 *」整块（React Bits <CodeSlots /> 6 位校验 + 演示码提示 + 状态文案）
 * 均已按需求移除；榜单卡片同样只展示歌名 / 歌手 / 票数，两项填完即可上架打榜。 */
const EMPTY_FORM = {
  title: '',
  artist: '',
};

/**
 * SubmitPanel —— 「提交我的音乐」投稿区
 *  · 主体：纯表单（歌名 + 歌手 + 提交）
 *  · 提交按钮：复用榜单卡片那枚长按判定按钮（components/bottom2 的 HoldButton）——
 *    按住 2 秒、高级蓝底上漫过一道白浪，浪峰漫满整条按钮并松手才真的提交；
 *    轻点只回弹、不提交（与「投 TA 一票」完全同一套特效，本站皮肤见 .submit-hold）
 *  · 右上角：剩余票数仪表 .submit__votes —— 免费票 + 兑换票的实时合计，
 *    每投出一票减 1、兑换成功 +5，归零时按钮变成「去兑换」
 * props:
 *  onSubmit(data)   data = { title, artist }
 *  votesLeft        还能投出的总票数（免费票 + 兑换票）
 *  freeVotesLeft    还能用的免费票（免费票总数 = 参选曲目数，投一票扣一张）
 *  extraVotes       已兑换、还没花掉的票数
 *  onOpenRedeem()   点仪表里的兑换按钮 → 打开「兑换投票次数」浮层
 */
function SubmitPanel({
  onSubmit,
  votesLeft = 0,
  freeVotesLeft = 0,
  extraVotes = 0,
  onOpenRedeem,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const setField = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  /** 校验 → 交给上层提交 → 清空表单：由「长按 2 秒」判定通过后调用。
   *  先 trim 再判空，只输空格一律拦下（上层还会再兜一道底） */
  const submitForm = () => {
    if (!form.title.trim()) {
      setError('请至少填写歌曲名称，让大家知道你在推哪首歌～');
      return;
    }
    if (!form.artist.trim()) {
      setError('记得写上歌手 / 乐队名哦～');
      return;
    }
    setError('');
    onSubmit({ ...form });
    setForm(EMPTY_FORM);
  };

  /* 表单本身不再挂原生提交按钮（HoldButton 内部固定 type="button"），
     Enter 的隐式提交在「两个输入框 + 没有提交按钮」的表单里浏览器不会触发；
     这里保留 preventDefault 只是兜底：万一被程序化 submit 也不会整页刷新。 */
  const handleSubmit = (e) => {
    e.preventDefault();
    submitForm();
  };

  return (
    <section className="section submit" id="submit">
      <div className="section__head">
        <p className="section__eyebrow">🎙️ OPEN CALL · 全校征集</p>
        <h2 className="section__title">提交我的音乐</h2>
        <p className="section__sub">为你所在的班级、社团投递一首真正的“班级战歌”。</p>
      </div>

      {/* 卡片里只留投稿表单：原左侧介绍栏（图标 / 标题 / 文案 / 4 条 ✅ 提示）
           与「投稿凭证码 *」整块（含 6 位验证码输入、演示码提示、校验状态文案）
           均已按需求移除，卡片改为单列、只需歌名 + 歌手两项；
           右上角新增「剩余票数」仪表（桌面端悬浮在角落，窄屏自动降级成表单上方的横排信息条） */}
      <div className="submit__card">
        <div className={`submit__votes${votesLeft === 0 ? ' is-empty' : ''}`}>
          <p className="submit__votes-label">
            <span aria-hidden="true">🎫</span> 剩余票数
          </p>
          <p className="submit__votes-num">
            <strong aria-live="polite">{votesLeft}</strong>
            <span>票</span>
          </p>
          <p className="submit__votes-meta">
            免费票 {freeVotesLeft} · 兑换票 {extraVotes}
          </p>
          <button
            type="button"
            className="btn btn--gold submit__votes-btn"
            onClick={onOpenRedeem}
          >
            🎟️ {votesLeft === 0 ? '去兑换' : '兑换更多'}
          </button>
        </div>

        <form className="submit__form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <label className="field">
              <span>歌曲名称 *</span>
              <input
                type="text"
                value={form.title}
                onChange={setField('title')}
                maxLength={30}
              />
            </label>
            <label className="field">
              <span>歌手 / 乐队 *</span>
              <input
                type="text"
                value={form.artist}
                onChange={setField('artist')}
                maxLength={30}
              />
            </label>
          </div>

          {error && <p className="form__error">⚠️ {error}</p>}

          {/* 提交按钮 = 榜单「投 TA 一票」同款长按判定（components/bottom2 的 HoldButton）：
              按住 2 秒，高级蓝底上漫过一道白浪，浪峰漫满整条按钮并松手才真的提交；
              轻点只回弹、不提交。组件内部固定 type="button"（不会误触表单原生提交），
              颜色 / 圆角一律走 props 注入，本站皮肤见 App.css 的 .hold-button.submit-hold */}
          <HoldButton
            className="submit-hold"
            size="lg"
            radius={999}
            holdTime={SUBMIT_HOLD_MS}
            backgroundColor="var(--accent-primary)"
            fillColor="#ffffff"
            textColor="var(--text-on-accent)"
            fillTextColor="var(--text-main)"
            doneLabel="已提交"
            onHold={submitForm}
          >
            提交并上架
          </HoldButton>
        </form>
      </div>
    </section>
  );
}

export default SubmitPanel;
