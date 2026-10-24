/**
 * Footer —— 版权信息 + 「☕ 支持与反馈」常驻轻量入口
 *
 * props:
 *  onOpenSponsor() 打开支持与反馈弹窗（交流二维码 / 投喂赞赏码）
 */
function Footer({ onOpenSponsor }) {
  return (
    <footer className="footer">
      <div className="footer__bar">
        <p>© 2026 运动会燃音盛典 · 校运会音乐征集投票平台 · 为热爱打榜 🔥</p>
        <p>纯 React + 原生 CSS 构建 · Demo 数据仅供前端演示</p>
        <button
          type="button"
          className="footer__support"
          onClick={() => onOpenSponsor?.()}
        >
          ☕ 支持与反馈
        </button>
      </div>
    </footer>
  );
}

export default Footer;
