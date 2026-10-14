import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ title, children, confirmLabel, busy, onConfirm, onCancel }) {
  const ref = useRef(null)
  useEffect(() => {
    const dlg = ref.current
    if (dlg && !dlg.open) dlg.showModal()
  }, [])
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel() }} aria-labelledby="dlg-title">
      <h2 id="dlg-title">{title}</h2>
      <div>{children}</div>
      <div className="form-actions">
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
        <button type="button" className="btn btn--outline" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </dialog>
  )
}
