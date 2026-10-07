import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * 남은 공간 안에 4:3 그림판이 가장 크게 들어가도록 크기를 정한다.
 * Safari 주소창·탭 막대 때문에 화면 높이가 기기마다 달라도 [완료] 버튼이 밀려나지 않게 하기 위해서다.
 */
export default function FitArea({ children, ratio = 4 / 3 }: { children: ReactNode; ratio?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect
      setWidth(Math.floor(Math.min(w, h * ratio)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ratio])

  return (
    <div ref={ref} className="fit-area">
      {width !== null && width > 0 && <div style={{ width }}>{children}</div>}
    </div>
  )
}
