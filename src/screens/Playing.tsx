import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Room } from './types'

/** M1 임시 화면. M2에서 차례 진행 화면으로 바꾼다. */
export default function Playing({ sessionId, room }: { sessionId: string; room: Room }) {
  const backToLobby = useMutation(api.rooms.backToLobby)
  const leave = useMutation(api.rooms.leave)

  return (
    <main className="screen center">
      <h1 className="title">게임 시작!</h1>
      <p className="muted">
        {room.players.map((p) => `${p.number}번`).join(' · ')} · 한 칸 {room.turnSeconds}초
      </p>
      <p>게임 화면은 다음 단계(M2)에서 만들어요.</p>
      <div className="stack wide">
        {room.isHost && (
          <button className="btn primary" onClick={() => backToLobby({ sessionId })}>
            대기실로 돌아가기
          </button>
        )}
        <button className="btn ghost" onClick={() => leave({ sessionId })}>
          나가기
        </button>
      </div>
    </main>
  )
}
