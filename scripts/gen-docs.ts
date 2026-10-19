import { writeFileSync } from 'node:fs';
import { TECHNIQUES } from '../web/src/data/techniques';

writeFileSync('TECHNIQUES.md', '# Piste technique reference\n\nGenerated from `web/src/data/techniques.ts` by `npm run docs`.\n\n' + TECHNIQUES.map(t => `## ${t.id}: ${t.name} (${t.french})\n\n${t.description}\n\n${t.whenToUse}\n\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nCommon errors:\n\n${t.commonErrors.map(e => `- ${e}`).join('\n')}\n\nTactics: ${t.tacticalNotes}\n\nRight of way: ${t.rowNotes}\n\nCountered by: ${t.counteredBy.map(c => `${c.id} (${c.reliability}): ${c.why}`).join('; ') || 'Foundation technique.'}\n`).join('\n'));
console.log(`Generated TECHNIQUES.md for ${TECHNIQUES.length} techniques.`);
