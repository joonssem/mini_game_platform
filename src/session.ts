import { ConvexError } from 'convex/values'

const KEY = 'mgp.sessionId'

function randomId() {
  // crypto.randomUUID는 https에서만 동작한다. 같은 와이파이의 iPad로 http 개발 서버에 접속할 때도 되도록 직접 만든다.
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 기기마다 하나. 새로고침하거나 화면을 잠갔다 와도 같은 방, 같은 자리로 돌아오게 한다. */
export function getSessionId(): string {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return saved
    const id = randomId()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 유지된다.
    return randomId()
  }
}

/** 서버가 보낸 안내 문구를 꺼낸다. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError && typeof error.data === 'string') return error.data
  return '연결에 문제가 있어요. 잠시 뒤 다시 시도해 주세요.'
}
