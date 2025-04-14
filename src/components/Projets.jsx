import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Projet from './Projet';
import projectsData from '../data/projects.json';

const getRandomColor = () => {
  const hue = Math.random() * 360;
  const saturation = 70 + Math.random() * 30; // 70-100%
  const lightness = 40 + Math.random() * 20; // 40-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export default function Projets() {
  return <ProjetsContent />;
}

function ProjetsContent() {
  const groupRef = useRef(null);
  const { camera } = useThree();
  
  // Calculer les limites du frustum de la caméra
  const fov = camera.fov * (Math.PI / 180); // Convertir en radians
  const aspect = window.innerWidth / window.innerHeight;
  
  // Ajuster la distance pour que les projets soient plus proches et plus grands
  const distance = -5; // Distance négative pour placer devant la caméra
  
  // Calculer les limites horizontales et verticales à cette distance
  const height = 2 * Math.tan(fov / 2) * Math.abs(distance);
  const width = height * aspect;
  
  const projectPositions = useMemo(() => {
    const totalProjects = projectsData.projects.length;
    
    // Définir les limites de la zone de placement (plus proche de la caméra)
    const xRange = [-width/3, width/3];
    const yRange = [-height/3, height/3];
    const zRange = [distance - 2, distance + 2];
    
    // Distance minimale entre les projets (réduite pour permettre plus de projets)
    let minDistance = 1.0;
    
    // Fonction pour vérifier si une position est valide (pas de collision)
    const isPositionValid = (newPos, existingPositions) => {
      return !existingPositions.some(existingPos => {
        const dx = newPos[0] - existingPos[0];
        const dy = newPos[1] - existingPos[1];
        const dz = newPos[2] - existingPos[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return distance < minDistance;
      });
    };
    
    // Générer les positions pour tous les projets
    const positions = [];
    const maxAttempts = 100;
    
    for (let i = 0; i < totalProjects; i++) {
      let attempts = 0;
      let position;
      
      do {
        position = [
          Math.random() * (xRange[1] - xRange[0]) + xRange[0],
          Math.random() * (yRange[1] - yRange[0]) + yRange[0],
          Math.random() * (zRange[1] - zRange[0]) + zRange[0]
        ];
        attempts++;
        
        if (attempts > maxAttempts) {
          // Réduire la distance minimale si on n'arrive pas à placer tous les projets
          minDistance *= 0.9;
          attempts = 0;
        }
      } while (!isPositionValid(position, positions));
      
      positions.push(position);
    }
    
    return projectsData.projects.map((project, index) => {
      const position = positions[index];
      
      // Générer des rotations aléatoires
      const rotationX = Math.random() * Math.PI * 2;
      const rotationY = Math.random() * Math.PI * 2;
      const rotationZ = Math.random() * Math.PI * 2;
      
      return {
        position,
        rotation: [rotationX, rotationY, rotationZ],
        project,
        color: getRandomColor()
      };
    });
  }, [camera, width, height, distance]);

  return (
    <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <group ref={groupRef}>
        {/* Cube de debug pour visualiser les limites */}
        <mesh position={[0, 0, distance]}>
          <boxGeometry args={[width/3 * 2, height/3 * 2, 4]} />
          <meshBasicMaterial 
            color="red" 
            wireframe={true} 
            transparent={true} 
            opacity={0.3}
          />
        </mesh>
        
        {projectPositions.map(({ position, rotation, project, color }) => (
          <Projet
            key={project.id}
            position={position}
            rotation={rotation}
            title={project.title}
            description={project.description}
            technologies={project.technologies}
            link={project.link}
            color={color}
          />
        ))}
      </group>
    </group>
  );
} 