import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Units = 'm' | 'ft';
export interface Settings {
  handedLeft: 1 | -1;
  handedRight: 1 | -1;
  heightLeft: number;
  heightRight: number;
  units: Units;
  tempoSec: number;
  reducedMotion: boolean;
  colorblind: boolean;
  volume: number;
  raisedRearArm: boolean;
  keys: Record<string, string>;
  quickSlots: string[];
}

export const DEFAULT_KEYS: Record<string, string> = {
  retreat: 'a',
  advance: 'd',
  lunge: ' ',
  quarte: 'q',
  sixte: 'e',
  septime: 'z',
  octave: 'c',
  counter: 'r',
};

const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const DEFAULT_SETTINGS: Settings = {
  handedLeft: 1,
  handedRight: 1,
  heightLeft: 1.78,
  heightRight: 1.78,
  units: 'm',
  tempoSec: 0.3,
  reducedMotion: !!prefersReduced,
  colorblind: false,
  volume: 0.6,
  raisedRearArm: false,
  keys: DEFAULT_KEYS,
  quickSlots: ['AT02', 'AT03', 'AT10', 'AT06', 'AT07', 'BL06', 'CT01', 'CT03', 'RR01'],
};

interface SettingsStore extends Settings {
  set: (p: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (p) => set(p),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    { name: 'piste.settings' },
  ),
);

export function formatLength(m: number, units: Units): string {
  return units === 'm' ? `${m.toFixed(2)} m` : `${(m * 3.28084).toFixed(2)} ft`;
}
