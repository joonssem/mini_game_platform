import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../convex/_generated/api'
import { getSessionId } from './session'
import { useHeartbeat } from './useHeartbeat'
import Home from './screens/Home'
import Lobby from './screens/Lobby'
import Game from './screens/Game'

export default function App() {
  const [sessionId] = useState(getSessionId)
  const room = useQuery(api.rooms.myRoom, { sessionId })
  useHeartbeat(sessionId, !!room)

  if (room === undefined) {
    return (
      <main className="screen center">
        <p className="muted">연결하는 중…</p>
      </main>
    )
  }
  if (room === null) return <Home sessionId={sessionId} />
  if (room.status === 'lobby') return <Lobby sessionId={sessionId} room={room} />
  return <Game sessionId={sessionId} room={room} />
}
