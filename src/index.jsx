import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import ThemeProvider from './components/Theme/ThemeProvider'
import Experience from './Experience.jsx'
import Name from './components/Interface/Name'
import './style.css'

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(
    <ThemeProvider>
        <Name />
        <Canvas
            camera={ {
                fov: 75,
                near: 0.1,
                far: 200,
                position: [ 0, 0, 0 ],
            } }
        >
            <color args={[1, 1, 1]} attach="background" />
            <Experience />
        </Canvas>
    </ThemeProvider>
)