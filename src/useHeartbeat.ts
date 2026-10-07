import { useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '../convex/_generated/api'
import { HEARTBEAT_MS } from '../convex/constants'

/** 방에 있는 동안 서버에 "아직 있어요" 신호를 보낸다. 화면 잠금에서 돌아오면 바로 보낸다. */
export function useHeartbeat(sessionId: string, active: boolean) {
  const beat = useMutation(api.rooms.heartbeat)

  useEffect(() => {
    if (!active) return
    const send = () => {
      beat({ sessionId }).catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') send()
    }
    send()
    const timer = window.setInterval(send, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, beat, sessionId])
}
