import { useState } from 'react';
import Navbar from './components/Navbar';
import SongCard from './components/SongCard';
import Grainient from './components/Grainient';
import './App.css';

const INITIAL_SONGS = [
  {
    id: 1,
    title: "Victory",
    artist: "Two Steps From Hell",
    category: "燃向热血",
    votes: 342,
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80"
  },
  {
    id: 2,
    title: "The Spectre",
    artist: "Alan Walker",
    category: "赛道电音",
    votes: 289,
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80"
  },
  {
    id: 3,
    title: "追梦赤子心",
    artist: "GALA",
    category: "燃向热血",
    votes: 256,
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80"
  },
  {
    id: 4,
    title: "Hall of Fame",
    artist: "The Script / will.i.am",
    category: "流行精选",
    votes: 215,
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&q=80"
  },
  {
    id: 5,
    title: "Señorita",
    artist: "Shawn Mendes / Camila Cabello",
    category: "流行精选",
    votes: 178,
    cover: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=500&q=80"
  },
  {
    id: 6,
    title: "Fade",
    artist: "Alan Walker",
    category: "赛道电音",
    votes: 194,
    cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80"
  }
];

function App() {
  const [songs, setSongs] = useState(INITIAL_SONGS);
  const [activeTab, setActiveTab] = useState('全部');
  const [votedIds, setVotedIds] = useState([]);

  const handleVote = (id) => {
    if (votedIds.includes(id)) return;
    setSongs(prev => prev.map(s => s.id === id ? { ...s, votes: s.votes + 1 } : s));
    setVotedIds(prev => [...prev, id]);
  };

  const filteredSongs = activeTab === '全部' 
    ? songs 
    : songs.filter(s => s.category === activeTab);

  const totalVotes = songs.reduce((sum, s) => sum + s.votes, 0);

  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '100vh', color: '#f8fafc' }}>
      
      {/* 1. 底层：Grainient 颗粒渐变背景（全局固定） */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.85
        }}
      >
        <Grainient
          color1="#0f172a"
          color2="#1e1b4b"
          color3="#2e1065"
          timeSpeed={0.3}
          warpStrength={1}
          warpFrequency={5}
          warpSpeed={2.0}
          warpAmplitude={50}
          grainAmount={0.06}
          grainScale={2}
          contrast={1.4}
          saturation={1.2}
          zoom={0.9}
        />
      </div>

      {/* 2. 上层：交互与内容层 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <Navbar />

        {/* Hero 主题区 */}
        <div style={{ textAlign: 'center', padding: '120px 20px 40px 20px', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '20px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', marginBottom: '18px', color: '#cbd5e1' }}>
            🏟️ SCHOOL GAMES 2026 • 音乐征集投票平台
          </div>

          <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: '900', margin: '0 0 16px 0', background: 'linear-gradient(135deg, #ffedd5, #f43f5e, #fb7185)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1.15 }}>
            运动会燃音盛典
          </h1>
          <p style={{ fontSize: '1.2rem', color: '#cbd5e1', margin: '0 0 24px 0', fontWeight: 500 }}>
            为赛场热血，投出属于你的 BGM 🎵
          </p>
          <p style={{ fontSize: '0.95rem', color: '#94a3b8', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 36px' }}>
            这是属于操场与看台的战歌！为你冲线前的最后一秒，选出一首能让全场沸腾的助威声浪。
          </p>

          {/* 数据徽章 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '40px' }}>
            <span style={{ padding: '8px 20px', borderRadius: '30px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem' }}>
              🎵 {songs.length} 首入选战歌
            </span>
            <span style={{ padding: '8px 20px', borderRadius: '30px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem' }}>
              🔥 {totalVotes} 次已投出
            </span>
            <span style={{ padding: '8px 20px', borderRadius: '30px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.9rem' }}>
              🏆 榜首将在开幕式领衔播送
            </span>
          </div>
        </div>

        {/* 4. 音乐投票卡片网格列表 */}
        <div id="vote-section" style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 24px 100px' }}>
          
          {/* 分类过滤器 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '40px', flexWrap: 'wrap' }}>
            {['全部', '燃向热血', '赛道电音', '流行精选'].map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                style={{
                  padding: '8px 22px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: activeTab === cat ? '#f43f5e' : 'rgba(255,255,255,0.1)',
                  background: activeTab === cat ? '#f43f5e' : 'rgba(15, 23, 42, 0.6)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 卡片栅格 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {filteredSongs.map(song => (
              <SongCard 
                key={song.id} 
                song={song} 
                hasVoted={votedIds.includes(song.id)}
                onVote={() => handleVote(song.id)} 
              />
            ))}
          </div>

        </div>

        {/* 底部版权 */}
        <footer style={{ textAlign: 'center', padding: '40px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', color: '#64748b', fontSize: '0.9rem' }}>
          © 2026 校运会燃音盛典组委会 · 用音乐见证每一个冲线瞬间
        </footer>

      </div>
    </div>
  );
}

export default App;