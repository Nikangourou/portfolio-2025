import { useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { useSpring, animated } from '@react-spring/three'
import { useStore } from '@/stores/store'
import { useGridConfig } from '@/hooks/useGridConfig'
import { getSpringConfig } from '@/utils/springConfig'

// Géométrie unique cachée
let cachedGeometry = null

export const getCachedGeometry = () => {
  if (!cachedGeometry) {
    const { projectSize } = useProjectPositionsStore.getState()
    cachedGeometry = new THREE.PlaneGeometry(projectSize.width, projectSize.height)
  }
  
  return cachedGeometry
}

// Constantes pour optimiser les performances
const ROTATION_MULTIPLIER = 0.5

// Composant wrapper pour l'animation de hover
export const AnimatedMesh = ({ children, projectId, onClick, ...props }) => {
  // Tous les hooks doivent être appelés avant tout return conditionnel
  const isProjectsArranged = useStore((state) => state.isProjectsArranged)
  const [isHovered, setIsHovered] = useState(false)
  const [pushDirection, setPushDirection] = useState(0)
  const [clickCount, setClickCount] = useState(0) // Compteur pour permettre les clics multiples
  const [clickDirection, setClickDirection] = useState(1) // Direction du clic (1 ou -1)
  const selectedProject = useStore((state) => state.selectedProject)
  const currentPage = useStore((state) => state.currentPage)
  const gridConfig = useGridConfig()
  
  // Mémoiser les calculs qui dépendent rarement de changements
  const maxPage = useMemo(() => selectedProject?.contents?.length, [selectedProject?.contents?.length])
  
  const isNavigationElement = useMemo(() => {
    return selectedProject && (
      projectId === gridConfig.crossPosition ||
      (projectId === gridConfig.arrowUpPosition && currentPage > 1) ||
      (projectId === 14 && currentPage < maxPage)
    )
  }, [selectedProject, projectId, gridConfig.crossPosition, gridConfig.arrowUpPosition, currentPage, maxPage])
  
  const isBorder = useMemo(() => {
    return projectId && projectId.toString().startsWith('border-')
  }, [projectId])
  
  // Animations séparées pour hover et clic
  const targetHoverRotationX = (isHovered && isProjectsArranged && clickCount === 0) ? pushDirection * ROTATION_MULTIPLIER : 0
  const targetClickRotationX = (clickCount > 0 && isProjectsArranged) ? clickCount * Math.PI * 2 * clickDirection : 0 // Direction basée sur le clic
  
  const { hoverRotationX } = useSpring({
    hoverRotationX: targetHoverRotationX,
    config: getSpringConfig('hoverRotation')
  })
  
  const { clickRotationX } = useSpring({
    clickRotationX: targetClickRotationX,
    config: getSpringConfig('clickRotation'),
    onRest: () => {
      if (clickCount > 0) {
        setClickCount(0) // Reset après l'animation
      }
    }
  })
  
  // Combiner les rotations (priorité au clic)
  const finalRotationX = clickCount > 0 ? clickRotationX : hoverRotationX
  
  // Fonction pour calculer la direction basée sur la position de clic/hover
  const calculateRotationDirection = useCallback((e) => {
    // Méthode alternative : utiliser les coordonnées du canvas
    const canvas = e.target.offsetParent || document.querySelector('canvas')
    const rect = canvas ? canvas.getBoundingClientRect() : { 
      top: 0, 
      height: window.innerHeight, 
      left: 0, 
      width: window.innerWidth 
    }

    // Calculer la position relative Y
    let relativeY
    if (e.uv) {
      // e.uv.y va de 0 (bas) à 1 (haut), on le convertit en -1 (bas) à 1 (haut)
      relativeY = (e.uv.y * 2) - 1
    } else {
      // Fallback avec les coordonnées du canvas
      relativeY = ((e.clientY - rect.top) / rect.height) * 2 - 1
    }
    
    // Calculer la direction de rotation
    let rotationDirection = relativeY
    
    if (!isBorder) {
      // Inverser l'animation sur les pages paires seulement pour les vrais projets
      const isEvenPage = currentPage % 2 === 0
      rotationDirection = isEvenPage ? -relativeY : relativeY
    }
    
    return rotationDirection
  }, [currentPage, isBorder])
  
  // Mémoriser les gestionnaires d'événements
  const updateRotationFromEvent = useCallback((e) => {
    if (!isProjectsArranged) return
    
    const rotationDirection = calculateRotationDirection(e)
    setPushDirection(rotationDirection)
  }, [isProjectsArranged, calculateRotationDirection])
  
  const handlePointerEnter = useCallback((e) => {
    setIsHovered(true)
    document.body.style.cursor = isNavigationElement ? 'pointer' : 'default'
    updateRotationFromEvent(e)
  }, [isNavigationElement, updateRotationFromEvent])
  
  const handlePointerMove = useCallback((e) => {
    if (isHovered) {
      updateRotationFromEvent(e)
    }
  }, [isHovered, updateRotationFromEvent])
  
  const handlePointerOut = useCallback((e) => {
    setIsHovered(false)
    setPushDirection(0)
    document.body.style.cursor = 'default'
  }, [])
  
  const handleClick = useCallback((e) => {
    // Pour les éléments de navigation, appeler directement onClick
    if (isNavigationElement && onClick) {
      onClick(e)
      return
    }
    
    // Animation de clic pour les projets arrangés
    if (isProjectsArranged) {
      // Calculer la direction basée sur la position du clic
      const rotationDirection = calculateRotationDirection(e)
      
      // Définir la direction (positif ou négatif) basée sur la position
      const direction = rotationDirection >= 0 ? 1 : -1
      setClickDirection(direction)
      
      setClickCount(prev => prev + 1) // Incrémenter pour relancer l'animation
      
      // Ne pas propager l'événement pour éviter les conflits
      e.stopPropagation()
    } else if (onClick) {
      // Si pas arrangé, appeler onClick normalement
      onClick(e)
    }
  }, [isProjectsArranged, calculateRotationDirection, isNavigationElement, onClick])
  
  // Si les projets ne sont pas arrangés, rendu simple sans animation
  if (!isProjectsArranged) {
    return (
      <group {...props} onClick={onClick}>
        {children}
      </group>
    )
  }


  return (
    <animated.group
      {...props}
      rotation-x={finalRotationX}
      onPointerOver={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      {children}
    </animated.group>
  )
}
