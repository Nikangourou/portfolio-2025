import React, { useMemo, useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import Project from './Project'
import projectsData from '../../data/projects.json'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores/store'
import useThemeStore from '@/stores/themeStore'
import ProjectInfoFloating from '../Interface/ProjectInfoFloating'

export default function Projects() {
  return <ProjectsContent />
}

function ProjectsContent() {
  const groupRef = useRef(null)
  const { camera, raycaster, pointer, scene } = useThree()
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const isArrangementAnimationComplete = useStore(
    (state) => state.isArrangementAnimationComplete,
  )
  const setArrangementAnimationComplete = useStore(
    (state) => state.setArrangementAnimationComplete,
  )
  const [projectStates, setProjectStates] = useState([])
  const [targetStates, setTargetStates] = useState([])
  const [minDistance, setMinDistance] = useState(2.0)
  const [rotationY, setRotationY] = useState(Math.PI)
  const [predefinedPositions, setPredefinedPositions] = useState([])
  const [rotatingProjects, setRotatingProjects] = useState(new Set())
  const [rotatingBorders, setRotatingBorders] = useState(new Set())
  const currentTheme = useThemeStore((state) => state.currentTheme)
  const [borderStates, setBorderStates] = useState([])
  const [animatingProjects, setAnimatingProjects] = useState(new Set())
  const currentPage = useStore((state) => state.currentPage)

  // Ajout de l'état pour le projet survolé
  const [hoveredProject, setHoveredProject] = useState(null)
  const [displayedProject, setDisplayedProject] = useState(null) // Projet affiché avec délai pour l'animation
  
  // État pour savoir si on doit faire du raycasting
  const [needsRaycasting, setNeedsRaycasting] = useState(false)
  const lastMouseMoveTime = useRef(0)
  
  // Refs pour stocker les meshes des projets pour le raycasting
  const projectMeshesRef = useRef([])

  // Gérer l'affichage du projet avec animation de sortie
  useEffect(() => {
    if (hoveredProject) {
      // Projet survolé : afficher immédiatement
      setDisplayedProject(hoveredProject)
    } else {
      // Plus de projet survolé : attendre 300ms pour l'animation de sortie
      const timer = setTimeout(() => {
        setDisplayedProject(null)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [hoveredProject])

  // Nettoyer les refs quand les projets changent
  useEffect(() => {
    // Chaque projet a 2 meshes (front et back), donc on crée un array 2D
    projectMeshesRef.current = new Array(projectStates.length).fill(null).map(() => ({ front: null, back: null }))
  }, [projectStates.length])

  // Détecter quand la souris bouge pour activer le raycasting temporairement
  useEffect(() => {
    const handleMouseMove = () => {
      lastMouseMoveTime.current = Date.now()
      setNeedsRaycasting(false) // Désactiver le raycasting quand la souris bouge (les events natifs prennent le relais)
    }

    const handleWheel = (event) => {
      setNeedsRaycasting(true) // Activer le raycasting pendant les rotations
      const screenFactor = Math.min(window.innerWidth / 1920, 1)
      const delta = event.deltaY * 0.0007 * screenFactor
      setRotationY((prev) => prev + delta)
      
      // Désactiver le raycasting après 500ms sans rotation
      setTimeout(() => {
        if (Date.now() - lastMouseMoveTime.current > 500) {
          setNeedsRaycasting(false)
        }
      }, 500)
    }

    // Gestion du touch pour mobile
    let touchStartX = 0
    let touchStartY = 0
    let touchStartTime = 0

    const handleTouchStart = (event) => {
      touchStartX = event.touches[0].clientX
      touchStartY = event.touches[0].clientY
      touchStartTime = Date.now()
    }

    const handleTouchMove = (event) => {
      event.preventDefault() // Empêcher le scroll par défaut
      const touchCurrentX = event.touches[0].clientX
      const touchCurrentY = event.touches[0].clientY
      const deltaX = touchStartX - touchCurrentX
      const deltaY = touchStartY - touchCurrentY
      const touchTime = Date.now() - touchStartTime
      
      // Utiliser le plus grand mouvement (horizontal ou vertical)
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
      
      // Calculer la vitesse du mouvement tactile
      const velocity = Math.abs(delta) / Math.max(touchTime, 1)
      const scaledDelta = delta * 0.02 * Math.min(velocity / 5, 2) // Augmenté de 0.003 à 0.008 et velocity/10 à velocity/5
      
      setNeedsRaycasting(true)
      const screenFactor = Math.min(window.innerWidth / 1920, 1)
      setRotationY((prev) => prev + scaledDelta * screenFactor)
      
      touchStartX = touchCurrentX
      touchStartY = touchCurrentY
      touchStartTime = Date.now()
    }

    const handleTouchEnd = () => {
      setTimeout(() => {
        setNeedsRaycasting(false)
      }, 500)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  // Fonction pour gérer le hover avec transition forcée
  const handleProjectHover = (project) => {
    // Toujours mettre à jour directement, ProjectInfoFloating gère les transitions
    setHoveredProject(project)
  }

  const distance = -5
  const baseSpeed = 3
  const cols = 5
  const rows = 3
  const gap = 0.005
  const margin = 0.5

  const projectSize = 1
  const width = projectSize
  const height = projectSize

  // Calcul dynamique de arrangedDistance
  const calculateArrangedDistance = () => {
    const totalWidth = width * cols + gap * (cols - 1)
    const totalHeight = height * rows + gap * (rows - 1)
    const fov = camera.fov * (Math.PI / 180)
    const aspect = camera.aspect

    const distanceForWidth =
      Math.max(totalWidth / aspect, totalHeight) / (2 * Math.tan(fov / 2)) +
      margin

    const distanceForHeight =
      Math.max(totalHeight, totalWidth / aspect) / (2 * Math.tan(fov / 2)) +
      margin

    const distanceMax = Math.max(distanceForWidth, distanceForHeight)

    return -distanceMax - distance
  }

  // Positions prédéfinies pour l'arrangement
  const calculatePredefinedPositions = (arrangedDistance) => {
    const positions = []
    const totalProjects = projectsData.projects.length

    // Calculer la taille totale de la grille
    const totalWidth = width * cols + gap * (cols - 1)
    const totalHeight = height * rows + gap * (rows - 1)

    for (let i = 0; i < totalProjects; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = col * (width + gap) - totalWidth / 2 + width / 2
      const y = -(row * (height + gap)) + totalHeight / 2 - height / 2
      positions.push([x, y, arrangedDistance])
    }

    // Stocker la taille des projets pour l'utiliser dans le composant Projet
    window.projectSize = { width, height }

    return positions
  }

  const calculateBorderPositions = (arrangedDistance) => {
    const positions = []

    // Créer une bordure plus large
    const borderSize = 2 // Nombre de carrés de bordure de chaque côté

    // Calculer les dimensions de la grille totale (projets + bordure)
    const totalCols = cols + borderSize * 2
    const totalRows = rows + borderSize * 2
    const totalWidth = totalCols * width + (totalCols - 1) * gap
    const totalHeight = totalRows * height + (totalRows - 1) * gap

    // Calculer les positions de départ pour centrer la grille
    const startX = -totalWidth / 2 + width / 2
    const startY = totalHeight / 2 - height / 2

    // Créer la grille de carrés
    for (let row = 0; row < totalRows; row++) {
      for (let col = 0; col < totalCols; col++) {
        const x = startX + col * (width + gap)
        const y = startY - row * (height + gap)

        // Vérifier si la position est dans la zone des projets
        const isInProjectArea =
          col >= borderSize &&
          col < borderSize + cols &&
          row >= borderSize &&
          row < borderSize + rows

        if (!isInProjectArea) {
          positions.push([x, y, arrangedDistance])
        }
      }
    }

    return positions
  }

  useEffect(() => {
    const dist = calculateArrangedDistance()
    setPredefinedPositions(calculatePredefinedPositions(dist))
    // Initialiser les états des carrés de bordure
    const borderPositions = calculateBorderPositions(dist)
    setBorderStates(
      borderPositions.map((pos) => ({
        position: pos,
        rotation: [0, 0, 0],
      })),
    )
  }, [camera, isProjectsArranged])

  // Gérer le redimensionnement de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      // Recalculer les positions quand la fenêtre est redimensionnée
      const dist = calculateArrangedDistance()
      setPredefinedPositions(calculatePredefinedPositions(dist))
      
      // Recalculer les bordures
      const borderPositions = calculateBorderPositions(dist)
      setBorderStates(
        borderPositions.map((pos) => ({
          position: pos,
          rotation: [0, 0, 0],
        })),
      )

      // Si on est en mode arrangé, mettre à jour les positions cibles immédiatement
      if (isProjectsArranged && predefinedPositions.length > 0) {
        setTargetStates((prevStates) =>
          prevStates.map((state, index) => ({
            ...state,
            position: calculatePredefinedPositions(dist)[index] || state.position,
          }))
        )
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isProjectsArranged, predefinedPositions.length])

  const findValidPosition = (positions, maxAttempts = 100) => {
    const xRange = [-2, 2]
    const yRange = [-2, 2]
    const zRange = [-2, 2]

    let attempts = 0
    let position
    let currentMinDistance = minDistance

    do {
      position = [
        Math.random() * (xRange[1] - xRange[0]) + xRange[0],
        Math.random() * (yRange[1] - yRange[0]) + yRange[0],
        Math.random() * (zRange[1] - zRange[0]) + zRange[0],
      ]
      attempts++

      if (attempts > maxAttempts) {
        // Si on n'a pas trouvé de position valide après plusieurs tentatives,
        // on augmente légèrement la distance minimale
        currentMinDistance *= 0.9
        setMinDistance(currentMinDistance)
        attempts = 0
      }
    } while (
      positions.some((existingPos) => {
        const dx = position[0] - existingPos[0]
        const dy = position[1] - existingPos[1]
        const dz = position[2] - existingPos[2]
        return Math.sqrt(dx * dx + dy * dy + dz * dz) < currentMinDistance
      })
    )

    return position
  }

  useEffect(() => {
    if (!isProjectsArranged) {
      const newPositions = []
      const newTargetStates = projectStates.map((state) => {
        const newPosition = findValidPosition(newPositions)
        newPositions.push(newPosition)

        return {
          ...state,
          position: newPosition,
          rotation: [
            // Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
            Math.random() * Math.PI * 0.5 - Math.PI * 1.25,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 0.5 - Math.PI * 0.25,
          ],
          pageRotationX: 0,
          targetPageRotationX: 0,
        }
      })
      setTargetStates(newTargetStates)
      setRotatingProjects(new Set())
      setRotatingBorders(new Set())
      setAnimatingProjects(new Set())
      setArrangementAnimationComplete(false)
    } else {
      // Animation séquentielle pour éviter les superpositions
      setAnimatingProjects(new Set())

      // Définir les positions cibles immédiatement
      setTargetStates(
        predefinedPositions.map((pos, index) => ({
          ...projectStates[index],
          position: pos,
          rotation: [0, 0, 0],
          pageRotationX: 0,
          targetPageRotationX: 0,
        })),
      )

      // Créer un ordre aléatoire pour l'animation
      const randomOrder = Array.from(
        { length: projectStates.length },
        (_, i) => i,
      ).sort(() => Math.random() - 0.5)

      // Démarrer l'animation des projets dans un ordre aléatoire
      randomOrder.forEach((projectIndex, animationIndex) => {
        setTimeout(() => {
          setAnimatingProjects((prev) => new Set([...prev, projectIndex]))
        }, animationIndex * 100) // 100ms de délai entre chaque projet
      })

      // Attendre que tous les projets aient commencé leur animation
      const totalAnimationTime = projectStates.length * 100 
      setTimeout(() => {
        setArrangementAnimationComplete(true)
      }, totalAnimationTime)
    }
  }, [isProjectsArranged])

  // Effet pour gérer les rotations une fois l'animation terminée
  useEffect(() => {
    if (isArrangementAnimationComplete) {
     
      const allProjectIndices = new Set()
      projectStates.forEach((_, index) => {
        allProjectIndices.add(index)
      })
      setRotatingProjects(allProjectIndices)

      const borderPositions = calculateBorderPositions(
        calculateArrangedDistance(),
      )
      const allBorderIndices = new Set()
      borderPositions.forEach((_, index) => {
        allBorderIndices.add(index)
      })
      setRotatingBorders(allBorderIndices)
    }
  }, [isArrangementAnimationComplete])

  useFrame((state, delta) => {
    if (projectStates.length > 0 && targetStates.length > 0) {
      // Calculer la vitesse adaptée au delta time
      const adaptiveSpeed = Math.min(baseSpeed * delta, 0.1) // Limiter à 0.1 pour éviter les sauts

      setProjectStates((prevStates) => {
        return prevStates.map((state, index) => {
          const target = targetStates[index]

          // Si le projet n'est pas encore en cours d'animation, garder sa position actuelle
          if (isProjectsArranged && !animatingProjects.has(index)) {
            return state
          }

          // Interpolation linéaire pour la position avec une vitesse adaptée
          const newX = THREE.MathUtils.lerp(
            state.position[0],
            target.position[0],
            adaptiveSpeed,
          )
          const newY = THREE.MathUtils.lerp(
            state.position[1],
            target.position[1],
            adaptiveSpeed,
          )
          const newZ = THREE.MathUtils.lerp(
            state.position[2],
            target.position[2],
            adaptiveSpeed,
          )

          // Rotation cible basée sur si le projet doit tourner
          const targetRotation = rotatingProjects.has(index)
            ? [Math.PI, 0, 0]
            : target.rotation

          // Interpolation avec chemin le plus court pour chaque axe
          const getShortestRotationPath = (current, target) => {
            const normalizedCurrent = ((current + Math.PI) % (2 * Math.PI)) - Math.PI
            const normalizedTarget = ((target + Math.PI) % (2 * Math.PI)) - Math.PI
            
            let shortestPath = normalizedTarget - normalizedCurrent
            if (Math.abs(shortestPath) > Math.PI) {
              shortestPath = shortestPath > 0 
                ? shortestPath - 2 * Math.PI 
                : shortestPath + 2 * Math.PI
            }
            return current + shortestPath * adaptiveSpeed
          }

          const newRotX = getShortestRotationPath(state.rotation[0], targetRotation[0])
          const newRotY = getShortestRotationPath(state.rotation[1], targetRotation[1])
          const newRotZ = getShortestRotationPath(state.rotation[2], targetRotation[2])

          // Interpolation pour la rotation X de page
          let newPageRotationX = state.pageRotationX
          if (
            typeof state.targetPageRotationX === 'number' &&
            Math.abs(state.pageRotationX - state.targetPageRotationX) > 0.01
          ) {
            newPageRotationX = THREE.MathUtils.lerp(
              state.pageRotationX,
              state.targetPageRotationX,
              adaptiveSpeed,
            )
          } else if (typeof state.targetPageRotationX === 'number') {
            newPageRotationX = state.targetPageRotationX
          }

          return {
            ...state,
            position: [newX, newY, newZ],
            rotation: [newRotX, newRotY, newRotZ],
            pageRotationX: newPageRotationX,
            targetPageRotationX: state.targetPageRotationX,
          }
        })
      })

      // Animation des carrés de bordure
      setBorderStates((prevStates) => {
        return prevStates.map((state, index) => {
          const targetRotation = rotatingBorders.has(index)
            ? [Math.PI, 0, 0]
            : [0, 0, 0]

          // Interpolation linéaire pour la rotation
          const newRotX = THREE.MathUtils.lerp(
            state.rotation[0],
            targetRotation[0],
            adaptiveSpeed,
          )
          const newRotY = THREE.MathUtils.lerp(
            state.rotation[1],
            targetRotation[1],
            adaptiveSpeed,
          )
          const newRotZ = THREE.MathUtils.lerp(
            state.rotation[2],
            targetRotation[2],
            adaptiveSpeed,
          )

          return {
            ...state,
            rotation: [newRotX, newRotY, newRotZ],
          }
        })
      })
    }

    // Gestion de la rotation du groupe
    if (groupRef.current) {
      const currentRotation = groupRef.current.rotation.y
      const targetRotation = isProjectsArranged ? 0 : rotationY

      // Normaliser les rotations entre -π et π
      const normalizedCurrent =
        ((currentRotation + Math.PI) % (2 * Math.PI)) - Math.PI
      const normalizedTarget =
        ((targetRotation + Math.PI) % (2 * Math.PI)) - Math.PI

      // Trouver le chemin le plus court vers la rotation cible
      let shortestPath = normalizedTarget - normalizedCurrent
      if (Math.abs(shortestPath) > Math.PI) {
        shortestPath =
          shortestPath > 0
            ? shortestPath - 2 * Math.PI
            : shortestPath + 2 * Math.PI
      }

      const adaptiveSpeed = Math.min(baseSpeed * delta, 0.1)
      groupRef.current.rotation.y =
        currentRotation + shortestPath * adaptiveSpeed
    }

    // Raycasting pour détecter le projet sous le curseur quand les objets bougent
    // SEULEMENT quand c'est nécessaire (rotation, etc.) pour optimiser les performances
    if (!isProjectsArranged && needsRaycasting && projectMeshesRef.current.length > 0 && groupRef.current) {
      // Créer un raycaster temporaire pour éviter les conflits
      const tempRaycaster = new THREE.Raycaster()
      tempRaycaster.setFromCamera(pointer, camera)
      
      // Obtenir tous les meshes valides (front ET back) avec leurs index de projet
      const allMeshes = []
      
      projectMeshesRef.current.forEach((projectMeshes, projectIndex) => {
        if (projectMeshes.front && projectMeshes.front.parent) {
          projectMeshes.front.updateMatrixWorld(true)
          allMeshes.push({ mesh: projectMeshes.front, projectIndex })
        }
        if (projectMeshes.back && projectMeshes.back.parent) {
          projectMeshes.back.updateMatrixWorld(true)
          allMeshes.push({ mesh: projectMeshes.back, projectIndex })
        }
      })

      if (allMeshes.length > 0) {
        const intersects = tempRaycaster.intersectObjects(
          allMeshes.map(item => item.mesh), 
          false
        )
        
        if (intersects.length > 0) {
          // Trouver l'index du projet du mesh intersecté
          const intersectedMesh = intersects[0].object
          const meshData = allMeshes.find(item => item.mesh === intersectedMesh)
          
          if (meshData && projectStates[meshData.projectIndex]) {
            const project = projectStates[meshData.projectIndex].project
            if (!hoveredProject || hoveredProject.id !== project.id) {
              handleProjectHover(project)
            }
          }
        } else {
          // Aucun projet sous le curseur
          if (hoveredProject) {
            setHoveredProject(null)
          }
        }
      }
    }
  })

  const projectPositions = useMemo(() => {
    const totalProjects = projectsData.projects.length

    // Définir les limites de la zone de placement
    const xRange = [-width / 4, width / 4]
    const yRange = [-height / 4, height / 4]
    const zRange = [10, 10]

    let minDistance = 1.0

    const isPositionValid = (newPos, existingPositions) => {
      return !existingPositions.some((existingPos) => {
        const dx = newPos[0] - existingPos[0]
        const dy = newPos[1] - existingPos[1]
        const dz = newPos[2] - existingPos[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        return distance < minDistance
      })
    }

    const positions = []
    const maxAttempts = 100

    for (let i = 0; i < totalProjects; i++) {
      let attempts = 0
      let position

      do {
        position = [
          Math.random() * (xRange[1] - xRange[0]) + xRange[0],
          Math.random() * (yRange[1] - yRange[0]) + yRange[0],
          Math.random() * (zRange[1] - zRange[0]) + zRange[0],
        ]
        attempts++

        if (attempts > maxAttempts) {
          minDistance *= 0.9
          attempts = 0
        }
      } while (!isPositionValid(position, positions))

      positions.push(position)
    }

    // Initialiser les états des projets
    const initialStates = projectsData.projects.map((project, index) => {
      const position = positions[index]
      const rotationX = Math.random() * Math.PI * 2
      const rotationY = Math.random() * Math.PI * 2
      const rotationZ = Math.random() * Math.PI * 2

      return {
        position,
        rotation: [rotationX, rotationY, rotationZ],
        project,
        pageRotationX: (currentPage - 1) * Math.PI,
        targetPageRotationX: (currentPage - 1) * Math.PI,
        pageRotationDelay: Math.random() * 0.5,
      }
    })

    setProjectStates(initialStates)

    return initialStates
  }, [camera])

  // Initialiser la rotation du groupe au montage du composant
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = rotationY
    }
  }, [])

  useEffect(() => {
    projectStates.forEach((state, i) => {
      setTimeout(() => {
        setProjectStates((prev) =>
          prev.map((s, j) =>
            j === i
              ? { ...s, targetPageRotationX: (currentPage - 1) * Math.PI }
              : s,
          ),
        )
      }, (state.pageRotationDelay || 0) * 1000)
    })
  }, [currentPage])

  return (
    <>
      {/* Carrés autour des projets */}
      {isProjectsArranged && (
        <group position={[0, 0, distance]}>
          {borderStates.map((state, index) => (
            <mesh
              key={`square-${index}`}
              position={state.position}
              rotation={state.rotation}
            >
              <planeGeometry args={[width, height]} />
              <meshBasicMaterial
                side={THREE.BackSide}
                color={currentTheme.background}
                opacity={0.2}
                transparent={true}
              />
            </mesh>
          ))}
        </group>
      )}

      {!isProjectsArranged && displayedProject && (
        <ProjectInfoFloating project={displayedProject} isVisible={!!hoveredProject} />
      )}

      <group ref={groupRef} position={[0, 0, distance]}>
        {projectStates.map((state, i) => (
          <Project
            key={state.project.id}
            ref={(el) => {
              if (el?.frontMeshRef?.current && el?.backMeshRef?.current) {
                // S'assurer que l'objet existe
                if (!projectMeshesRef.current[i]) {
                  projectMeshesRef.current[i] = { front: null, back: null }
                }
                // Assigner les deux meshes
                projectMeshesRef.current[i].front = el.frontMeshRef.current
                projectMeshesRef.current[i].back = el.backMeshRef.current
              }
            }}
            gridPosition={i}
            position={state.position}
            rotation={[
              state.rotation[0] + (state.pageRotationX || 0),
              state.rotation[1],
              state.rotation[2],
            ]}
            camera={camera}
            image={state.project.cover}
            project={state.project}
            onProjectHover={() => handleProjectHover(state.project)}
            onProjectUnhover={() => setHoveredProject(null)}
          />
        ))}
      </group>
    </>
  )
}
