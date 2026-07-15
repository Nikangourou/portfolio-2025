import { useRef, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useStore } from '@/stores/store'
import { useShallow } from 'zustand/react/shallow'
import styles from './Project.module.scss'
import ProjectOverlay from './ProjectOverlay'
import { useContentTexture, useContentText } from '@/utils/contentLoader'
import projectsData from '@/data/projects.json'
import { useProjectPositionsStore } from '@/stores/projectPositionsStore'
import { getCachedGeometry, AnimatedMesh } from './OptimizedGeometry'
import { getSpringConfig } from '@/utils/springConfig'
import { useGridConfig } from '@/hooks/useGridConfig'
import { useGlobalRipple } from '@/hooks/useGlobalRipple'
import { applyProjectRippleShader } from '@/utils/rippleShader'

const ARRANGED_BACK_FACE_FLIP = { x: 0.0, y: 0.0 }
const FREE_BACK_FACE_FLIP = { x: 1.0, y: 1.0 }

const getBackFaceFlip = (isProjectsArranged) => ({
  // Keep arranged/non-arranged orientation stable across shader/UV changes.
  x: isProjectsArranged ? ARRANGED_BACK_FACE_FLIP.x : FREE_BACK_FACE_FLIP.x,
  y: isProjectsArranged ? ARRANGED_BACK_FACE_FLIP.y : FREE_BACK_FACE_FLIP.y,
})

const drawNavigationIcon = (context, size, type) => {
  const center = size / 2
  context.lineCap = 'square'
  context.lineJoin = 'miter'

  if (type === 'cross') {
    const arm = size * 0.31
    context.lineWidth = Math.round(size * 0.055)
    context.beginPath()
    context.moveTo(center - arm, center - arm)
    context.lineTo(center + arm, center + arm)
    context.moveTo(center + arm, center - arm)
    context.lineTo(center - arm, center + arm)
    context.stroke()
    return
  }

  context.save()
  context.translate(center, center)
  if (type === 'arrow-down') {
    context.rotate(Math.PI)
  }

  context.lineWidth = Math.round(size * 0.05)
  const arrowScale = 1.24
  const headHalfWidth = size * 0.245 * arrowScale
  const headTopY = -size * 0.23 * arrowScale
  const headBottomY = -size * 0.01 * arrowScale
  const shaftBottomY = size * 0.27 * arrowScale
  const shaftStartY = headTopY + (context.lineWidth * 0.2)

  context.beginPath()
  context.moveTo(-headHalfWidth, headBottomY)
  context.lineTo(0, headTopY)
  context.lineTo(headHalfWidth, headBottomY)
  context.stroke()

  context.beginPath()
  context.moveTo(0, shaftStartY)
  context.lineTo(0, shaftBottomY)
  context.stroke()
  context.restore()
}

const createNavigationIconTexture = (type, color, backgroundColor) => {
  if (typeof document === 'undefined') {
    return null
  }

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  context.clearRect(0, 0, size, size)
  context.fillStyle = backgroundColor
  context.fillRect(0, 0, size, size)
  context.strokeStyle = color
  drawNavigationIcon(context, size, type)

  const iconTexture = new THREE.CanvasTexture(canvas)
  iconTexture.colorSpace = THREE.SRGBColorSpace
  iconTexture.minFilter = THREE.LinearMipmapLinearFilter
  iconTexture.magFilter = THREE.LinearFilter
  iconTexture.anisotropy = 4
  iconTexture.needsUpdate = true
  return iconTexture
}

const getNavigationIconTypeForPage = ({
  selectedProject,
  page,
  maxPage,
  gridPosition,
  gridConfig,
}) => {
  if (!selectedProject || !page || page < 1) {
    return null
  }

  if (gridPosition === gridConfig.crossPosition) {
    return 'cross'
  }

  if (maxPage <= 1) {
    return null
  }

  if (gridPosition === gridConfig.arrowUpPosition && page > 1) {
    return 'arrow-up'
  }

  if (gridPosition === gridConfig.arrowDownPosition && page < maxPage) {
    return 'arrow-down'
  }

  return null
}

