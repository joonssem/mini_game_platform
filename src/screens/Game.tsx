import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../convex/_generated/api'
import { ERASER_COLOR, ERASER_WIDTH, NEXT_UP_WARNING_MS, PEN_COLORS, PEN_WIDTHS } from '../../convex/constants'
import DrawingCanvas from '../canvas/DrawingCanvas'
import FitArea from '../canvas/FitArea'
import { comicColumns } from '../canvas/composeComic'
import type { Stroke } from '../canvas/draw'
import { errorMessage } from '../session'
import { useNow } from '../useNow'
import type { Game as GameData, Room } from './types'

/** 불러오는 중에도 같은 배열을 넘겨서 그림판이 쓸데없이 다시 그리지 않게 한다. */
const NO_STROKES: Stroke[] = []

export default function Game({ sessionId, room }: { sessionId: string; room: Room }) {
  const game = useQuery(api.games.myGame, { sessionId })
  const leave = useMutation(api.rooms.leave)
  const now = useNow()

  if (game === undefined) {
    return (
      <main className="screen center">
        <p className="muted">게임을 불러오는 중…</p>
      </main>
    )
  }
  if (game === null) {
    // 방은 게임 중인데 게임 정보가 없을 때 (예: 예전 버전에서 시작한 방). 빠져나갈 길을 준다.
    return (
      <main className="screen center">
        <Done sessionId={sessionId} isHost={room.isHost} message="게임 정보를 찾을 수 없어요." />
      </main>
    )
  }

  const remainingMs = Math.max(0, game.phaseEndsAt - now)

  return (
    <main className="screen game">
      <header className="game-header">
        <span className="muted">주제</span>
        <strong>{game.topic}</strong>
        <button className="btn ghost small" onClick={() => leave({ sessionId })}>
          나가기
        </button>
      </header>

      {game.phase === 'intro' && <Intro sessionId={sessionId} game={game} remainingMs={remainingMs} />}
      {game.phase === 'drawing' && <Turn sessionId={sessionId} game={game} remainingMs={remainingMs} />}
      {game.phase === 'done' && <Reveal key={game.id} sessionId={sessionId} game={game} isHost={room.isHost} />}

      {game.phase !== 'done' && <TurnStrip game={game} />}

      {/* 게임은 가로 화면 전용. 세로로 들면 CSS가 이 안내를 덮어씌운다. */}
      <div className="rotate-hint" aria-hidden>
        <span className="rotate-icon">↻</span>
        <p>iPad를 가로로 돌려 주세요</p>
      </div>
    </main>
  )
}

function Intro({ sessionId, game, remainingMs }: { sessionId: string; game: GameData; remainingMs: number }) {
  const reroll = useMutation(api.games.reroll)
  return (
    <section className="game-main center">
      <p className="muted">오늘의 이야기</p>
      <p className="topic">{game.topic}</p>
      <p className="muted">{Math.ceil(remainingMs / 1000)}초 뒤에 시작해요</p>
      {game.canReroll && (
        <button className="btn" onClick={() => reroll({ sessionId })}>
          주제 다시 뽑기 (한 번만)
        </button>
      )}
    </section>
  )
}

