// Runnable check for the course content. Run: node verify-course.mjs
//
// course.json is a manifest (ranks, badges, module file paths); each
// module's questions live in their own file under modules/ — mirrors how
// index.html loads it (see the COURSE/manifest loader there).
//
// Two grading modes exist per question:
//  - regex questions (`s.re`): the regex must accept its own reference `sol`,
//    and every hint `check` must be consistent with that solution (non-`bad`
//    checks match sol, `bad` checks do NOT).
//  - interpreter questions (`s.tests`): each test case is executed against
//    the reference `sol` by a REAL Python interpreter (mirrors the browser's
//    Pyodide harness in index.html — same fresh-namespace-per-case, same
//    call/read/stdout/expected shape), so a wrong reference solution or a
//    wrong expected value fails CI instead of silently drifting.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = import.meta.url;
const manifest = JSON.parse(readFileSync(new URL('./course.json', root)));
const course = {
  ranks: manifest.ranks,
  badges: manifest.badges,
  modules: manifest.modules.map(path => JSON.parse(readFileSync(new URL(path, root)))),
};
const norm = s => s.trim().replace(/\s+$/gm, ''); // mirror runCode() in index.html
let fails = 0, steps = 0;

function deepEqual(a, b) {
  if (b === null) return a === null;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a), bk = Object.keys(b);
    return ak.length === bk.length && ak.every(k => deepEqual(a[k], b[k]));
  }
  return a === b;
}

// Runs one test case's `sol` through real CPython, in a script-local subprocess.
// Mirrors runOneCase() in index.html: fresh namespace, optional ctx override,
// optional call/read expression, stdout always captured.
function runCase(sol, baseCtx, tc) {
  const ctx = tc.ctx ?? baseCtx ?? '';
  const tail = tc.call ? `_g_result = ${tc.call}` : tc.read ? `_g_result = ${tc.read}` : '';
  const py = `
import sys, io, json
ns = {}
orig_stdout = sys.stdout
sys.stdout = io.StringIO()
try:
    exec(compile(${JSON.stringify((ctx ? ctx + '\n' : '') + sol + '\n' + tail)}, '<sol>', 'exec'), ns)
except Exception as e:
    sys.stdout = orig_stdout
    print('__ERR__' + repr(e))
    sys.exit(0)
captured = sys.stdout.getvalue()
sys.stdout = orig_stdout
out = {'stdout': captured}
if ${tc.call || tc.read ? 'True' : 'False'}:
    v = ns.get('_g_result')
    out['value'] = sorted(v) if isinstance(v, set) else v
print('__OK__' + json.dumps(out))
`;
  const res = spawnSync('python3', ['-c', py], { timeout: 3000, encoding: 'utf8' });
  if (res.error) return { error: String(res.error) };
  const line = (res.stdout || '').trim().split('\n').pop() || '';
  if (line.startsWith('__ERR__')) return { error: line.slice(7) };
  if (line.startsWith('__OK__')) return JSON.parse(line.slice(6));
  return { error: `no output (stderr: ${res.stderr})` };
}

for (const m of course.modules) {
  const questions = m.checkpoints.flatMap(cp => cp.questions);
  questions.forEach((s, i) => {
    steps++;
    const where = `${m.id} q${i + 1} (${s.t})`;
    const code = norm(s.sol);

    if (s.tests) {
      s.tests.forEach((tc, ti) => {
        const label = tc.call || tc.read || '(script)';
        const result = runCase(s.sol, s.ctx, tc);
        const tw = `${where} test ${ti + 1} [${label}]`;
        if (result.error) { console.error(`✗ ${tw}: sol raised ${result.error}`); fails++; return; }
        if (tc.stdout !== undefined) {
          const got = (result.stdout || '').replace(/\s+$/, '');
          const want = tc.stdout.replace(/\s+$/, '');
          if (got !== want) { console.error(`✗ ${tw}: stdout mismatch — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); fails++; }
        } else if (!deepEqual(result.value, tc.expected)) {
          console.error(`✗ ${tw}: expected ${JSON.stringify(tc.expected)}, sol produced ${JSON.stringify(result.value)}`);
          fails++;
        }
      });
    } else {
      let re;
      try { re = new RegExp(s.re); }
      catch (e) { console.error(`✗ ${where}: bad regex — ${e.message}`); fails++; return; }
      if (!re.test(code)) { console.error(`✗ ${where}: re rejects its own sol\n    sol: ${JSON.stringify(s.sol)}`); fails++; }
    }

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
