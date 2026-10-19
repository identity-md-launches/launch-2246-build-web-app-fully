import { TECHNIQUE_BY_ID } from './techniques';
import type { CounterLink } from './types';

export interface ChainNode {
  id: string;
  reliability?: CounterLink['reliability'];
  why?: string;
  children: ChainNode[];
}

/** What beats a technique, recursively, up to `depth` levels (the counter-to-counter chain). */
export function counterChain(id: string, depth = 3, seen: Set<string> = new Set([id])): ChainNode[] {
  if (depth <= 0) return [];
  const t = TECHNIQUE_BY_ID[id];
  if (!t) return [];
  return t.counteredBy.map((c) => {
    const nextSeen = new Set(seen);
    const loop = nextSeen.has(c.id);
    nextSeen.add(c.id);
    return { id: c.id, reliability: c.reliability, why: c.why, children: loop ? [] : counterChain(c.id, depth - 1, nextSeen) };
  });
}

export function reciprocityErrors(): string[] {
  const errs: string[] = [];
  for (const t of Object.values(TECHNIQUE_BY_ID)) {
    for (const c of t.counteredBy) {
      const o = TECHNIQUE_BY_ID[c.id];
      if (!o) errs.push(`${t.id}.counteredBy → unknown ${c.id}`);
      else if (!o.counters.some((x) => x.id === t.id)) errs.push(`${c.id}.counters is missing ${t.id}`);
    }
    for (const c of t.counters) {
      const o = TECHNIQUE_BY_ID[c.id];
      if (!o) errs.push(`${t.id}.counters → unknown ${c.id}`);
      else if (!o.counteredBy.some((x) => x.id === t.id)) errs.push(`${c.id}.counteredBy is missing ${t.id}`);
    }
  }
  return errs;
}
