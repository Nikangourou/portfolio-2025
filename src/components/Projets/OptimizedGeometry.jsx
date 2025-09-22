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
export const AnimatedMesh = ({ children, projectId, ...props }) => {
  const [isHovered, setIsHovered] = useState(false)
  const [pushDirection, setPushDirection] = useState(0)
  
  // États du store et configuration
  const selectedProject = useStore((state) => state.selectedProject)
  const isArrangementAnimationComplete = useStore((state) => state.isArrangementAnimationComplete)
  const currentPage = useStore((state) => state.currentPage)
  const gridConfig = useGridConfig()
  
  // Mémoiser les calculs qui dépendent rarement de changements
  const maxPage = useMemo(() => selectedProject?.contents?.length, [selectedProject?.contents?.length])
  
  const isNavigationElement = useMemo(() => {
    return isArrangementAnimationComplete && selectedProject && (
      projectId === gridConfig.crossPosition ||
      (projectId === gridConfig.arrowUpPosition && currentPage > 1) ||
      (projectId === 14 && currentPage < maxPage)
    )
  }, [isArrangementAnimationComplete, selectedProject, projectId, gridConfig.crossPosition, gridConfig.arrowUpPosition, currentPage, maxPage])
  
  const isBorder = useMemo(() => {
    return projectId && projectId.toString().startsWith('border-')
  }, [projectId])
  
  // Animation avec configuration optimisée
  const targetRotationX = (isHovered && isArrangementAnimationComplete) ? pushDirection * ROTATION_MULTIPLIER : 0
  
  const { rotationX } = useSpring({
    rotationX: targetRotationX,
    config: getSpringConfig('hoverRotation')
  })
  
  // Mémoriser les gestionnaires d'événements
  const updateRotationFromEvent = useCallback((e) => {
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
    
    setPushDirection(rotationDirection)
  }, [currentPage, isBorder])
  
  const handlePointerEnter = useCallback((e) => {
    setIsHovered(true)
    document.body.style.cursor = isNavigationElement ? 'pointer' : 'default'
    
    if (isArrangementAnimationComplete) {
      updateRotationFromEvent(e)
    }
  }, [isNavigationElement, isArrangementAnimationComplete, updateRotationFromEvent])
  
  const handlePointerMove = useCallback((e) => {
    if (isHovered && isArrangementAnimationComplete) {
      updateRotationFromEvent(e)
    }
  }, [isHovered, isArrangementAnimationComplete, updateRotationFromEvent])
  
  const handlePointerOut = useCallback((e) => {
    setIsHovered(false)
    setPushDirection(0)
    document.body.style.cursor = 'default'
  }, [])
  
  return (
    <animated.group
      {...props}
      rotation-x={rotationX}
      onPointerOver={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
    >
      {children}
    </animated.group>
  )
}
