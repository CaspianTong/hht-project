import { useEffect, useRef } from 'react';

export default function Grainient({
  /* 默认值 = 主题「暖杏燕麦白 → 象牙灰 → 暖粉余晖」，对应 index.css 的 --cream-* 令牌 */
  color1 = '#fbf9f6',
  color2 = '#f3efea',
  color3 = '#f6ece6',
  timeSpeed = 0.5,
  grainAmount = 0.05,
  grainScale = 2,
  contrast = 1.06,
  saturation = 1.05,
  zoom = 0.9,
  className = '',
  style = {}
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;

    const hexToRgb = (hex) => {
      const parsed = hex.replace('#', '');
      const bigint = parseInt(parsed.length === 3 ? parsed.split('').map(c => c + c).join('') : parsed, 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const c3 = hexToRgb(color3);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      time += 0.01 * timeSpeed;
      const { width, height } = canvas;
      if (width === 0 || height === 0) return;

      const grad = ctx.createLinearGradient(0, 0, width * zoom, height * zoom);
      const shift = Math.sin(time * 0.5) * 0.2;
      grad.addColorStop(0, `rgb(${c1[0]}, ${c1[1]}, ${c1[2]})`);
      grad.addColorStop(Math.min(1, Math.max(0, 0.5 + shift)), `rgb(${c2[0]}, ${c2[1]}, ${c2[2]})`);
      grad.addColorStop(1, `rgb(${c3[0]}, ${c3[1]}, ${c3[2]})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (grainAmount > 0) {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const noiseFactor = grainAmount * 255;
        const step = Math.max(1, Math.floor(grainScale));
        for (let i = 0; i < data.length; i += 4 * step) {
          const noise = (Math.random() - 0.5) * noiseFactor;
          data[i] = Math.min(255, Math.max(0, data[i] + noise));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color1, color2, color3, timeSpeed, grainAmount, grainScale, zoom]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        filter: `contrast(${contrast}) saturate(${saturation})`,
        ...style
      }}
    />
  );
}
