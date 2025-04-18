import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Projet from './Projet';
import projectsData from '../data/projects.json';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../stores/store';

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
  const isProjectsArranged = useStore((state) => state.isProjectsArranged);
  const setProjectsArranged = useStore((state) => state.setProjectsArranged);
  const [projectStates, setProjectStates] = useState([]);
  const [targetStates, setTargetStates] = useState([]);
  const [minDistance, setMinDistance] = useState(2.0); // Distance minimale entre les projets
  const distance = -5; // Distance pour l'état initial
  const fov = camera.fov * (Math.PI / 180);
  
  // Calculer la largeur initiale
  const width = 2 * Math.tan(fov / 2) * Math.abs(distance);
  const height = width;

  const arrangedDistance = -width / (3 * Math.tan(fov / 2))

  // Positions prédéfinies pour l'arrangement
  const predefinedPositions = useMemo(() => {
    const positions = [];
    const totalProjects = projectsData.projects.length;
    const rows = 3;
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
      positions.push([x, y, arrangedDistance]);
    }
    
    // Stocker la taille des projets pour l'utiliser dans le composant Projet
    window.projectSize = { width: projectWidth, height: projectHeight };
    
    return positions;
  }, [distance, height, width]);

  const checkCollision = (pos1, pos2) => {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < minDistance;
  };

  const findValidPosition = (positions, maxAttempts = 100) => {
    const xRange = [-width/4, width/4];
    const yRange = [-height/4, height/4];
    const zRange = [distance - 2, distance + 2];
    
    let attempts = 0;
    let position;
    let currentMinDistance = minDistance;
    
    do {
      position = [
        Math.random() * (xRange[1] - xRange[0]) + xRange[0],
        Math.random() * (yRange[1] - yRange[0]) + yRange[0],
        Math.random() * (zRange[1] - zRange[0]) + zRange[0]
      ];
      attempts++;
      
      if (attempts > maxAttempts) {
        // Si on n'a pas trouvé de position valide après plusieurs tentatives,
        // on augmente légèrement la distance minimale
        currentMinDistance *= 0.9;
        setMinDistance(currentMinDistance);
        attempts = 0;
      }
    } while (positions.some(existingPos => {
      const dx = position[0] - existingPos[0];
      const dy = position[1] - existingPos[1];
      const dz = position[2] - existingPos[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) < currentMinDistance;
    }));
    
    return position;
  };

  useEffect(() => {
    if (!isProjectsArranged) {
      const newPositions = [];
      const newTargetStates = projectStates.map(state => {
        const newPosition = findValidPosition(newPositions);
        newPositions.push(newPosition);
        
        return {
          ...state,
          position: newPosition,
          rotation: [
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
          ]
        };
      });
      setTargetStates(newTargetStates);
    } else {
      setTargetStates(predefinedPositions.map((pos, index) => ({
        ...projectStates[index],
        position: pos,
        rotation: [0, 0, 0]
      })));
    }
  }, [isProjectsArranged]);

  useFrame(() => {
    if (projectStates.length > 0 && targetStates.length > 0) {
      setProjectStates(prevStates => {
        return prevStates.map((state, index) => {
          const target = targetStates[index];
          
          // Interpolation linéaire pour la position avec un facteur de 0.05 pour une transition plus douce
          const newX = THREE.MathUtils.lerp(state.position[0], target.position[0], 0.05);
          const newY = THREE.MathUtils.lerp(state.position[1], target.position[1], 0.05);
          const newZ = THREE.MathUtils.lerp(state.position[2], target.position[2], 0.05);
          
          // Interpolation linéaire pour la rotation
          const newRotX = THREE.MathUtils.lerp(state.rotation[0], target.rotation[0], 0.05);
          const newRotY = THREE.MathUtils.lerp(state.rotation[1], target.rotation[1], 0.05);
          const newRotZ = THREE.MathUtils.lerp(state.rotation[2], target.rotation[2], 0.05);
          
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
    setProjectsArranged(!isProjectsArranged);
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
            image={state.project.image}
          />
        ))}
      </group>
    </group>
  );
} 