import * as THREE from 'three'

const canvasPointerStateMap = new WeakMap()

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

export const getGlobalCanvasPointerState = (canvas) => getPointerState(canvas)

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

            const x = (localX / rect.width) * 2 - 1
            const y = -((localY / rect.height) * 2 - 1)

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
