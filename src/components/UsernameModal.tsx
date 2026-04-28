import { useState, useRef, useEffect } from 'react'

interface Props {
  onConfirm: (name: string) => void
}

const VALID = /^[a-zA-Z0-9_\-. ]+$/

export function UsernameModal({ onConfirm }: Props) {
  const [value, setValue] = useState('')
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit() {
    const name = value.trim()
    if (!name) { setErr('name cannot be empty'); return }
    if (name.length > 20) { setErr('max 20 characters'); return }
    if (!VALID.test(name)) { setErr('letters, numbers, _ - . and spaces only'); return }
    onConfirm(name)
  }

  return (
    <div className="overlay">
      <div className="modal col gap-24" style={{ margin: '0 16px' }}>
        <div className="col gap-8">
          <h2 style={{ fontSize: 20, letterSpacing: 2, color: 'var(--accent)' }}>
            gm anon.
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            what do we call you?
          </p>
        </div>

        <div className="col gap-8">
          <label style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
            enter your name (one time only)
          </label>
          <input
            ref={inputRef}
            className="input"
            placeholder="floor_truther"
            value={value}
            maxLength={20}
            onChange={e => { setValue(e.target.value); setErr('') }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {err
              ? <span style={{ color: 'var(--red)', fontSize: 11 }}>{err}</span>
              : <span />
            }
            <span style={{ color: 'var(--muted)', fontSize: 11 }}>{value.length}/20</span>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleSubmit}>
          let's go
        </button>
      </div>
    </div>
  )
}
