import { useCallback, useEffect, useRef, type PointerEvent } from 'react'
import { MAX_STROKE_POINTS } from '../../convex/constants'
import { drawAll, drawStroke, type Stroke } from './draw'

type Props = {
  /** 서버에 저장된 획 */
  strokes: Stroke[]
  editable?: boolean
  color?: string
  width?: number
  /** 손을 떼면 부른다. 서버에 도착할 때까지 이 그림판이 직접 보여 준다. */
  onStrokeEnd?: (stroke: Stroke) => void
}

/** 이 거리(그림판 너비 비율)보다 가까운 점은 버려서 데이터를 줄인다. */
const MIN_POINT_GAP = 0.002

const round = (v: number) => Math.round(v * 1000) / 1000

function newClientId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default function DrawingCanvas({ strokes, editable = false, color = '#000', width = 0.006, onStrokeEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pending = useRef<Stroke[]>([])
  const current = useRef<number[] | null>(null)
  const activePointer = useRef<number | null>(null)
  const penSeen = useRef(false)

  const context = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return null
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return { ctx, w: canvas.width / dpr, h: canvas.height / dpr }
  }, [])

  const redraw = useCallback(() => {
    const c = context()
    if (!c) return
    drawAll(c.ctx, [...strokes, ...pending.current], c.w, c.h)
    if (current.current) drawStroke(c.ctx, { clientId: '', color, width, points: current.current }, c.w, c.h)
  }, [context, strokes, color, width])

  // 서버에 도착한 획은 임시 목록에서 뺀다.
  useEffect(() => {
    const arrived = new Set(strokes.map((s) => s.clientId))
    pending.current = pending.current.filter((s) => !arrived.has(s.clientId))
    redraw()
  }, [strokes, redraw])

  const redrawRef = useRef(redraw)
  useEffect(() => {
    redrawRef.current = redraw
  }, [redraw])

  // 화면 크기가 바뀌면 그림판 해상도를 맞추고 다시 그린다.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      redrawRef.current()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    return () => observer.disconnect()
  }, [])

  function toPoint(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    return [x, y] as const
  }

  function finishStroke() {
    const points = current.current
    current.current = null
    if (!points) return
    const stroke: Stroke = { clientId: newClientId(), color, width, points: points.map(round) }
    pending.current.push(stroke)
    onStrokeEnd?.(stroke)
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!editable) return
    if (e.pointerType === 'pen') penSeen.current = true
    // Apple Pencil을 쓰기 시작하면 손바닥 터치는 무시한다.
    if (e.pointerType === 'touch' && penSeen.current) return
    if (activePointer.current !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    activePointer.current = e.pointerId
    current.current = [...toPoint(e)]
    redraw()
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointer.current || !current.current) return
    const c = context()
    if (!c) return
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    for (const ev of events) {
      const points = current.current
      const [x, y] = toPoint(ev)
      const lastX = points[points.length - 2]
      const lastY = points[points.length - 1]
      if (Math.hypot(x - lastX, y - lastY) < MIN_POINT_GAP) continue
      points.push(x, y)
      // 그리는 동안은 새 구간만 덧그린다. 전체 다시 그리기는 서버 데이터가 바뀔 때만.
      drawStroke(c.ctx, { clientId: '', color, width, points: [lastX, lastY, x, y] }, c.w, c.h)
      if (points.length >= MAX_STROKE_POINTS * 2) {
        finishStroke()
        current.current = [x, y]
      }
    }
  }

  function onPointerEnd(e: PointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== activePointer.current) return
    activePointer.current = null
    finishStroke()
    redraw()
  }

  return (
    <div className={`drawing${editable ? ' editable' : ''}`}>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />
    </div>
  )
}
