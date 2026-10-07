import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined
const root = createRoot(document.getElementById('root')!)

if (!convexUrl) {
  root.render(
    <main className="center">
      <p>Convex 주소(VITE_CONVEX_URL)가 설정되지 않았어요.</p>
      <p className="muted">README.md의 "처음 실행하기"를 따라 주세요.</p>
    </main>,
  )
} else {
  const convex = new ConvexReactClient(convexUrl)
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </StrictMode>,
  )
}
