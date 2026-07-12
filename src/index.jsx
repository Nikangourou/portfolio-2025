import { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import ThemeProvider from './components/Theme/ThemeProvider'
import Name from './components/Interface/Name'
import './style.css'

const SceneCanvas = lazy(() => import('./components/Scene/SceneCanvas.jsx'))

const root = ReactDOM.createRoot(document.querySelector('#root'))

root.render(
    <ThemeProvider>
        <Name />
        <Suspense fallback={null}>
            <SceneCanvas />
        </Suspense>
    </ThemeProvider>
)