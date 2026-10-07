import { useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../convex/_generated/api'
import { MAX_PLAYERS, MIN_PLAYERS, TURN_SECONDS_OPTIONS } from '../../convex/constants'
import { errorMessage } from '../session'
import type { Room } from './types'

export default function Lobby({ sessionId, room }: { sessionId: string; room: Room }) {
  const [error, setError] = useState('')
  const start = useMutation(api.rooms.start)
  const setTurnSeconds = useMutation(api.rooms.setTurnSeconds)
  const leave = useMutation(api.rooms.leave)

  const connectedCount = room.players.filter((p) => p.connected).length
  const canStart = connectedCount >= MIN_PLAYERS
  const emptySlots = Math.max(0, MAX_PLAYERS - room.players.length)

  function run(action: Promise<unknown>) {
    setError('')
    action.catch((err) => setError(errorMessage(err)))
  }

  return (
    <main className="screen center">
      <p className="muted">방 코드</p>
      <p className="room-code">{room.code}</p>
      <p className="muted">친구에게 이 숫자를 알려 주세요</p>

      <ul className="players">
        {room.players.map((p) => (
          <li key={p.number} className={`player${p.isMe ? ' me' : ''}${p.connected ? '' : ' away'}`}>
            <span className="player-number">{p.number}번</span>
            <span className="player-tags">
              {p.isHost && <span className="tag">방장</span>}
              {p.isMe && <span className="tag">나</span>}
              {!p.connected && <span className="tag warn">연결 끊김</span>}
            </span>
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li key={`empty-${i}`} className="player empty">
            기다리는 중
          </li>
        ))}
      </ul>

      <div className="stack wide">
        <div className="field">
          <span>한 칸 그리는 시간</span>
          <div className="segmented">
            {TURN_SECONDS_OPTIONS.map((s) => (
              <button
                key={s}
                className={`btn${room.turnSeconds === s ? ' selected' : ''}`}
                disabled={!room.isHost}
                onClick={() => run(setTurnSeconds({ sessionId, seconds: s }))}
              >
                {s}초
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        {room.isHost ? (
          <button className="btn primary big" disabled={!canStart} onClick={() => run(start({ sessionId }))}>
            {canStart ? '시작하기' : `${MIN_PLAYERS}명 이상 모이면 시작할 수 있어요`}
          </button>
        ) : (
          <p className="muted">방장이 시작하면 게임이 시작돼요</p>
        )}
        <button className="btn ghost" onClick={() => run(leave({ sessionId }))}>
          나가기
        </button>
      </div>
    </main>
  )
}
