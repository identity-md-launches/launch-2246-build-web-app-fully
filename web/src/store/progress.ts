import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Choice } from '../sim/types';
import type { PhraseConfig } from '../sim/phrase';

export interface SavedPhrase {
  id: string;
  name: string;
  cfg: PhraseConfig;
  slices: [Choice, Choice][];
  call: string;
}

export type DrillName = 'identify' | 'counter' | 'call' | 'build';

interface ProgressStore {
  studied: Record<string, true>;
  learned: Record<string, number>;
  drillBest: Partial<Record<DrillName, number>>;
  drillsPassed: number;
  /** Leitner box per technique (1 = weakest, 5 = mastered). */
  boxes: Record<string, number>;
  techStats: Record<string, { seen: number; correct: number }>;
  bouts: { won: number; lost: number };
  phrases: SavedPhrase[];
  study: (id: string) => void;
  rate: (id: string, rating: number) => void;
  unlearn: (id: string) => void;
  recordAnswer: (id: string, correct: boolean) => void;
  finishDrill: (d: DrillName, score: number, passed: boolean) => void;
  recordBout: (won: boolean) => void;
  savePhrase: (p: SavedPhrase) => void;
  deletePhrase: (id: string) => void;
  resetAll: () => void;
}

const EMPTY = {
  studied: {},
  learned: {},
  drillBest: {},
  drillsPassed: 0,
  boxes: {},
  techStats: {},
  bouts: { won: 0, lost: 0 },
  phrases: [],
};

export const useProgress = create<ProgressStore>()(
  persist(
    (set) => ({
      ...EMPTY,
      study: (id) => set((s) => (s.studied[id] ? s : { studied: { ...s.studied, [id]: true } })),
      rate: (id, rating) => set((s) => ({ learned: { ...s.learned, [id]: rating } })),
      unlearn: (id) =>
        set((s) => {
          const learned = { ...s.learned };
          delete learned[id];
          return { learned };
        }),
      recordAnswer: (id, correct) =>
        set((s) => {
          const box = s.boxes[id] ?? 1;
          const st = s.techStats[id] ?? { seen: 0, correct: 0 };
          return {
            boxes: { ...s.boxes, [id]: correct ? Math.min(5, box + 1) : 1 },
            techStats: { ...s.techStats, [id]: { seen: st.seen + 1, correct: st.correct + (correct ? 1 : 0) } },
          };
        }),
      finishDrill: (d, score, passed) =>
        set((s) => ({ drillBest: { ...s.drillBest, [d]: Math.max(score, s.drillBest[d] ?? 0) }, drillsPassed: s.drillsPassed + (passed ? 1 : 0) })),
      recordBout: (won) => set((s) => ({ bouts: { won: s.bouts.won + (won ? 1 : 0), lost: s.bouts.lost + (won ? 0 : 1) } })),
      savePhrase: (p) => set((s) => ({ phrases: [p, ...s.phrases].slice(0, 50) })),
      deletePhrase: (id) => set((s) => ({ phrases: s.phrases.filter((p) => p.id !== id) })),
      resetAll: () => set(EMPTY),
    }),
    { name: 'piste.progress' },
  ),
);

/** Weighted pick favouring weak techniques (low Leitner box). */
export function leitnerWeight(box: number | undefined): number {
  return 6 - (box ?? 1);
}
