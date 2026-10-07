export type Stroke = {
  clientId: string
  color: string
  width: number
  /** [x0, y0, x1, y1, ...] 그림판 너비·높이에 대한 비율 */
  points: number[]
}

/** 획 하나를 부드러운 곡선으로 그린다. w, h는 그림판의 화면 크기(CSS 픽셀). */
export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, w: number, h: number) {
  const p = stroke.points
  const lineWidth = Math.max(1, stroke.width * w)
  ctx.strokeStyle = stroke.color
  ctx.fillStyle = stroke.color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (p.length < 4) {
    ctx.beginPath()
    ctx.arc(p[0] * w, p[1] * h, lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(p[0] * w, p[1] * h)
  for (let i = 2; i < p.length - 2; i += 2) {
    const midX = ((p[i] + p[i + 2]) / 2) * w
    const midY = ((p[i + 1] + p[i + 3]) / 2) * h
    ctx.quadraticCurveTo(p[i] * w, p[i + 1] * h, midX, midY)
  }
  ctx.lineTo(p[p.length - 2] * w, p[p.length - 1] * h)
  ctx.stroke()
}

export function drawAll(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number) {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  for (const stroke of strokes) drawStroke(ctx, stroke, w, h)
}
