import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three';

export default function Projet({ position, rotation, title, description, technologies, link }) {
  const meshRef = useRef(null);

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1.8, 0.25]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
} 