import { useEffect, useRef } from 'react'
import {
    clearGlobalVisualPointerState,
    setGlobalVisualPointerState,
} from '@/utils/globalPointerTracker'
import useThemeStore from '@/stores/themeStore'

// Serpent en trait fin (façon tatouage line-art) : une colonne vertébrale qui suit le curseur,
// un corps fait de chevrons empilés qui s'affine vers la queue, sans tête.
const SEGMENT_COUNT = 84
const SEGMENT_LENGTH = 9
const HEAD_LERP = 0.1
const FOLLOW_SMOOTHING = 0.55
const MAX_HALF_WIDTH = 30
const LINE_WIDTH = 1.2
const WAVE_AMPLITUDE = 26
const VERTEX_STEP = 2
const CHEVRON_DEPTH = 1.1

// Tête : un losange dont le sommet arrière touche la ligne centrale.
// Formes en repère local (x vers l'avant, y sur le côté), multipliées par HEAD_SIZE.
const HEAD_SIZE = 26
const HEAD_SHAPE = [[1.7, 0], [0.6, -0.8], [0, 0], [0.6, 0.8]]

// Épaisseur du corps le long de la colonne : cou net, puis effilé jusqu'à la queue
const bodyHalfWidth = (progress) => {
    const neck = Math.min(progress / 0.08, 1)
    const taper = Math.pow(1 - progress, 0.8)
    return MAX_HALF_WIDTH * neck * taper
}

