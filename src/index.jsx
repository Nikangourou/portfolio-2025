import './style.css'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import Experience from './Experience.jsx'
import { Leva } from 'leva'

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(
    <>
        <Leva />
        <Canvas
            camera={ {
                fov: 75,
                near: 0.1,
                far: 200,
                position: [ 0, 0, 0 ],
            } }
        >
            <color args={['#ffffff']} attach="background" />
            <Experience />
        </Canvas>
    </>
)