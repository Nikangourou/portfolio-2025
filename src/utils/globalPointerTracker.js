import * as THREE from 'three'

const canvasPointerStateMap = new WeakMap()
const visualPointerState = {
    clientX: 0,
    clientY: 0,
    hasPointer: false,
}

const getPointerState = (canvas) => {
    if (!canvas) {
        return null
    }

    let state = canvasPointerStateMap.get(canvas)
    if (!state) {
        state = {
            pointer: new THREE.Vector2(),
            hasPointer: false,
            isInsideCanvas: false,
            refs: 0,
            handler: null,
        }
        canvasPointerStateMap.set(canvas, state)
    }

    return state
}

const isAllowedPointerTarget = (canvas, targetElement) => {
    if (!targetElement) {
        return false
    }

    return targetElement === canvas || canvas.contains(targetElement)
}

const normalizeCanvasPoint = (clientX, clientY, rect) => {
    const width = Math.max(rect?.width || 0, 1)
    const height = Math.max(rect?.height || 0, 1)

    return {
        x: ((clientX - (rect?.left || 0)) / width) * 2 - 1,
        y: -((clientY - (rect?.top || 0)) / height) * 2 + 1,
    }
}

const normalizeVisualPointerForCanvas = (canvas) => {
    if (!canvas || !visualPointerState.hasPointer) {
        return null
    }

    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
        return null
    }

    const localX = visualPointerState.clientX - rect.left
    const localY = visualPointerState.clientY - rect.top
    const isInsideCanvas = (
        localX >= 0 &&
        localX <= rect.width &&
        localY >= 0 &&
        localY <= rect.height
    )

    const pointer = normalizeCanvasPoint(
        visualPointerState.clientX,
        visualPointerState.clientY,
        rect,
    )

    return {
        pointer,
        isInsideCanvas,
    }
}

export const getGlobalCanvasPointerState = (canvas) => getPointerState(canvas)

export const setGlobalVisualPointerState = (clientX, clientY) => {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        return
    }

    visualPointerState.clientX = clientX
    visualPointerState.clientY = clientY
    visualPointerState.hasPointer = true
}

export const clearGlobalVisualPointerState = () => {
    visualPointerState.hasPointer = false
}

export const getGlobalVisualPointerState = (canvas) => {
    return normalizeVisualPointerForCanvas(canvas)
}

export const subscribeGlobalCanvasPointerState = (canvas) => {
    const state = getPointerState(canvas)
    if (!state) {
        return () => { }
    }

    state.refs += 1

    if (state.refs === 1) {
        state.handler = (event) => {
            const rect = canvas.getBoundingClientRect()
            if (rect.width <= 0 || rect.height <= 0) {
                state.hasPointer = false
                state.isInsideCanvas = false
                return
            }

            const targetElement = event.target instanceof Element ? event.target : null
            if (!isAllowedPointerTarget(canvas, targetElement)) {
                state.hasPointer = false
                state.isInsideCanvas = false
                return
            }

            if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
                state.hasPointer = false
                state.isInsideCanvas = false
                return
            }

            const localX = event.clientX - rect.left
            const localY = event.clientY - rect.top

            if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
                state.hasPointer = true
                state.isInsideCanvas = false
                return
            }

            const normalizedPoint = normalizeCanvasPoint(event.clientX, event.clientY, rect)
            const x = normalizedPoint.x
            const y = normalizedPoint.y

            if (state.hasPointer && state.isInsideCanvas) {
                const deltaX = x - state.pointer.x
                const deltaY = y - state.pointer.y
                const jumpDistance = Math.hypot(deltaX, deltaY)
                const nearCorner = Math.abs(x) > 0.96 && Math.abs(y) > 0.96
                const wasNearCorner = Math.abs(state.pointer.x) > 0.9 && Math.abs(state.pointer.y) > 0.9

                // Filter occasional one-frame spikes to canvas corners from DOM event sequences.
                if (nearCorner && !wasNearCorner && jumpDistance > 0.85) {
                    return
                }
            }

            state.pointer.set(x, y)
            state.hasPointer = true
            state.isInsideCanvas = true
        }

        window.addEventListener('pointermove', state.handler, { passive: true })
    }

    return () => {
        state.refs -= 1
        if (state.refs <= 0 && state.handler) {
            window.removeEventListener('pointermove', state.handler)
            state.handler = null
            state.hasPointer = false
            state.isInsideCanvas = false
            canvasPointerStateMap.delete(canvas)
        }
    }
}
