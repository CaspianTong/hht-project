/* =====================================================================
 * 专辑封面清单（公开展示用）
 *
 * 图片位置：public/专辑封面压缩版/*.webp
 *   → public 目录下的文件按「根路径」直接引用，所以 src 写 /专辑封面压缩版/xxx.webp
 *   （中文 / 空格 / 《》 等字符由浏览器自动编码，无需手写 %XX）
 *
 * 卡片正面的标题 = 文件名去掉 .webp 后缀（例：叶惠美.webp → 叶惠美）。
 * 想在页面上显示别的名字，改下面这张表里的文件名即可（或直接改 title）。
 * 新增 / 删除封面：把文件名加进 / 移出 COVER_FILES，顺序即页面上卡片的顺序。
 * ===================================================================== */

/** 封面所在目录（public 下的文件夹名，前面带 /） */
export const ALBUM_COVER_DIR = '/专辑封面压缩版';

/** 封面文件名（顺序 = 页面顺序） */
const COVER_FILES = [
  '11月的肖邦.webp',
  '1989.webp',
  '24K Magic.webp',
  'ARIRANG.webp',
  'bangbang.webp',
  'BOOTLEG.webp',
  'Born This Way.webp',
  'DEADLINE - EP.webp',
  'Fearless.webp',
  'Happier Than Ever.webp',
  'HIT ME HARD AND SOFT.webp',
  'How Sweet - EP.webp',
  "I'm O.K..webp",
  'KILL THIS LOVE - EP.webp',
  'LENMONADE.webp',
  "Love Yourself 结 'Answer'.webp",
  'Lover.webp',
  'My World 2.0.webp',
  'My World.webp',
  'Positions.webp',
  'REVIVE+.webp',
  'Starboy.webp',
  'STAY.webp',
  'STRAY SHEEP.webp',
  'SYNK：COMPLAeXITY.webp',
  'The Fame Monster.webp',
  'The Fame.webp',
  '《Get Up》.webp',
  '《New Jeans》.webp',
  '叶惠美.webp',
  '启示录.webp',
  '周杰伦Jay.webp',
  '周杰伦范特西.webp',
  '唯一.webp',
  '我要的幸福.webp',
  '新地球.webp',
  '爱的心跳.webp',
  '第二天堂.webp',
  '认了吧.webp',
  '逆光.webp',
  '화양연화.webp',
];

/**
 * 专辑封面卡片数据
 * @typedef {Object} AlbumCover
 * @property {number} id    序号（正面左上角的编号 + React key）
 * @property {string} title 专辑名（正面文案）
 * @property {string} src   封面图地址（背面）
 */
export const ALBUM_COVERS = COVER_FILES.map((file, index) => ({
  id: index + 1,
  title: file.replace(/\.webp$/i, ''),
  src: `${ALBUM_COVER_DIR}/${file}`,
}));
