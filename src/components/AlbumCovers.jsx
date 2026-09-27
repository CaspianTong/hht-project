import FlipCard from './music-card';
import { ALBUM_COVERS } from '../data/albumCovers';

/**
 * AlbumCovers —— 专辑封面墙（原先吸顶滚动主视觉所在的位置）
 *
 * 特效：直接复用 ./music-card.jsx + ./music-card.css 这枚反转卡片
 *      （3D 翻转 / 悬停倾斜 / 反光 / 按住拖动翻面，点击或空格也能翻）
 *
 * 手机端（App.css ≤640px）：卡片墙变成「单行水平横滑」，横向滑动交给浏览器滚卡片墙
 *      （卡片自身 touch-action 由 pan-y 改成双向），翻面改由轻点触发 ——
 *      不然卡片会把水平滑动吃掉，横滑条永远滑不动。桌面端行为完全不变。
 *
 * 正面：专辑名（衬线展示字 --font-display，高级一点的排版）
 * 背面：专辑封面（正方形卡片，object-fit: cover 裁切铺满）
 *
 * 卡片尺寸交给 App.css 的 .albums__grid / .albums .flip-card 控制：
 * 栅格宽度决定卡片宽度，aspect-ratio: 1 / 1 保证是正方形。
 */
function AlbumCovers() {
  return (
    <section className="section albums" id="albums">
      <div className="section__head">
        <p className="section__eyebrow">🎧 ALBUM WALL · 参赛曲库</p>
        <h2 className="section__title">翻转卡片 · 专辑封面墙</h2>
        <p className="section__sub">
          正面是专辑名，翻过来就是封面 —— 点一下就能翻（桌面端还可以按住拖动、或按空格键）。
        </p>
      </div>

      <div className="albums__grid">
        {ALBUM_COVERS.map((album) => (
          <FlipCard
            key={album.id}
            className="album-card"
            ariaLabel={`${album.title} · 翻转查看专辑封面`}
            width={260}
            height={260}
            radius={20}
            background="linear-gradient(160deg, #ffffff 0%, #f3efea 100%)"
            color="var(--text-main)"
            shadowColor="#3a2e24"
            shadowOpacity={0.3}
            tiltMax={10}
            glareOpacity={0.18}
            front={
              <div className="album-card__front">
                <span className="album-card__index" aria-hidden="true">
                  {String(album.id).padStart(2, '0')}
                </span>
                <h3 className="album-card__title">{album.title}</h3>
                <span className="album-card__rule" aria-hidden="true" />
                <span className="album-card__hint">Flip · 翻开看封面</span>
              </div>
            }
            back={
              <figure className="album-card__back">
                <img src={album.src} alt={`${album.title} 专辑封面`} loading="lazy" />
              </figure>
            }
          />
        ))}
      </div>
    </section>
  );
}

export default AlbumCovers;
