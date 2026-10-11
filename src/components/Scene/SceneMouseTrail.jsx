import { useEffect, useRef } from 'react'
import {
    clearGlobalVisualPointerState,
    setGlobalVisualPointerState,
} from '@/utils/globalPointerTracker'

const MAX_POINTS = 18
const HEAD_LERP = 0.17
const TAIL_LERP = 0.16

// La fumée est très floue : on la dessine à demi-résolution (4x moins de pixels à remplir/fondre).
const SMOKE_RESOLUTION = 0.5
const SPRITE_SIZE = 128

// Dégradé radial pré-rendu une fois : drawImage + globalAlpha remplace ~250 createRadialGradient par image.
const createGradientSprite = (innerRatio, stops) => {
    const sprite = document.createElement('canvas')
    sprite.width = SPRITE_SIZE
    sprite.height = SPRITE_SIZE
    const spriteContext = sprite.getContext('2d')
    const half = SPRITE_SIZE / 2
    const gradient = spriteContext.createRadialGradient(half, half, half * innerRatio, half, half, half)
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
    spriteContext.fillStyle = gradient
    spriteContext.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
    return sprite
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const length = (x, y) => Math.hypot(x, y)

export default function SceneMouseTrail() {
    const canvasRef = useRef(null)
    const rippleCanvasRef = useRef(null)

    useEffect(() => {
        const canvas = canvasRef.current
        const rippleCanvas = rippleCanvasRef.current
        if (!canvas || !rippleCanvas) {
            return undefined
        }

        const context = canvas.getContext('2d')
        const rippleContext = rippleCanvas.getContext('2d')
        if (!context || !rippleContext) {
            return undefined
        }

        // Mêmes couleurs/arrêts que les anciens dégradés ; l'intensité passe par globalAlpha.
        const smokeSprite = createGradientSprite(0.08, [
            [0, 'rgba(88, 106, 130, 0.9)'],
            [0.22, 'rgba(116, 136, 158, 0.75)'],
            [0.58, 'rgba(156, 176, 198, 0.22)'],
            [1, 'rgba(255, 255, 255, 0)'],
        ])
        const glowSprite = createGradientSprite(0, [
            [0, 'rgba(255, 255, 255, 1)'],
            [0.35, 'rgba(142, 222, 255, 0.75)'],
            [1, 'rgba(255, 255, 255, 0)'],
        ])

        const points = Array.from({ length: MAX_POINTS }, () => ({
            x: 0,
            y: 0,
            offsetX: 0,
            offsetY: 0,
            drift: Math.random() * Math.PI * 2,
            initialized: false,
        }))

        const pointer = {
            x: window.innerWidth * 0.5,
            y: window.innerHeight * 0.5,
            velocityX: 0,
            velocityY: 0,
            previousX: window.innerWidth * 0.5,
            previousY: window.innerHeight * 0.5,
        }

        let animationFrame = null

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2)
            const width = window.innerWidth
            const height = window.innerHeight

            const smokeScale = dpr * SMOKE_RESOLUTION
            canvas.width = Math.floor(width * smokeScale)
            canvas.height = Math.floor(height * smokeScale)
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            context.setTransform(smokeScale, 0, 0, smokeScale, 0, 0)

            rippleCanvas.width = Math.floor(width * dpr)
            rippleCanvas.height = Math.floor(height * dpr)
            rippleCanvas.style.width = `${width}px`
            rippleCanvas.style.height = `${height}px`
            rippleContext.setTransform(dpr, 0, 0, dpr, 0, 0)
        }

        const initializePoint = (point) => {
            point.x = pointer.x
            point.y = pointer.y
            point.offsetX = 0
            point.offsetY = 0
            point.initialized = true
        }

        const handlePointerMove = (event) => {
            pointer.previousX = pointer.x
            pointer.previousY = pointer.y
            pointer.x = event.clientX
            pointer.y = event.clientY
            pointer.velocityX = pointer.x - pointer.previousX
            pointer.velocityY = pointer.y - pointer.previousY
        }

        const drawSmokeLayer = (time, radiusScale, alphaScale, offsetScale, sampleStep, lift) => {
            for (let index = 0; index < points.length - 1; index += 1) {
                const start = points[index]
                const end = points[index + 1]
                const progress = 1 - index / Math.max(points.length - 1, 1)
                const startX = start.x + start.offsetX * offsetScale
                const startY = start.y + start.offsetY * offsetScale
                const endX = end.x + end.offsetX * offsetScale
                const endY = end.y + end.offsetY * offsetScale

                for (let step = 0; step <= sampleStep; step += 1) {
                    const t = step / sampleStep
                    const baseX = startX + (endX - startX) * t
                    const baseY = startY + (endY - startY) * t
                    const localProgress = progress * (1 - t * 0.35)
                    const swirl = Math.sin(time * 0.0018 + start.drift + index * 0.24 + t * 1.7)
                    const flutter = Math.cos(time * 0.0012 + start.drift * 1.7 + t * 2.1)
                    const x = baseX + swirl * (8 + localProgress * 22) * offsetScale
                    const y = baseY - localProgress * lift + flutter * (4 + localProgress * 10) * offsetScale
                    const radius = (16 + localProgress * 54) * radiusScale
                    const alpha = (0.01 + localProgress * 0.04) * alphaScale
                    context.globalAlpha = alpha
                    context.drawImage(smokeSprite, x - radius, y - radius, radius * 2, radius * 2)
                }
            }
        }

        const draw = () => {
            const time = performance.now()

            context.save()
            context.globalCompositeOperation = 'destination-out'
            context.fillStyle = 'rgba(0, 0, 0, 0.12)'
            context.fillRect(0, 0, window.innerWidth, window.innerHeight)
            context.restore()

            for (let index = 0; index < points.length; index += 1) {
                const point = points[index]
                const target = index === 0 ? pointer : points[index - 1]

                if (!point.initialized) {
                    initializePoint(point)
                }

                const influence = index === 0 ? HEAD_LERP : (TAIL_LERP - index * 0.0035)
                const lerpStrength = clamp(influence, 0.055, HEAD_LERP)
                const progress = index / Math.max(points.length - 1, 1)
                const motionX = pointer.velocityX
                const motionY = pointer.velocityY
                const motionLength = length(motionX, motionY)
                const normalX = motionLength > 0.001 ? -motionY / motionLength : 0
                const normalY = motionLength > 0.001 ? motionX / motionLength : 0
                const windX = index === 0 ? motionX * 0.08 : motionX * (0.012 * (1 - progress))
                const windY = index === 0 ? motionY * 0.08 : motionY * (0.012 * (1 - progress))
                const swirl = Math.sin((progress * 9.0) - (time * 0.0028) + point.drift)
                const organicOffset = (1 - progress) * (5 + motionLength * 0.12) * swirl

                point.x += ((target.x + windX) - point.x) * lerpStrength
                point.y += ((target.y + windY) - point.y) * lerpStrength
                point.offsetX += ((normalX * organicOffset) - point.offsetX) * 0.16
                point.offsetY += ((normalY * organicOffset) - point.offsetY) * 0.16
            }

            const head = points[0]
            if (head) {
                setGlobalVisualPointerState(head.x, head.y)
            }

            context.save()
            context.globalCompositeOperation = 'source-over'
            drawSmokeLayer(time, 1.05, 0.18, 1.0, 3, 8)
            drawSmokeLayer(time, 0.76, 0.26, 0.65, 4, 12)
            drawSmokeLayer(time, 0.52, 0.34, 0.35, 5, 16)
            context.restore()

            rippleContext.clearRect(0, 0, window.innerWidth, window.innerHeight)
            rippleContext.save()
            rippleContext.globalCompositeOperation = 'screen'
            rippleContext.lineCap = 'round'
            rippleContext.lineJoin = 'round'

            for (let index = 0; index < points.length - 1; index += 1) {
                const start = points[index]
                const end = points[index + 1]
                const progress = 1 - index / Math.max(points.length - 1, 1)
                const startX = start.x + start.offsetX * 0.2
                const startY = start.y + start.offsetY * 0.2
                const endX = end.x + end.offsetX * 0.2
                const endY = end.y + end.offsetY * 0.2
                const alpha = 0.12 + progress * 0.28
                const lineWidth = 1.1 + progress * 2.3

                rippleContext.strokeStyle = `rgba(117, 199, 255, ${alpha})`
                rippleContext.lineWidth = lineWidth
                rippleContext.beginPath()
                rippleContext.moveTo(startX, startY)
                rippleContext.lineTo(endX, endY)
                rippleContext.stroke()
            }

            points.forEach((point, index) => {
                const progress = index / Math.max(points.length - 1, 1)
                const alpha = 0.16 + progress * 0.42
                const radius = 3 + progress * 8
                const glowRadius = radius * 2.2

                rippleContext.globalAlpha = alpha
                rippleContext.drawImage(glowSprite, point.x - glowRadius, point.y - glowRadius, glowRadius * 2, glowRadius * 2)
            })

            rippleContext.restore()

            pointer.velocityX *= 0.92
            pointer.velocityY *= 0.92

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
        draw()

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
        <>
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
            <canvas
                ref={rippleCanvasRef}
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 13,
                    mixBlendMode: 'screen',
                }}
            />
        </>
    )
}