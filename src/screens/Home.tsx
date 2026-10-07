import { useMutation } from 'convex/react'
import { useState, type FormEvent } from 'react'
import { api } from '../../convex/_generated/api'
import { MAX_NUMBER, MIN_NUMBER } from '../../convex/constants'
import { errorMessage } from '../session'

const NUMBER_KEY = 'mgp.number'

function savedNumber() {
  try {
    return localStorage.getItem(NUMBER_KEY) ?? ''
  } catch {
    return ''
  }
}

function digitsOnly(value: string, max: number) {
  return value.replace(/\D/g, '').slice(0, max)
}

export default function Home({ sessionId }: { sessionId: string }) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu')
  const [code, setCode] = useState('')
  const [number, setNumber] = useState(savedNumber)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const create = useMutation(api.rooms.create)
  const join = useMutation(api.rooms.join)

  const numberValue = Number(number)
  const numberOk = Number.isInteger(numberValue) && numberValue >= MIN_NUMBER && numberValue <= MAX_NUMBER
  const canSubmit = numberOk && (mode === 'create' || code.length === 4) && !busy

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'create') await create({ sessionId, number: numberValue })
      else await join({ sessionId, code, number: numberValue })
      try {
        localStorage.setItem(NUMBER_KEY, number)
      } catch {
        // 저장하지 못해도 입장에는 문제없다.
      }
      // 성공하면 서버의 방 정보가 바뀌면서 App이 대기실 화면으로 넘어간다.
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (mode === 'menu') {
    return (
      <main className="screen center">
        <h1 className="title">이어 그리기</h1>
        <p className="muted">친구와 만화 한 편을 한 칸씩 이어 그려요</p>
        <div className="stack wide">
          <button className="btn primary big" onClick={() => setMode('create')}>
            방 만들기
          </button>
          <button className="btn big" onClick={() => setMode('join')}>
            방 들어가기
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="screen center">
      <h1 className="title">{mode === 'create' ? '방 만들기' : '방 들어가기'}</h1>
      <form className="stack wide" onSubmit={submit}>
        {mode === 'join' && (
          <label className="field">
            <span>방 코드</span>
            <input
              className="input code"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0000"
              value={code}
              onChange={(e) => setCode(digitsOnly(e.target.value, 4))}
              autoFocus
            />
          </label>
        )}
        <label className="field">
          <span>내 번호</span>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`${MIN_NUMBER}~${MAX_NUMBER}`}
            value={number}
            onChange={(e) => setNumber(digitsOnly(e.target.value, 2))}
            autoFocus={mode === 'create'}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary big" type="submit" disabled={!canSubmit}>
          {busy ? '잠깐만요…' : mode === 'create' ? '만들기' : '들어가기'}
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            setMode('menu')
            setError('')
          }}
        >
          뒤로
        </button>
      </form>
    </main>
  )
}
