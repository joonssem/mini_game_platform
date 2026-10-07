import { useMutation, useQuery } from 'convex/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { composeComic } from '../canvas/composeComic'

// 교사 페이지 (/teacher): 최근 24시간 안에 끝난 게임의 만화를 이미지로 저장한다.
// 로그인 토큰은 이 탭에서만 유지한다 (sessionStorage).

const TOKEN_KEY = 'mgp.teacherToken'

function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

function saveToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // 저장하지 못하면 이번 화면에서만 로그인이 유지된다.
  }
}

export default function Teacher() {
  const [token, setToken] = useState(loadToken)
  const logout = useMutation(api.teacher.logout)

  function changeToken(next: string) {
    saveToken(next)
    setToken(next)
  }

  if (!token) return <Login onLogin={changeToken} />
  return (
    <GameList
      token={token}
      onExpired={() => changeToken('')}
      onLogout={() => {
        logout({ token }).catch(() => {})
        changeToken('')
      }}
    />
  )
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const login = useMutation(api.teacher.login)
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!passcode || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await login({ passcode })
      if (result.ok) onLogin(result.token)
      else setError(result.message)
    } catch {
      setError('연결에 문제가 있어요. 잠시 뒤 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen center">
      <h1 className="title">교사 페이지</h1>
      <p className="muted">최근 24시간 안에 끝난 만화를 저장할 수 있어요</p>
      <form className="stack wide" onSubmit={submit}>
        <label className="field">
          <span>교사 비밀번호</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary big" type="submit" disabled={!passcode || busy}>
          {busy ? '확인하는 중…' : '들어가기'}
        </button>
      </form>
    </main>
  )
}

function GameList({ token, onExpired, onLogout }: { token: string; onExpired: () => void; onLogout: () => void }) {
  const games = useQuery(api.teacher.games, { token })
  const [selected, setSelected] = useState<Id<'games'> | null>(null)

  // 토큰이 만료되었거나 잘못되면 다시 로그인 화면으로
  useEffect(() => {
    if (games === null) onExpired()
  }, [games, onExpired])
  if (games === null) return null

  return (
    <main className="screen teacher">
      <header className="teacher-header">
        <h1 className="title">끝난 만화</h1>
        <button className="btn ghost small" onClick={onLogout}>
          로그아웃
        </button>
      </header>
      <p className="muted">최근 24시간 안에 끝난 게임이에요. 24시간이 지나면 자동으로 지워져요.</p>

      {games === undefined && <p className="muted">불러오는 중…</p>}
      {games?.length === 0 && <p className="muted">아직 끝난 게임이 없어요.</p>}

      <ul className="teacher-games">
        {games?.map((g) => (
          <li key={g.id}>
            <button className={`teacher-game${selected === g.id ? ' selected' : ''}`} onClick={() => setSelected(g.id)}>
              <span className="muted">
                {new Date(g.startedAt).toLocaleString('ko-KR', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <strong>{g.topic}</strong>
              <span className="muted">{[...new Set(g.turns.map((t) => t.number))].join(' · ')}번</span>
            </button>
          </li>
        ))}
      </ul>

      {selected && <ComicImage key={selected} token={token} gameId={selected} />}
    </main>
  )
}

function ComicImage({ token, gameId }: { token: string; gameId: Id<'games'> }) {
  const comic = useQuery(api.teacher.comic, { token, gameId })
  const image = useMemo(
    () => (comic ? composeComic(comic.topic, comic.panels, new Date(comic.startedAt)) : null),
    [comic],
  )

  if (comic === undefined) return <p className="muted">만화를 그리는 중…</p>
  if (!comic || !image) return <p className="error">만화를 찾을 수 없어요.</p>

  const stamp = new Date(comic.startedAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const fileName = `이어그리기-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.png`

  return (
    <section className="teacher-comic">
      <p className="muted">iPad: 이미지를 길게 눌러 "사진에 저장" · PC: 아래 버튼</p>
      <img src={image} alt={`만화: ${comic.topic}`} />
      <a className="btn primary" href={image} download={fileName}>
        이미지 내려받기
      </a>
    </section>
  )
}
