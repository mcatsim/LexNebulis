import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TimerState {
  isRunning: boolean;
  matterId: string | null;
  description: string;
  startedAt: number | null;
  elapsed: number; // seconds
  start: (matterId: string, description: string) => void;
  stop: () => { matterId: string | null; description: string; elapsed: number };
  tick: () => void;
  reset: () => void;
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      isRunning: false,
      matterId: null,
      description: '',
      startedAt: null,
      elapsed: 0,
      start: (matterId, description) =>
        set({ isRunning: true, matterId, description, startedAt: Date.now(), elapsed: 0 }),
      stop: () => {
        const state = get();
        const elapsed = state.startedAt
          ? Math.floor((Date.now() - state.startedAt) / 1000)
          : state.elapsed;
        set({ isRunning: false });
        return { matterId: state.matterId, description: state.description, elapsed };
      },
      tick: () => {
        const state = get();
        if (state.isRunning && state.startedAt) {
          set({ elapsed: Math.floor((Date.now() - state.startedAt) / 1000) });
        }
      },
      reset: () =>
        set({ isRunning: false, matterId: null, description: '', startedAt: null, elapsed: 0 }),
    }),
    {
      name: 'legalforge-timer',
    }
  )
);
