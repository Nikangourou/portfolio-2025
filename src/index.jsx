import './style.css'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import Experience from './Experience.jsx'
import { KeyboardControls } from '@react-three/drei'
import Interface from './Interface.jsx'
import { Leva } from 'leva'

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(
    <KeyboardControls
        map={ [
            { name: 'forward', keys: [ 'ArrowUp', 'KeyW' ] },
            { name: 'backward', keys: [ 'ArrowDown', 'KeyS' ] },
            { name: 'leftward', keys: [ 'ArrowLeft', 'KeyA' ] },
            { name: 'rightward', keys: [ 'ArrowRight', 'KeyD' ] },
            { name: 'jump', keys: [ 'Space' ] },
        ] }
    >
        <Leva />
        <Canvas
            shadows
            camera={ {
                fov: 75,
                near: 0.1,
                far: 200,
                position: [ 0, 0, 0 ],
            } }
        >
            <color args={['#ffffff']} attach="background" />
            <Grid
                position={[0, 0, -50]}
                rotation={[Math.PI / 2, 0, 0]}
                args={[100, 100]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={100}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={true}
            />
            <Experience />
        </Canvas>
        <Interface />
    </KeyboardControls>
)