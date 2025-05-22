import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import Project from './Project';
import projectsData from '../../data/projects.json';
import { useFrame } from '@react-three/fiber';
import { useStore } from '../../stores/store';

export default function Projects() {
  return <ProjectsContent />;
}

function ProjectsContent() {
  const groupRef = useRef(null);
  const { camera } = useThree();
  const isProjectsArranged = useStore((state) => state.isProjectsArranged);
  const setProjectsArranged = useStore((state) => state.setProjectsArranged);
  const setSelectedProject = useStore((state) => state.setSelectedProject);
  const isArrangementAnimationComplete = useStore((state) => state.isArrangementAnimationComplete);
  const setArrangementAnimationComplete = useStore((state) => state.setArrangementAnimationComplete);
  const [projectStates, setProjectStates] = useState([]);
  const [targetStates, setTargetStates] = useState([]);
  const [minDistance, setMinDistance] = useState(2.0); 
  const [rotationY, setRotationY] = useState(0);
  const [predefinedPositions, setPredefinedPositions] = useState([]);
  const [rotatingProjects, setRotatingProjects] = useState(new Set());

  const distance = -5;
  const speed = 0.05;
  const cols = 5;
  const rows = 3;
  const gap = 0.005;
  const margin = 0.5; 
  
  const projectSize = 1;
  const width = projectSize;
  const height = projectSize;

  // Calcul dynamique de arrangedDistance
  const calculateArrangedDistance = () => {
    const totalWidth = (width * cols) + (gap * (cols - 1));
    const totalHeight = (height * rows) + (gap * (rows - 1));
    const fov = camera.fov * (Math.PI / 180);
    const aspect = camera.aspect;
    
    const distanceForWidth = Math.max(
      totalWidth / aspect,
      totalHeight
    ) / (2 * Math.tan(fov / 2)) + margin;

    const distanceForHeight = Math.max(
      totalHeight,
      totalWidth / aspect
    ) / (2 * Math.tan(fov / 2)) + margin;

    const distanceMax = Math.max(distanceForWidth, distanceForHeight);
        
    return - distanceMax - distance;
  };

  // Créer la géométrie de la grille
  const gridGeometry = useMemo(() => {
    const totalWidth = (width * cols) + (gap * (cols - 1));
    const totalHeight = (height * rows) + (gap * (rows - 1));
    const halfWidth = totalWidth / 2;
    const halfHeight = totalHeight / 2;
    const arrangedDistance = calculateArrangedDistance();

    // Calculer une taille suffisamment grande pour atteindre les bords de l'écran
    const screenSize = 100; // Taille arbitrairement grande pour couvrir l'écran

    // Créer les lignes horizontales
    const horizontalLines = [];
    for (let i = 0; i <= rows; i++) {
      const y = -halfHeight + (i * (height + gap));
      horizontalLines.push({
        position: [0, y - (gap / 2), arrangedDistance],
        size: [screenSize, gap]
      });
    }

    // Créer les lignes verticales
    const verticalLines = [];
    for (let i = 0; i <= cols; i++) {
      const x = -halfWidth + (i * (width + gap));
      verticalLines.push({
        position: [x - (gap / 2), 0, arrangedDistance],
        size: [gap, screenSize]
      });
    }

    return [...horizontalLines, ...verticalLines];
  }, [cols, rows, width, height, gap, camera]);

  // Positions prédéfinies pour l'arrangement
  const calculatePredefinedPositions = (arrangedDistance) => {
    const positions = [];
    const totalProjects = projectsData.projects.length;
    
    // Calculer la taille totale de la grille
    const totalWidth = (width * cols) + (gap * (cols - 1));
    const totalHeight = (height * rows) + (gap * (rows - 1));
    
    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = (col * (width + gap)) - (totalWidth / 2) + (width / 2);
      const y = -(row * (height + gap)) + (totalHeight / 2) - (height / 2);
      positions.push([x, y, arrangedDistance]);
    }
    
    // Stocker la taille des projets pour l'utiliser dans le composant Projet
    window.projectSize = { width, height };
    
    return positions;
  };

  useEffect(() => {
    const dist = calculateArrangedDistance();
    setPredefinedPositions(calculatePredefinedPositions(dist));
  }, [camera, isProjectsArranged]);

  const findValidPosition = (positions, maxAttempts = 100) => {

    const xRange = [-2, 2];
    const yRange = [-2, 2];
    const zRange = [-2, 2];
    
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
            Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
          ]
        };
      });
      setTargetStates(newTargetStates);
      setRotatingProjects(new Set());
      setArrangementAnimationComplete(false);
    } else {
      setTargetStates(predefinedPositions.map((pos, index) => ({
        ...projectStates[index],
        position: pos,
        rotation: [0, 0, 0]
      })));
      
      // Attendre une seconde avant de marquer l'animation comme terminée
      setTimeout(() => {
        setArrangementAnimationComplete(true);
      }, 1100);
    }
  }, [isProjectsArranged]);

  // Effet pour gérer les rotations une fois l'animation terminée
  useEffect(() => {
    if (isArrangementAnimationComplete) {
      projectStates.forEach((_, index) => {
        const randomDelay = Math.random() * 1000 + 1000; // Entre 1000ms et 2000ms
        setTimeout(() => {
          setRotatingProjects(prev => new Set([...prev, index]));
        }, randomDelay);
      });
    }
  }, [isArrangementAnimationComplete]);

  useFrame(() => {
    if (projectStates.length > 0 && targetStates.length > 0) {
      setProjectStates(prevStates => {
        return prevStates.map((state, index) => {
          const target = targetStates[index];
          
          // Interpolation linéaire pour la position avec un facteur de 0.05 pour une transition plus douce
          const newX = THREE.MathUtils.lerp(state.position[0], target.position[0], speed);
          const newY = THREE.MathUtils.lerp(state.position[1], target.position[1], speed);
          const newZ = THREE.MathUtils.lerp(state.position[2], target.position[2], speed);
          
          // Rotation cible basée sur si le projet doit tourner
          const targetRotation = rotatingProjects.has(index) ? [Math.PI, 0, 0] : target.rotation;
          
          // Interpolation linéaire pour la rotation
          const newRotX = THREE.MathUtils.lerp(state.rotation[0], targetRotation[0], speed);
          const newRotY = THREE.MathUtils.lerp(state.rotation[1], targetRotation[1], speed);
          const newRotZ = THREE.MathUtils.lerp(state.rotation[2], targetRotation[2], speed);
          
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
      };
    });
    
    setProjectStates(initialStates);
    
    return initialStates;
  }, [camera]);

  const handleProjectClick = (index) => {
    if (!isProjectsArranged) {
    setProjectsArranged(!isProjectsArranged);
    setSelectedProject(projectsData.projects[index]);
    }
  };

  useEffect(() => {
    const handleWheel = (event) => {
      // Utiliser deltaY pour la direction et la vitesse du scroll
      const delta = event.deltaY * 0.001; // Ajuster la sensibilité ici
      setRotationY(prev => prev + delta);
    };

    window.addEventListener('wheel', handleWheel);
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useFrame(() => {
    if (groupRef.current) {
      const currentRotation = groupRef.current.rotation.y;
      const targetRotation = isProjectsArranged ? 0 : rotationY;
      
      // Normaliser les rotations entre -π et π
      const normalizedCurrent = ((currentRotation + Math.PI) % (2 * Math.PI)) - Math.PI;
      const normalizedTarget = ((targetRotation + Math.PI) % (2 * Math.PI)) - Math.PI;
      
      // Trouver le chemin le plus court vers la rotation cible
      let shortestPath = normalizedTarget - normalizedCurrent;
      if (Math.abs(shortestPath) > Math.PI) {
        shortestPath = shortestPath > 0 
          ? shortestPath - 2 * Math.PI 
          : shortestPath + 2 * Math.PI;
      }
      
      groupRef.current.rotation.y = currentRotation + shortestPath * speed;
    }
  });

  return (  
    <>
      {/* Grille fixe */}
      <group position={[0, 0, distance + 1]} scale={0.8}>
        {gridGeometry.map((line, index) => (
          <mesh key={index} position={line.position}>
            <planeGeometry args={line.size} />
            <meshBasicMaterial color="grey" opacity={1} transparent />
          </mesh>
        ))}
      </group>
        
      <group ref={groupRef} position={[0, 0, distance]}>
        {projectStates.map((state, i) => (
          <Project
            key={state.project.id}
            gridPosition={i}
            position={state.position}
            rotation={state.rotation}
            onAnyClick={() => handleProjectClick(i)}
            camera={camera}
            image={state.project.cover}
          />
        ))}
      </group>
    </>
  );
} 