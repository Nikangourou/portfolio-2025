import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three';

interface ProjetProps {
  key?: number;
  position: [number, number, number];
  rotation: [number, number, number];
  title: string;
  description: string;
  technologies: string[];
  link?: string;
}

export default function Projet({ position, rotation, title, description, technologies, link }: ProjetProps) {
  const meshRef = useRef<Mesh>(null);

  return (
    <group position={position} rotation={rotation}>
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1.8, 0.25]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  );
} 