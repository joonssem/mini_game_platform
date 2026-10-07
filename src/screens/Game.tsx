import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { NEXT_UP_WARNING_MS } from '../../convex/constants'
import { useNow } from '../useNow'
import type { Game as GameData, Room } from './types'

export default function Game({ sessionId, room }: { sessionId: string; room: Room }) {
  const game = useQuery(api.games.myGame, { sessionId })
  const leave = useMutation(api.rooms.leave)
  const now = useNow()

  if (!game) {
    return (
      <main className="screen center">
        <p className="muted">게임을 불러오는 중…</p>
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
      {game.phase === 'done' && <Done sessionId={sessionId} isHost={room.isHost} />}

      <TurnStrip game={game} />
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
  const complete = useMutation(api.games.complete)
  const turn = game.turns[game.currentTurn]
  const nextTurn = game.turns[game.currentTurn + 1]
  const iAmNext = !turn.isMe && nextTurn?.isMe && remainingMs <= NEXT_UP_WARNING_MS
  const ratio = remainingMs / (game.turnSeconds * 1000)

  return (
    <section className="game-main">
      <div className="stage">
        <span className="stage-label">
          {game.currentTurn + 1}. {turn.stage}
        </span>
        <span className="stage-hint">{turn.hint}</span>
      </div>

      <div className="timer">
        <div className={`timer-bar${ratio < 0.2 ? ' low' : ''}`} style={{ width: `${ratio * 100}%` }} />
        <span className="timer-text">{Math.ceil(remainingMs / 1000)}초</span>
      </div>

      {turn.isMe ? (
        <>
          <div className="canvas-placeholder">
            <strong>내 차례예요!</strong>
            <span className="muted">그림판은 다음 단계(M3)에서 만들어요</span>
          </div>
          <button className="btn primary big" onClick={() => complete({ sessionId, turn: game.currentTurn })}>
            완료
          </button>
        </>
      ) : (
        <div className="canvas-placeholder">
          <strong>{turn.number}번이 그리는 중…</strong>
          {iAmNext && <span className="next-up">다음은 너야!</span>}
        </div>
      )}
    </section>
  )
}

function Done({ sessionId, isHost }: { sessionId: string; isHost: boolean }) {
  const backToLobby = useMutation(api.rooms.backToLobby)
  return (
    <section className="game-main center">
      <p className="topic">다 그렸어요!</p>
      <p className="muted">공개 화면은 M4에서 만들어요</p>
      {isHost && (
        <button className="btn primary" onClick={() => backToLobby({ sessionId })}>
          대기실로 돌아가기
        </button>
      )}
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
