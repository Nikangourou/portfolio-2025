import { Canvas } from '@react-three/fiber'
import Experience from '@/Experience.jsx'

export default function SceneCanvas() {
    return (
        <Canvas
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
    )
}
