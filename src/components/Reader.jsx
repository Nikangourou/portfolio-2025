// create a cylinder

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'

export default function Reader() {
    return (
        <group position={[0, 0, -1]}>
            <mesh position={[1, 0, 1]}>
                <cylinderGeometry args={[0.1, 0.1, 1, 32]} />
                <meshStandardMaterial color="red" />
            </mesh>
            <mesh position={[-1, 0, 1]}>
                <cylinderGeometry args={[0.1, 0.1, 1, 32]} />
                <meshStandardMaterial color="green" />
            </mesh>
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
                <meshStandardMaterial color="blue" />
            </mesh>
        </group>
    )
}