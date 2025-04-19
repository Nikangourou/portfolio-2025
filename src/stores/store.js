import { create } from 'zustand'

export const useStore = create((set) => ({
  isProjectsArranged: false,
  setProjectsArranged: (value) => set({ isProjectsArranged: value }),
})) 