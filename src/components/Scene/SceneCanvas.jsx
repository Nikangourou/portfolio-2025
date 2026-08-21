import { Canvas } from '@react-three/fiber'
import Experience from '@/Experience.jsx'
import SceneMouseTrail from './SceneMouseTrail.jsx'
import { isMobile } from '@/utils/deviceUtils'

export default function SceneCanvas() {
    const shouldRenderTrail = typeof window !== 'undefined' && !isMobile()

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Canvas
                eventPrefix="client"
                dpr={[1, 2]}
                gl={{
                    antialias: true,
                    alpha: false,
                    stencil: false,
                    depth: true,
                    powerPreference: 'high-performance',
                    preserveDrawingBuffer: false,
                }}
                camera={{
                    fov: 75,
                    near: 0.1,
                    far: 200,
                    position: [0, 0, 0],
                }}
            >
                <color args={[1, 1, 1]} attach="background" />
                <Experience />
            </Canvas>
            {shouldRenderTrail ? <SceneMouseTrail /> : null}
        </div>
    )
}
