// Runnable check for course.json: every step's regex must accept its own reference
// solution, and every hint check must be consistent with that solution
// (non-`bad` checks match sol, `bad` checks do NOT). Run: node verify-course.mjs
import { readFileSync } from 'node:fs';

const course = JSON.parse(readFileSync(new URL('./course.json', import.meta.url)));
const norm = s => s.trim().replace(/\s+$/gm, ''); // mirror runCode() in index.html
let fails = 0, steps = 0;

for (const m of course.modules) {
  const questions = m.checkpoints.flatMap(cp => cp.questions);
  questions.forEach((s, i) => {
    steps++;
    const where = `${m.id} q${i + 1} (${s.t})`;
    const code = norm(s.sol);
    let re;
    try { re = new RegExp(s.re); }
    catch (e) { console.error(`✗ ${where}: bad regex — ${e.message}`); fails++; return; }
    if (!re.test(code)) { console.error(`✗ ${where}: re rejects its own sol\n    sol: ${JSON.stringify(s.sol)}`); fails++; }
    (s.checks || []).forEach(c => {
      const hit = new RegExp(c.re).test(code);
      if (c.bad && hit) { console.error(`✗ ${where}: bad-check "${c.re}" fires on the correct sol`); fails++; }
      if (!c.bad && !hit) { console.error(`✗ ${where}: check "${c.re}" fails on the correct sol`); fails++; }
    });
  });
  // viz renderers key off cumulative question index, so a viz module needs >= 4 questions
  if (m.viz && questions.length < 4) { console.error(`✗ ${m.id}: viz "${m.viz}" needs >=4 questions`); fails++; }
}

// every module.badge must resolve to a defined badge id
const badgeIds = new Set(course.badges.map(b => b.id));
for (const m of course.modules)
  if (m.badge && !badgeIds.has(m.badge)) { console.error(`✗ ${m.id}: badge "${m.badge}" not in badges[]`); fails++; }

console.log(`${steps} steps checked, ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
