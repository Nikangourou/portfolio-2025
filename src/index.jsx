import './style.css'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import Experience from './Experience.jsx'
import { Leva } from 'leva'
import Interface from './components/Interface/Interface.jsx'

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
            {/* <Grid
                position={[0, 0, -10]}
                rotation={[Math.PI / 2, 0, 0]}
                args={[100, 100]}
                cellSize={0.1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={1}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={100}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            /> */}
         
            <Experience />
        </Canvas>
        <Interface />
    </>
)