function Turn({ sessionId, game, remainingMs }: { sessionId: string; game: GameData; remainingMs: number }) {
  const turn = game.turns[game.currentTurn]
  const nextTurn = game.turns[game.currentTurn + 1]
  const iAmNext = !turn.isMe && nextTurn?.isMe && remainingMs <= NEXT_UP_WARNING_MS
  const ratio = remainingMs / (game.turnSeconds * 1000)
  const previous = game.turns.slice(0, game.currentTurn).map((t, i) => ({ ...t, index: i }))

  return (
    <section className="game-main">
      <div className="stage">
        <span className="stage-label">
          {game.currentTurn + 1}. {turn.stage}
        </span>
        <span className="stage-hint">{turn.hint}</span>
        <span className={`timer-text${ratio < 0.2 ? ' low' : ''}`}>{Math.ceil(remainingMs / 1000)}초</span>
      </div>
      <div className="timer">
        <div className={`timer-bar${ratio < 0.2 ? ' low' : ''}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      <div className={`turn-layout${previous.length ? '' : ' no-previous'}`}>
        {previous.length > 0 && (
          <aside className="previous">
            {/* 바로 앞 칸은 크게, 그 전 칸들은 작게 */}
            {previous
              .slice()
              .reverse()
              .map((t, i) => (
                <Panel key={t.index} sessionId={sessionId} turn={t.index} label={`${t.index + 1}. ${t.stage}`} small={i > 0} />
              ))}
          </aside>
        )}
        <div className="current">
          {turn.isMe ? (
            <MyCanvas key={game.currentTurn} sessionId={sessionId} turn={game.currentTurn} />
          ) : (
            <>
              <LiveCanvas sessionId={sessionId} turn={game.currentTurn} />
              <p className="watching">
                <strong>{turn.number}번</strong>이 그리는 중…
                {iAmNext && <span className="next-up">다음은 너야!</span>}
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function MyCanvas({ sessionId, turn }: { sessionId: string; turn: number }) {
  const strokes = useQuery(api.strokes.panel, { sessionId, turn }) ?? NO_STROKES
  const addStroke = useMutation(api.strokes.add)
  const undo = useMutation(api.strokes.undo)
  const complete = useMutation(api.games.complete)
  const [color, setColor] = useState<string>(PEN_COLORS[0].value)
  const [width, setWidth] = useState<number>(PEN_WIDTHS[0].value)
  const [erasing, setErasing] = useState(false)

  return (
    <>
      <FitArea>
        <DrawingCanvas
          strokes={strokes}
          editable
          color={erasing ? ERASER_COLOR : color}
          width={erasing ? ERASER_WIDTH : width}
          onStrokeEnd={(s) => {
            addStroke({ sessionId, turn, ...s }).catch(() => {})
          }}
        />
      </FitArea>
      <div className="toolbar">
        <div className="colors">
          {PEN_COLORS.map((c) => (
            <button
              key={c.value}
              className={`swatch${!erasing && color === c.value ? ' selected' : ''}`}
              style={{ background: c.value }}
              aria-label={c.name}
              onClick={() => {
                setColor(c.value)
                setErasing(false)
              }}
            />
          ))}
        </div>
        <div className="tools">
          {PEN_WIDTHS.map((w) => (
            <button
              key={w.value}
              className={`btn small${!erasing && width === w.value ? ' selected' : ''}`}
              onClick={() => {
                setWidth(w.value)
                setErasing(false)
              }}
            >
              {w.name}
            </button>
          ))}
          <button className={`btn small${erasing ? ' selected' : ''}`} onClick={() => setErasing(true)}>
            지우개
          </button>
          <button className="btn small" disabled={strokes.length === 0} onClick={() => undo({ sessionId, turn })}>
            되돌리기
          </button>
        </div>
        <button className="btn primary" onClick={() => complete({ sessionId, turn })}>
          완료
        </button>
      </div>
    </>
  )
}

function LiveCanvas({ sessionId, turn }: { sessionId: string; turn: number }) {
  const strokes = useQuery(api.strokes.panel, { sessionId, turn }) ?? NO_STROKES
  return (
    <FitArea>
      <DrawingCanvas strokes={strokes} />
    </FitArea>
  )
}

function Panel({ sessionId, turn, label, small }: { sessionId: string; turn: number; label: string; small?: boolean }) {
  const strokes = useQuery(api.strokes.panel, { sessionId, turn })
  return (
    <figure className={`panel${small ? ' small' : ''}`}>
      <DrawingCanvas strokes={strokes ?? NO_STROKES} />
      <figcaption>
        {label}
        {strokes?.length === 0 && <span className="muted"> (빈 칸)</span>}
      </figcaption>
    </figure>
  )
}

const REVEAL_STEP_MS = 1200

/** 공개 화면: 칸이 하나씩 나타나고, 다 나타나면 한 판 더. */
function Reveal({ sessionId, game, isHost }: { sessionId: string; game: GameData; isHost: boolean }) {
  const count = game.turns.length
  const [shown, setShown] = useState(0)
  const [error, setError] = useState('')
  const rematch = useMutation(api.rooms.rematch)
  const backToLobby = useMutation(api.rooms.backToLobby)

  useEffect(() => {
    if (shown >= count) return
    const timer = window.setTimeout(() => setShown((n) => n + 1), shown === 0 ? 600 : REVEAL_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [shown, count])

  const cols = comicColumns(count)
  const rows = Math.ceil(count / cols)
  const allShown = shown >= count

  function run(action: Promise<unknown>) {
    setError('')
    action.catch((err) => setError(errorMessage(err)))
  }

  return (
    <section className="game-main">
      <FitArea ratio={((cols * 4) / (rows * 3)) * 0.97}>
        <div className="reveal-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {game.turns.map((t, i) => (
            <RevealPanel key={i} sessionId={sessionId} turn={i} label={`${i + 1}. ${t.stage} · ${t.number}번`} visible={i < shown} />
          ))}
        </div>
      </FitArea>
      <div className="reveal-actions">
        {error && <p className="error">{error}</p>}
        {!allShown ? (
          <p className="muted">한 칸씩 공개하는 중…</p>
        ) : isHost ? (
          <>
            <button className="btn primary big" onClick={() => run(rematch({ sessionId }))}>
              한 판 더
            </button>
            <button className="btn" onClick={() => run(backToLobby({ sessionId }))}>
              대기실로 (새 친구 받기)
            </button>
          </>
        ) : (
          <p className="muted">방장이 "한 판 더"를 누르면 다시 시작해요</p>
        )}
      </div>
    </section>
  )
}

function RevealPanel({ sessionId, turn, label, visible }: { sessionId: string; turn: number; label: string; visible: boolean }) {
  const strokes = useQuery(api.strokes.panel, { sessionId, turn })
  return (
    <div className={`reveal-panel${visible ? ' shown' : ''}`}>
      {visible ? <DrawingCanvas strokes={strokes ?? NO_STROKES} /> : <div className="drawing hidden-panel">?</div>}
      <span className="reveal-label">
        {label}
        {visible && strokes?.length === 0 && ' (빈 칸)'}
      </span>
    </div>
  )
}

/** 게임 정보가 없는 방에서 빠져나가는 화면 */
function Done({ sessionId, isHost, message }: { sessionId: string; isHost: boolean; message: string }) {
  const backToLobby = useMutation(api.rooms.backToLobby)
  const leave = useMutation(api.rooms.leave)
  return (
    <section className="game-main center">
      <p className="topic">{message}</p>
      {isHost && (
        <button className="btn primary" onClick={() => backToLobby({ sessionId })}>
          대기실로 돌아가기
        </button>
      )}
      <button className="btn ghost" onClick={() => leave({ sessionId })}>
        나가기
      </button>
    </section>
  )
}

function TurnStrip({ game }: { game: GameData }) {
  return (
    <ol className="turn-strip">
      {game.turns.map((t, i) => (
        <li key={i} className={`turn ${t.state}${t.isMe ? ' me' : ''}`}>
          <span className="turn-stage">{t.stage}</span>
          <span className="turn-number">{t.state === 'skipped' ? '건너뜀' : `${t.number}번`}</span>
        </li>
      ))}
    </ol>
  )
}
