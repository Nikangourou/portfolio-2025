import { create } from 'zustand'

export const useStore = create((set) => ({
  isProjectsArranged: false,
  setProjectsArranged: (value) => set({ isProjectsArranged: value }),
  isArrangementAnimationComplete: false,
  setArrangementAnimationComplete: (value) => set({ isArrangementAnimationComplete: value }),
  selectedProject: null,
  setSelectedProject: (project) => set({ selectedProject: project }),
})) 