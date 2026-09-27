/**
 * Toast —— 轻量消息通知（右上角 / 底部堆叠，自动消失）
 *
 * props:
 *  toasts: [{ id: string|number, text: string, tone?: 'success'|'info'|'warn' }]
 *  onDismiss?: (id) => void   （可选，点击关闭）
 */
function Toast({ toasts = [], onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div
      className="toast-stack"
      role="status"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <div
          className={`toast toast--${t.tone ?? 'success'}`}
          key={t.id}
          onClick={() => onDismiss?.(t.id)}
          role={t.tone === 'warn' ? 'alert' : undefined}
        >
          <span className="toast__icon" aria-hidden="true">
            {t.tone === 'warn' ? '⚠️' : t.tone === 'info' ? '💡' : '✅'}
          </span>
          <p className="toast__text">{t.text}</p>
          <button
            type="button"
            className="toast__close"
            aria-label="关闭提示"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss?.(t.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default Toast;
