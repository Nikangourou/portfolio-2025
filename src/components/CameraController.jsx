import { useThree, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export default function CameraController() {
  const { camera } = useThree();
  const target = new THREE.Vector3(0, 0, -5);

  useFrame(() => {
    camera.position.set(0, 0, 0);
    camera.lookAt(target);
  });
  
  return null;
} 