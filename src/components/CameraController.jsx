import { useThree, useFrame } from '@react-three/fiber';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export default function CameraController() {
  const { camera } = useThree();
  const scrollAngle = useRef(0);
  const target = new THREE.Vector3(0, 0, -5);
  const radius = 5;

  useEffect(() => {
    const handleWheel = (event) => {
      event.preventDefault(); // Empêche le scroll natif
      scrollAngle.current += event.deltaY * 0.005;
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useFrame(() => {
    const angle = scrollAngle.current;
    camera.position.x = target.x + radius * Math.sin(angle);
    // camera.position.y = target.y + radius * Math.sin(angle * 0.3);
    camera.position.z = target.z + radius * Math.cos(angle);
    camera.lookAt(target);
  });
  return null;
} 