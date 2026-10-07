import { useQuery } from 'convex/react'
import { useState } from 'react'
import { api } from '../convex/_generated/api'
import { getSessionId } from './session'
import { useHeartbeat } from './useHeartbeat'
import Game from './screens/Game'
import Home from './screens/Home'
import Lobby from './screens/Lobby'
import Teacher from './screens/Teacher'

export default function App() {
  if (window.location.pathname.startsWith('/teacher')) return <Teacher />
  return <Player />
}

function Player() {
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
