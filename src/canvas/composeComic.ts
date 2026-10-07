import { drawAll, type Stroke } from './draw'

export type ComicPanel = { number: number; stage: string; strokes: Stroke[] }

const PANEL_W = 800
const PANEL_H = 600
const GAP = 24
const TITLE_H = 90
const CAPTION_H = 44

/** 3칸은 한 줄, 그 밖에는 두 줄 */
export function comicColumns(count: number) {
  return count === 3 ? 3 : 2
}

/** 만화 전체를 이미지 한 장(PNG data URL)으로 만든다. 교사 페이지에서 저장용. */
export function composeComic(topic: string, panels: ComicPanel[], date: Date) {
  const cols = comicColumns(panels.length)
  const rows = Math.ceil(panels.length / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * PANEL_W + (cols + 1) * GAP
  canvas.height = TITLE_H + rows * (PANEL_H + CAPTION_H) + (rows + 1) * GAP
  const ctx = canvas.getContext('2d')!
  const font = "'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

  ctx.fillStyle = '#fafaf7'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#1d1d1f'
  ctx.textBaseline = 'middle'
  ctx.font = `800 44px ${font}`
  ctx.fillText(topic, GAP, GAP + TITLE_H / 2)
  ctx.font = `500 24px ${font}`
  ctx.fillStyle = '#6b6b70'
  ctx.textAlign = 'right'
  ctx.fillText(date.toLocaleString('ko-KR'), canvas.width - GAP, GAP + TITLE_H / 2)
  ctx.textAlign = 'left'

  panels.forEach((panel, i) => {
    const x = GAP + (i % cols) * (PANEL_W + GAP)
    const y = GAP + TITLE_H + Math.floor(i / cols) * (PANEL_H + CAPTION_H + GAP)
    ctx.save()
    ctx.translate(x, y)
    drawAll(ctx, panel.strokes, PANEL_W, PANEL_H)
    ctx.restore()
    ctx.strokeStyle = '#d9d9de'
    ctx.lineWidth = 3
    ctx.strokeRect(x, y, PANEL_W, PANEL_H)
    ctx.fillStyle = '#1d1d1f'
    ctx.font = `700 26px ${font}`
    const empty = panel.strokes.length === 0 ? ' (빈 칸)' : ''
    ctx.fillText(`${i + 1}. ${panel.stage} · ${panel.number}번${empty}`, x, y + PANEL_H + CAPTION_H / 2)
  })

  return canvas.toDataURL('image/png')
}
