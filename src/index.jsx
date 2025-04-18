import './style.css'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import Experience from './Experience.jsx'
import { Leva } from 'leva'
import Interface from './components/Interface.jsx'

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(
    <>
        <Leva />
        <Interface />
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
            {/* Sol */}
            <Grid
                position={[0, -5, -5]}
                args={[20, 20]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="red"
                fadeDistance={1000}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />
            {/* Mur devant */}
            <Grid
                position={[0, 2.5, -15]}
                rotation={[Math.PI / 2, 0, 0]}
                args={[20, 15]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={100}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />
             {/* Mur arrière */}
             <Grid
                position={[0, 2.5, 5]}
                rotation={[Math.PI / 2, 0, Math.PI]}
                args={[20, 15]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={100}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />
            {/* Mur gauche */}
            <Grid
                position={[-10, 2.5, -5]}
                rotation={[0, Math.PI , Math.PI / 2]}
                args={[15, 20]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={50}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />
            {/* Mur droit */}
            <Grid
                position={[10, 2.5, -5]}
                rotation={[0, 0, Math.PI / 2]}
                args={[15, 20]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={100}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />
             {/* Toit */}
             <Grid
                position={[0, 10, -5]}
                rotation={[Math.PI, 0, 0]}
                args={[20, 20]}
                cellSize={1}
                cellThickness={0.7}
                cellColor="#6f6f6f"
                sectionSize={0}
                sectionThickness={1}
                sectionColor="#6f6f6f"
                fadeDistance={1000}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />
            <Experience />
        </Canvas>
    </>
)