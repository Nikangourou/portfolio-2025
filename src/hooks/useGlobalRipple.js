import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { getGlobalCanvasPointerState, subscribeGlobalCanvasPointerState } from '@/utils/globalPointerTracker'

const CURSOR_RESPONSE = 9
const RIPPLE_RESPONSE = 7.2

const sceneRippleFieldMap = new WeakMap()

const getSceneRippleField = (canvas) => {
    if (!canvas) {
        return null
    }

    let field = sceneRippleFieldMap.get(canvas)
    if (!field) {
        field = {
            activePointer: new THREE.Vector2(),
            raycaster: new THREE.Raycaster(),
            ray: new THREE.Ray(),
            isPointerInsideCanvas: false,
            hasPointerState: false,
            time: 0,
        }
        sceneRippleFieldMap.set(canvas, field)
    }

    return field
}

export const useSceneRippleField = () => {
    const sceneRippleFieldRef = useRef(null)
    const { camera, pointer, gl } = useThree()

    useEffect(() => {
        const canvas = gl?.domElement
        sceneRippleFieldRef.current = getSceneRippleField(canvas)
        return subscribeGlobalCanvasPointerState(canvas)
    }, [gl])

    useFrame((state) => {
        const canvas = gl?.domElement
        const sceneRippleField = sceneRippleFieldRef.current || getSceneRippleField(canvas)
        if (!sceneRippleField) {
            return
        }

        const canvasPointerState = getGlobalCanvasPointerState(canvas)
        const activePointer = canvasPointerState?.hasPointer
            ? canvasPointerState.pointer
            : pointer

        sceneRippleField.activePointer.copy(activePointer)
        sceneRippleField.hasPointerState = !!canvasPointerState?.hasPointer
        sceneRippleField.isPointerInsideCanvas = sceneRippleField.hasPointerState
            ? !!canvasPointerState?.isInsideCanvas
            : true
        sceneRippleField.time = state.clock.elapsedTime

        if (!sceneRippleField.isPointerInsideCanvas) {
            return
        }

        sceneRippleField.raycaster.setFromCamera(activePointer, camera)
        sceneRippleField.ray.copy(sceneRippleField.raycaster.ray)
    })
}

export const useGlobalRipple = ({
    targetRef,
    projectSize,
    rippleUniforms,
    screenFalloff = 0.72,
    localFalloff = 0.9,
}) => {
    const worldPlaneRef = useRef(new THREE.Plane())
    const planeOriginRef = useRef(new THREE.Vector3())
    const planeNormalRef = useRef(new THREE.Vector3())
    const planeQuaternionRef = useRef(new THREE.Quaternion())
    const hitPointRef = useRef(new THREE.Vector3())
    const localCursorRef = useRef(new THREE.Vector3())
    const projectedCenterRef = useRef(new THREE.Vector3())
    const sceneRippleFieldRef = useRef(null)
    const { camera, gl } = useThree()

    useEffect(() => {
        const canvas = gl?.domElement
        sceneRippleFieldRef.current = getSceneRippleField(canvas)
    }, [gl])

    useFrame((state, delta) => {
        if (!targetRef.current) {
            return
        }

        const sceneRippleField = sceneRippleFieldRef.current
        const activePointer = sceneRippleField?.activePointer
        const isPointerInsideCanvas = !!sceneRippleField?.isPointerInsideCanvas

        targetRef.current.getWorldPosition(planeOriginRef.current)
        targetRef.current.getWorldQuaternion(planeQuaternionRef.current)
        planeNormalRef.current.set(0, 0, 1)
            .applyQuaternion(planeQuaternionRef.current)
            .normalize()

        worldPlaneRef.current.setFromNormalAndCoplanarPoint(
            planeNormalRef.current,
            planeOriginRef.current,
        )

        if (!isPointerInsideCanvas) {
            rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
                rippleUniforms.uRippleStrength.value,
                0,
                1 - Math.exp(-delta * RIPPLE_RESPONSE),
            )
            rippleUniforms.uTime.value = sceneRippleField?.time || state.clock.elapsedTime
            return
        }

        const hasIntersection = sceneRippleField.ray.intersectPlane(
            worldPlaneRef.current,
            hitPointRef.current,
        )

        if (!hasIntersection) {
            rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
                rippleUniforms.uRippleStrength.value,
                0,
                1 - Math.exp(-delta * RIPPLE_RESPONSE),
            )
            rippleUniforms.uTime.value = sceneRippleField?.time || state.clock.elapsedTime
            return
        }

        localCursorRef.current.copy(hitPointRef.current)
        targetRef.current.worldToLocal(localCursorRef.current)

        const halfWidth = projectSize.width * 0.5
        const halfHeight = projectSize.height * 0.5
        const normalizedX = localCursorRef.current.x / halfWidth
        const normalizedY = localCursorRef.current.y / halfHeight
        const radialDistance = Math.sqrt(
            normalizedX * normalizedX + normalizedY * normalizedY,
        )
        const insideInfluence = THREE.MathUtils.clamp(1 - radialDistance, 0, 1)
        const outsideX = Math.max(Math.abs(normalizedX) - 1, 0)
        const outsideY = Math.max(Math.abs(normalizedY) - 1, 0)
        const edgeDistance = Math.hypot(outsideX, outsideY)
        const edgeInfluence = THREE.MathUtils.clamp(1 - edgeDistance / localFalloff, 0, 1)
        const cursorInfluence = Math.max(insideInfluence, edgeInfluence * 0.7)

        projectedCenterRef.current.copy(planeOriginRef.current).project(camera)

        const pointerToTargetX = activePointer.x - projectedCenterRef.current.x
        const pointerToTargetY = activePointer.y - projectedCenterRef.current.y
        const screenDistance = Math.sqrt(
            pointerToTargetX * pointerToTargetX +
            pointerToTargetY * pointerToTargetY,
        )
        const screenInfluence = THREE.MathUtils.clamp(1 - screenDistance / screenFalloff, 0, 1)
        const targetStrength = Math.max(cursorInfluence, screenInfluence * 0.62)
        const cursorBlend = 1 - Math.exp(-delta * CURSOR_RESPONSE)
        const strengthBlend = 1 - Math.exp(-delta * RIPPLE_RESPONSE)

        if (rippleUniforms.uRippleCursor.value.x > 900) {
            rippleUniforms.uRippleCursor.value.set(localCursorRef.current.x, localCursorRef.current.y)
        } else {
            rippleUniforms.uRippleCursor.value.lerp(localCursorRef.current, cursorBlend)
        }

        rippleUniforms.uRippleStrength.value = THREE.MathUtils.lerp(
            rippleUniforms.uRippleStrength.value,
            targetStrength,
            strengthBlend,
        )
        rippleUniforms.uTime.value = sceneRippleField?.time || state.clock.elapsedTime
    })
}