import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Projet from './Projet';
import projectsData from '../data/projects.json';
import { useFrame } from '@react-three/fiber';

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
  const [isArranged, setIsArranged] = useState(false);
  const [projectStates, setProjectStates] = useState([]);
  const distance = -5; // Distance pour l'état initial
  const fov = camera.fov * (Math.PI / 180);
  
  // Calculer la largeur initiale
  const width = 2 * Math.tan(fov / 2) * Math.abs(distance);
  const height = width;

  const arrangedDistance = -width / (3.8 * Math.tan(fov / 2))

  // Positions prédéfinies pour l'arrangement
  const predefinedPositions = useMemo(() => {
    const positions = [];
    const totalProjects = projectsData.projects.length;
    const rows = 2;
    const cols = 5;
    
    // Calculer la taille des projets en fonction de la hauteur de l'écran
    const gap = 0.1; // Marge entre les projets
    const totalWidth = width - gap;
  
    // Calculer la taille des projets pour utiliser toute la largeur
    const projectWidth = (totalWidth - (cols - 1) * gap) / cols;
    const projectHeight = projectWidth; // Garder un ratio carré
    
    // Ajuster les dimensions totales pour centrer correctement
    const adjustedTotalWidth = (projectWidth * cols) + (gap * (cols - 1));
    const adjustedTotalHeight = (projectHeight * rows) + (gap * (rows - 1));
    
    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = (col * (projectWidth + gap)) - (adjustedTotalWidth / 2) + (projectWidth / 2);
      const y = (row * (projectHeight + gap)) - (adjustedTotalHeight / 2) + (projectHeight / 2);
      positions.push([x, y, distance]);
    }
    
    // Stocker la taille des projets pour l'utiliser dans le composant Projet
    window.projectSize = { width: projectWidth, height: projectHeight };
    
    return positions;
  }, [distance, height, width]);

  // Animation pour déplacer les projets vers leurs positions cibles
  useFrame(() => {
    if (isArranged && projectStates.length > 0) {
      setProjectStates(prevStates => {
        return prevStates.map((state, index) => {
          const target = predefinedPositions[index];
          const currentPos = state.position;
          
          // Interpolation linéaire pour la position
          const newX = THREE.MathUtils.lerp(currentPos[0], target[0], 0.1);
          const newY = THREE.MathUtils.lerp(currentPos[1], target[1], 0.1);
          const newZ = THREE.MathUtils.lerp(currentPos[2], arrangedDistance, 0.1);
          
          // Interpolation linéaire pour la rotation
          const newRotX = THREE.MathUtils.lerp(state.rotation[0], 0, 0.1);
          const newRotY = THREE.MathUtils.lerp(state.rotation[1], 0, 0.1);
          const newRotZ = THREE.MathUtils.lerp(state.rotation[2], 0, 0.1);
          
          return {
            ...state,
            position: [newX, newY, newZ],
            rotation: [newRotX, newRotY, newRotZ]
          };
        });
      });
    }
  });

  const projectPositions = useMemo(() => {
    const totalProjects = projectsData.projects.length;
        
    // Définir les limites de la zone de placement
    const xRange = [-width/4, width/4];
    const yRange = [-height/4, height/4];
    const zRange = [distance - 2, distance + 2];
    
    let minDistance = 1.0;
    
    const isPositionValid = (newPos, existingPositions) => {
      return !existingPositions.some(existingPos => {
        const dx = newPos[0] - existingPos[0];
        const dy = newPos[1] - existingPos[1];
        const dz = newPos[2] - existingPos[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return distance < minDistance;
      });
    };
    
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
          minDistance *= 0.9;
          attempts = 0;
        }
      } while (!isPositionValid(position, positions));
      
      positions.push(position);
    }
    
    // Initialiser les états des projets
    const initialStates = projectsData.projects.map((project, index) => {
      const position = positions[index];
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
    
    setProjectStates(initialStates);
    
    return initialStates;
  }, [camera]);

  const handleProjectClick = (index) => {
    setIsArranged(!isArranged);
  };

  return (  
    <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
      <group ref={groupRef}>  
        {projectStates.map((state, i) => (
          <Projet
            key={state.project.id}
            position={state.position}
            rotation={state.rotation}
            title={state.project.title}
            description={state.project.description}
            technologies={state.project.technologies}
            link={state.project.link}
            color={state.color}
            isDynamic={false}
            onAnyClick={() => handleProjectClick(i)}
            camera={camera}
          />
        ))}
      </group>
    </group>
  );
} 