export default function SceneMouseTrail() {
    const canvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) {
            return undefined
        }

        const context = canvas.getContext('2d')
        if (!context) {
            return undefined
        }

        const startX = window.innerWidth * 0.5
        const startY = window.innerHeight * 0.5
        const points = Array.from({ length: SEGMENT_COUNT }, () => ({ x: startX, y: startY }))
        const pointer = { x: startX, y: startY }
        let speed = 0
        let animationFrame = null

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const width = window.innerWidth
            const height = window.innerHeight

            canvas.width = Math.floor(width * dpr)
            canvas.height = Math.floor(height * dpr)
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            context.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        const handlePointerMove = (event) => {
            pointer.x = event.clientX
            pointer.y = event.clientY
        }

        const update = () => {
            const head = points[0]
            const previousX = head.x
            const previousY = head.y

            head.x += (pointer.x - head.x) * HEAD_LERP
            head.y += (pointer.y - head.y) * HEAD_LERP

            speed += (Math.hypot(head.x - previousX, head.y - previousY) - speed) * 0.12

            // Chaque anneau reste à distance fixe de celui qui le précède : le corps épouse la trajectoire
            for (let index = 1; index < points.length; index += 1) {
                const point = points[index]
                const target = points[index - 1]
                const dx = point.x - target.x
                const dy = point.y - target.y
                const distance = Math.hypot(dx, dy)

                if (distance > 0.0001) {
                    const ratio = SEGMENT_LENGTH / distance
                    // Rattrapage amorti : le corps se déroule en douceur au lieu de suivre à angle vif
                    point.x += (target.x + dx * ratio - point.x) * FOLLOW_SMOOTHING
                    point.y += (target.y + dy * ratio - point.y) * FOLLOW_SMOOTHING
                } else {
                    point.x = target.x - SEGMENT_LENGTH
                    point.y = target.y
                }
            }
        }

        const draw = (time) => {
            update()
            setGlobalVisualPointerState(points[0].x, points[0].y)

            const color = useThemeStore.getState().currentTheme.text || 'black'
            const last = points.length - 1
            // Le serpent ondule quand le curseur bouge, et se redresse quand il s'arrête
            const wave = WAVE_AMPLITUDE * (0.35 + 0.65 * Math.min(speed / 6, 1))

            // Colonne vertébrale ondulée, avec sa normale
            const spine = points.map((point, index) => {
                const before = points[Math.max(index - 1, 0)]
                const after = points[Math.min(index + 1, last)]
                let tx = before.x - after.x
                let ty = before.y - after.y
                const tangentLength = Math.hypot(tx, ty) || 1
                tx /= tangentLength
                ty /= tangentLength
                const nx = -ty
                const ny = tx
                const progress = index / last
                const swim = Math.sin(time * 0.004 - index * 0.16) + 0.45 * Math.sin(time * 0.0027 - index * 0.31 + 1.7)
                const offset = swim * wave * Math.min(progress * 2.5, 1)
                return { x: point.x + nx * offset, y: point.y + ny * offset, nx, ny, tx, ty, progress }
            })

            context.clearRect(0, 0, window.innerWidth, window.innerHeight)
            context.save()
            context.strokeStyle = color
            context.lineWidth = LINE_WIDTH
            context.lineCap = 'round'
            context.lineJoin = 'round'

            // Chevrons « < » empilés qui se chevauchent, pointe vers l'avant : dessinés de la queue vers la tête
            // pour que les plus proches de la tête passent par-dessus.
            for (let index = last - (last % VERTEX_STEP); index >= 0; index -= VERTEX_STEP) {
                const point = spine[index]
                // Une onde d'épaisseur parcourt le corps de la tête à la queue
                const pulse = 1 + 0.28 * Math.sin(time * 0.005 - point.progress * 14)
                const halfWidth = bodyHalfWidth(point.progress) * pulse
                const backLength = halfWidth * CHEVRON_DEPTH
                const baseX = point.x - point.tx * backLength
                const baseY = point.y - point.ty * backLength

                context.globalAlpha = 0.95 - point.progress * 0.55
                context.beginPath()
                context.moveTo(baseX + point.nx * halfWidth, baseY + point.ny * halfWidth)
                context.lineTo(point.x, point.y)
                context.lineTo(baseX - point.nx * halfWidth, baseY - point.ny * halfWidth)
                context.stroke()
            }

            // Ligne centrale : suit la colonne vertébrale et s'efface vers la queue
            for (let index = 0; index < last; index += 1) {
                const start = spine[index]
                const end = spine[index + 1]
                if (start.progress > 0.94) break

                context.globalAlpha = 0.95 - start.progress * 0.6
                context.beginPath()
                context.moveTo(start.x, start.y)
                context.lineTo(end.x, end.y)
                context.stroke()
            }

            // Tête : posée au bout de la colonne, orientée dans le sens de la marche
            const headSpine = spine[0]
            const headAngle = Math.atan2(headSpine.ty, headSpine.tx)
            const cos = Math.cos(headAngle)
            const sin = Math.sin(headAngle)
            const toWorld = ([x, y]) => [
                headSpine.x + (x * cos - y * sin) * HEAD_SIZE,
                headSpine.y + (x * sin + y * cos) * HEAD_SIZE,
            ]

            context.globalAlpha = 1
            context.beginPath()
            HEAD_SHAPE.forEach((vertex, index) => {
                const [worldX, worldY] = toWorld(vertex)
                if (index === 0) context.moveTo(worldX, worldY)
                else context.lineTo(worldX, worldY)
            })
            context.closePath()
            context.stroke()

            context.restore()

            if (!document.hidden) {
                animationFrame = window.requestAnimationFrame(draw)
            } else {
                animationFrame = null
            }
        }

        const handleVisibilityChange = () => {
            if (!document.hidden && animationFrame === null) {
                animationFrame = window.requestAnimationFrame(draw)
            }
        }

        resize()
        animationFrame = window.requestAnimationFrame(draw)

        window.addEventListener('resize', resize)
        window.addEventListener('pointermove', handlePointerMove, { passive: true })
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            if (animationFrame !== null) {
                window.cancelAnimationFrame(animationFrame)
            }
            clearGlobalVisualPointerState()
            window.removeEventListener('resize', resize)
            window.removeEventListener('pointermove', handlePointerMove)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [])

    return (
        <canvas
            ref={canvasRef}
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 12,
            }}
        />
    )
}