const Project = forwardRef(function Project(
  { gridPosition, image, initialPosition, initialRotation },
  ref,
) {
  const pageMaterialRef = useRef(null)
  const projectRef = useRef(null)
  const pageGroupRef = useRef(null)
  const previousCurrentPageRef = useRef(1)
  const lastVisiblePageMapRef = useRef(null)
  const isPageFlipAnimatingRef = useRef(false)
  const lockedOppositeMapRef = useRef(null)

  const emptyTexture = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const placeholder = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    placeholder.colorSpace = THREE.SRGBColorSpace
    placeholder.needsUpdate = true
    return placeholder
  }, [])

  useEffect(() => {
    return () => {
      emptyTexture.dispose()
    }
  }, [emptyTexture])

  const rippleUniforms = useMemo(() => ({
    uRippleCursor: { value: new THREE.Vector2(999, 999) },
    uRippleStrength: { value: 0 },
    uRippleTint: { value: new THREE.Color('#eef4ff') },
    uFrontMap: { value: emptyTexture },
    uBackMap: { value: emptyTexture },
    uBackFlipX: { value: 1.0 },
    uBackFlipY: { value: 0.0 },
    uFrontMapTransform: { value: new THREE.Matrix3() },
    uBackMapTransform: { value: new THREE.Matrix3() },
    uTime: { value: 0 },
  }), [emptyTexture])

  // Exposer la ref du groupe principal pour le raycasting
  useImperativeHandle(ref, () => projectRef.current, [])

  const texture = useTexture(image || '', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
  })

  const [
    selectedProject,
    currentPage,
    isArrangementAnimationComplete,
    isProjectsArranged,
  ] = useStore(
    useShallow((state) => [
      state.selectedProject,
      state.currentPage,
      state.isArrangementAnimationComplete,
      state.isProjectsArranged,
    ]),
  )
  const [
    setProjectsArranged,
    setSelectedProject,
    setArrangementAnimationComplete,
    resetProjectState,
    setCurrentPage,
  ] = useStore(
    useShallow((state) => [
      state.setProjectsArranged,
      state.setSelectedProject,
      state.setArrangementAnimationComplete,
      state.resetProjectState,
      state.setCurrentPage,
    ]),
  )

  const backgroundFallbackTexture = useMemo(() => {
    const data = new Uint8Array([255, 255, 255, 255])
    const fallback = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
    fallback.colorSpace = THREE.SRGBColorSpace
    fallback.needsUpdate = true
    return fallback
  }, [])

  useEffect(() => {
    const hexColor = selectedProject?.color?.background || '#ffffff'
    const data = backgroundFallbackTexture.image?.data

    if (!data || data.length < 4) {
      return
    }

    const normalizedHex = /^#[0-9a-fA-F]{6}$/.test(hexColor) ? hexColor : '#ffffff'
    const red = parseInt(normalizedHex.slice(1, 3), 16)
    const green = parseInt(normalizedHex.slice(3, 5), 16)
    const blue = parseInt(normalizedHex.slice(5, 7), 16)

    data[0] = red
    data[1] = green
    data[2] = blue
    data[3] = 255
    backgroundFallbackTexture.needsUpdate = true
  }, [selectedProject?.color?.background, backgroundFallbackTexture])

  // Obtenir les positions d'arrangement directement depuis le store
  const { predefinedPositions, projectSize } = useProjectPositionsStore()

  // Position cible pour l'arrangement (memoized)
  const targetArrangedPosition = useMemo(() => {
    return predefinedPositions[gridPosition] || [0, 0, 0]
  }, [predefinedPositions, gridPosition])

  const applyPressureRippleShader = useCallback((material) => {
    applyProjectRippleShader(material, rippleUniforms)
  }, [rippleUniforms])

  // Delays précalculés pour éviter les recalculs
  const animationDelays = useMemo(() => ({
    arrangement: isProjectsArranged ? gridPosition * 50 : Math.random() * 500,
    pageRotation: gridPosition * 100
  }), [gridPosition, isProjectsArranged])

  // Gestion des positions et rotations avec springs - OPTIMISÉE
  const { position, rotation } = useSpring({
    from: { position: [0, 0, 20], rotation: [0, 0, 0] }, // Commencer à l'origine pour tous les projets
    to: {
      position: isProjectsArranged ? targetArrangedPosition : (initialPosition || [0, 0, 0]),
      rotation: isProjectsArranged ? [0, 0, 0] : (initialRotation || [0, 0, 0])
    },
    delay: animationDelays.arrangement,
    config: isProjectsArranged ? getSpringConfig('arrangement') : getSpringConfig('smooth'),
    onChange: (values) => {
      // Marquer l'animation comme terminée à la moitié pour le dernier projet - OPTIMISÉ
      if (isProjectsArranged && gridPosition === projectsData.projects.length - 1 && targetArrangedPosition[0] !== 0) {
        const progress = Math.abs(values.value.position[0] / targetArrangedPosition[0]);
        if (progress >= 0.7 && !isArrangementAnimationComplete) {
          setArrangementAnimationComplete(true);
        }
      }
    }
  })

  // Spring pour la rotation de page individuelle - OPTIMISÉE
  const { pageRotationX } = useSpring({
    pageRotationX: isProjectsArranged ? currentPage * Math.PI : 0,
    delay: isProjectsArranged ? animationDelays.pageRotation : 0,
    immediate: !isProjectsArranged,
    config: getSpringConfig('projectRotation'),
    onStart: () => {
      isPageFlipAnimatingRef.current = true
    },
    onRest: () => {
      isPageFlipAnimatingRef.current = false
    },
  })

  // Utiliser les hooks personnalisés
  const {
    contentTexture: currentPageTexture,
    targetFace,
  } = useContentTexture(
    gridPosition,
    currentPage || null,
  )
  const previousPage = currentPage > 1 ? currentPage - 1 : null
  const previousFace = targetFace === 'front' ? 'back' : 'front'
  const { contentTexture: previousPageTexture } = useContentTexture(
    gridPosition,
    previousPage,
    previousFace,
  )
  const gridConfig = useGridConfig()
  const maxPage = selectedProject?.contents?.length || 0
  const navigationCurrentIconType = useMemo(() => {
    return getNavigationIconTypeForPage({
      selectedProject,
      page: currentPage,
      maxPage,
      gridPosition,
      gridConfig,
    })
  }, [selectedProject, currentPage, maxPage, gridPosition, gridConfig])
  const navigationCurrentTexture = useMemo(() => {
    if (!navigationCurrentIconType) {
      return null
    }

    const iconColor = selectedProject?.color?.text || '#000000'
    const backgroundColor = selectedProject?.color?.background || '#ffffff'
    return createNavigationIconTexture(navigationCurrentIconType, iconColor, backgroundColor)
  }, [navigationCurrentIconType, selectedProject?.color?.text, selectedProject?.color?.background])
  const navigationPreviousIconType = useMemo(() => {
    if (!previousPage) {
      return null
    }

    return getNavigationIconTypeForPage({
      selectedProject,
      page: previousPage,
      maxPage,
      gridPosition,
      gridConfig,
    })
  }, [selectedProject, previousPage, maxPage, gridPosition, gridConfig])
  const navigationPreviousTexture = useMemo(() => {
    if (!navigationPreviousIconType) {
      return null
    }

    const iconColor = selectedProject?.color?.text || '#000000'
    const backgroundColor = selectedProject?.color?.background || '#ffffff'
    return createNavigationIconTexture(navigationPreviousIconType, iconColor, backgroundColor)
  }, [navigationPreviousIconType, selectedProject?.color?.text, selectedProject?.color?.background])

  useEffect(() => {
    return () => {
      navigationCurrentTexture?.dispose?.()
      navigationPreviousTexture?.dispose?.()
    }
  }, [navigationCurrentTexture, navigationPreviousTexture])

  const { contentText } = useContentText(gridPosition)

  useEffect(() => {
    if (pageMaterialRef.current) {
      applyPressureRippleShader(pageMaterialRef.current)
    }
  }, [applyPressureRippleShader])

  useGlobalRipple({
    targetRef: pageGroupRef,
    projectSize,
    rippleUniforms,
  })

  const handleMeshClick = () => {

    // Navigation - Cross
    if (gridPosition === gridConfig.crossPosition && selectedProject) {
      resetProjectState()
      return
    }

    // Navigation - Arrow Up
    if (gridPosition === gridConfig.arrowUpPosition && selectedProject && currentPage > 1) {
      setCurrentPage(currentPage - 1)
      return
    }

    // Navigation - Arrow Down
    if (gridPosition === gridConfig.arrowDownPosition && selectedProject && currentPage < maxPage) {
      setCurrentPage(currentPage + 1)
      return
    }

    // Logique de sélection du projet (pour toutes les autres positions)
    if (!isProjectsArranged) {
      setProjectsArranged(true)
      setSelectedProject(projectsData.projects[gridPosition])
    }
  }

  // Optimiser le useEffect pour éviter les re-renders inutiles
  useEffect(() => {
    if (!pageMaterialRef.current) return

    const material = pageMaterialRef.current
    const backFaceFlip = getBackFaceFlip(isProjectsArranged)
    const shouldUseContentMaps = (
      isProjectsArranged &&
      isArrangementAnimationComplete &&
      currentPage > 0
    )
    const isNavigationTile = (
      gridPosition === gridConfig.crossPosition ||
      gridPosition === gridConfig.arrowUpPosition ||
      gridPosition === gridConfig.arrowDownPosition
    )
    const shouldUseNavigationMap = shouldUseContentMaps && isNavigationTile
    const shouldUseBackOnlyNavigation = (
      currentPage === 1 &&
      isNavigationTile
    )
    const fallbackContentMap = backgroundFallbackTexture || emptyTexture
    const nextColor = 'white'
    const baseMap = texture || emptyTexture
    const coverOrFallbackMap = texture || fallbackContentMap
    const previousPageValue = previousCurrentPageRef.current
    const pageChanged = currentPage !== previousPageValue
    let nextFrontMap = baseMap
    let nextBackMap = baseMap

    if (pageChanged) {
      lockedOppositeMapRef.current = lastVisiblePageMapRef.current || coverOrFallbackMap
      previousCurrentPageRef.current = currentPage
    }

    if (shouldUseNavigationMap) {
      if (shouldUseBackOnlyNavigation) {
        nextFrontMap = fallbackContentMap
        nextBackMap = navigationCurrentTexture || fallbackContentMap
      } else {
        const currentMap = navigationCurrentTexture || fallbackContentMap
        const settledOppositeMap = navigationPreviousTexture || fallbackContentMap
        const transitionOppositeMap = lockedOppositeMapRef.current || settledOppositeMap
        const shouldUseTransitionOpposite = !!lockedOppositeMapRef.current || pageChanged || isPageFlipAnimatingRef.current
        const oppositeMap = shouldUseTransitionOpposite
          ? transitionOppositeMap
          : settledOppositeMap

        if (targetFace === 'front') {
          nextFrontMap = currentMap
          nextBackMap = oppositeMap
        } else {
          nextFrontMap = oppositeMap
          nextBackMap = currentMap
        }
      }

      lastVisiblePageMapRef.current = navigationCurrentTexture || fallbackContentMap
    } else if (shouldUseContentMaps) {
      const currentMap = currentPageTexture || fallbackContentMap
      const settledOppositeMap = previousPage
        ? (previousPageTexture || fallbackContentMap)
        : coverOrFallbackMap
      const transitionOppositeMap = lockedOppositeMapRef.current || settledOppositeMap
      const shouldUseTransitionOpposite = !!lockedOppositeMapRef.current || pageChanged || isPageFlipAnimatingRef.current
      const oppositeMap = shouldUseTransitionOpposite
        ? transitionOppositeMap
        : settledOppositeMap

      if (targetFace === 'front') {
        nextFrontMap = currentMap
        nextBackMap = oppositeMap
      } else {
        nextFrontMap = oppositeMap
        nextBackMap = currentMap
      }

      // Keep the map that is actually displayed for this page (image or fallback).
      // This avoids reusing a stale older-page texture on the next transition.
      lastVisiblePageMapRef.current = currentMap
    }

    nextFrontMap.updateMatrix()
    nextBackMap.updateMatrix()

    material.userData.frontMap = nextFrontMap
    material.userData.backMap = nextBackMap
    rippleUniforms.uFrontMap.value = nextFrontMap
    rippleUniforms.uBackMap.value = nextBackMap
    rippleUniforms.uBackFlipX.value = backFaceFlip.x
    rippleUniforms.uBackFlipY.value = backFaceFlip.y
    rippleUniforms.uFrontMapTransform.value.copy(nextFrontMap.matrix)
    rippleUniforms.uBackMapTransform.value.copy(nextBackMap.matrix)

    if (material.userData.shader) {
      material.userData.shader.uniforms.uFrontMap.value = nextFrontMap
      material.userData.shader.uniforms.uBackMap.value = nextBackMap
      material.userData.shader.uniforms.uBackFlipX.value = backFaceFlip.x
      material.userData.shader.uniforms.uBackFlipY.value = backFaceFlip.y
      material.userData.shader.uniforms.uFrontMapTransform.value.copy(nextFrontMap.matrix)
      material.userData.shader.uniforms.uBackMapTransform.value.copy(nextBackMap.matrix)
    }

    material.color.set(nextColor)

    if (!shouldUseContentMaps && !shouldUseNavigationMap) {
      lastVisiblePageMapRef.current = texture || coverOrFallbackMap
    }
  }, [
    isArrangementAnimationComplete,
    isProjectsArranged,
    texture,
    currentPageTexture,
    previousPageTexture,
    previousPage,
    targetFace,
    currentPage,
    emptyTexture,
    backgroundFallbackTexture,
    navigationCurrentTexture,
    navigationPreviousTexture,
    gridPosition,
    gridConfig,
    rippleUniforms,
  ])

  useEffect(() => {
    return () => {
      backgroundFallbackTexture.dispose()
    }
  }, [backgroundFallbackTexture])


  return (
    <animated.group
      ref={projectRef}
      position={position}
      rotation={rotation}
    >
      <animated.group
        ref={pageGroupRef}
        rotation-x={pageRotationX}
      >
        <AnimatedMesh
          projectId={gridPosition}
          onClick={handleMeshClick}
        >
          <mesh>
            <primitive object={getCachedGeometry().clone()} />
            <meshBasicMaterial
              ref={pageMaterialRef}
              map={emptyTexture}
              side={THREE.DoubleSide}
              toneMapped={true}
              onUpdate={(material) => {
                if (!material.userData.shaderSetup) {
                  applyPressureRippleShader(material)
                  material.userData.shaderSetup = true
                }
              }}
            />
          </mesh>
          <group>
            {isArrangementAnimationComplete && (
              <>
                {currentPage === 1 && (
                  <>
                    <ProjectOverlay
                      condition={
                        selectedProject && gridPosition === 0 && selectedProject.title
                      }
                      projectSize={projectSize}
                    >
                      <p className={styles.title} data-overlay-interactive="true">{selectedProject?.title}</p>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={
                        selectedProject &&
                        gridPosition === 1 &&
                        selectedProject.context
                      }
                      projectSize={projectSize}
                    >
                      <p className={styles.title} data-overlay-interactive="true">{selectedProject?.context}</p>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={
                        selectedProject && gridPosition === 2 && selectedProject.year
                      }
                      projectSize={projectSize}
                    >
                      <p className={styles.title} data-overlay-interactive="true">{selectedProject?.year}</p>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={
                        selectedProject &&
                        gridPosition === 3 &&
                        selectedProject.technologies
                      }
                      projectSize={projectSize}
                    >
                      <div className={styles.technoContainer}>
                        {selectedProject?.technologies.map((techno) => (
                          <p key={techno} className={styles.techno} data-overlay-interactive="true">
                            {techno}
                          </p>
                        ))}
                      </div>
                    </ProjectOverlay>
                    <ProjectOverlay
                      condition={
                        selectedProject && gridPosition === 4 && selectedProject.link
                      }
                      projectSize={projectSize}
                    >
                      <a
                        href={selectedProject?.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.linkButton}
                        data-overlay-interactive="true"
                      >
                        <span className={styles.linkButtonLabel} data-overlay-interactive="true">Link</span>
                      </a>
                    </ProjectOverlay>
                  </>
                )}
                {contentText && (
                  <ProjectOverlay
                    condition={selectedProject}
                    projectSize={projectSize}
                    reverse={true}
                  >
                    <p className={styles.contentText}>
                      <span className={styles.contentTextValue} data-overlay-interactive="true">{contentText.text}</span>
                    </p>
                  </ProjectOverlay>
                )}
              </>
            )}
          </group>
        </AnimatedMesh>
      </animated.group>
    </animated.group>
  )
})

export default Project