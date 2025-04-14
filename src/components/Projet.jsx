import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three';

export default function Projet({ position, rotation, title, description, technologies, link, color }) {
  const meshRef = useRef(null);

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
} 