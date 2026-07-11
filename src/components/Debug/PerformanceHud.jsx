import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'

const isPerfEnabledFromUrl = () => {
    if (typeof window === 'undefined') {
        return false
    }

    const query = new URLSearchParams(window.location.search)
    return query.get('perf') === '1'
}

export default function PerformanceHud() {
    const { gl } = useThree()
    const [metrics, setMetrics] = useState({
        fps: 0,
        frameMs: 0,
        drawCalls: 0,
        triangles: 0,
        geometries: 0,
        textures: 0,
    })

    const frameCountRef = useRef(0)
    const elapsedRef = useRef(0)
    const isVisible = isPerfEnabledFromUrl()

    useFrame((_, delta) => {
        if (!isVisible) {
            return
        }

        frameCountRef.current += 1
        elapsedRef.current += delta

        if (elapsedRef.current < 0.5) {
            return
        }

        const fps = frameCountRef.current / elapsedRef.current
        const frameMs = fps > 0 ? 1000 / fps : 0
        const rendererInfo = gl.info

        setMetrics({
            fps,
            frameMs,
            drawCalls: rendererInfo.render.calls,
            triangles: rendererInfo.render.triangles,
            geometries: rendererInfo.memory.geometries,
            textures: rendererInfo.memory.textures,
        })

        frameCountRef.current = 0
        elapsedRef.current = 0
    })

    if (!isVisible) {
        return null
    }

    return (
        <Html fullscreen prepend zIndexRange={[1000, 0]}>
            <div
                style={{
                    position: 'fixed',
                    top: '12px',
                    left: '12px',
                    zIndex: 1000,
                    pointerEvents: 'none',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(6, 8, 12, 0.78)',
                    color: '#d5f4e6',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: '12px',
                    lineHeight: 1.45,
                    letterSpacing: '0.01em',
                    minWidth: '188px',
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(115, 255, 195, 0.26)',
                    boxShadow: '0 6px 30px rgba(0, 0, 0, 0.35)',
                }}
            >
                <div style={{ color: '#8cfbc8', marginBottom: '6px', fontWeight: 600 }}>
                    Performance
                </div>
                <div>FPS: {metrics.fps.toFixed(1)}</div>
                <div>Frame: {metrics.frameMs.toFixed(2)} ms</div>
                <div>Draw Calls: {metrics.drawCalls}</div>
                <div>Triangles: {metrics.triangles}</div>
                <div>Geometries: {metrics.geometries}</div>
                <div>Textures: {metrics.textures}</div>
                <div style={{ marginTop: '6px', color: '#95b3a7' }}>
                    Enabled with ?perf=1
                </div>
            </div>
        </Html>
    )
}
