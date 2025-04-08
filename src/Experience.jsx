import { Physics } from '@react-three/rapier'
import Lights from './Lights.jsx'
import Projets from './components/Projets.jsx'
import Reader from './components/Reader.jsx'
export default function Experience() {
  return (
    <>
      <color args={['#bdedfc']} attach="background" />

      <Physics debug={false}>
        <Lights />
        <group rotation={[Math.PI / 2, 0, 0]}>
          <Projets />
          <Reader />
        </group>
      </Physics>
    </>
  )
}
