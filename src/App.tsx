import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

export default function App() {
  const ping = useQuery(api.health.ping)

  return (
    <main className="center">
      <h1>이어 그리기</h1>
      <p className="muted">M0 · 연결 확인</p>
      {ping === undefined ? (
        <p>서버에 연결하는 중…</p>
      ) : (
        <p>
          ✅ 서버 연결됨 · {new Date(ping.serverTime).toLocaleTimeString('ko-KR')}
        </p>
      )}
    </main>
  )
}
