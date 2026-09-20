/**
 * node src/app/reveal.check.ts
 * The gate decides whether the whole app renders, so the parsing gets a test of its own.
 */
import assert from 'node:assert/strict';
import { isRevealed, REVEAL_KEY } from './reveal.ts';

const stub = (value: string | null) => ({ getItem: (key: string) => (key === REVEAL_KEY ? value : null) });

assert.equal(isRevealed(stub('true')), true);
assert.equal(isRevealed(stub('1')), true);

for (const value of [null, '', 'false', '0', 'TRUE', 'True', 'yes', 'undefined', ' true ']) {
  assert.equal(isRevealed(stub(value)), false, `"${value}" must not reveal the app`);
}

assert.equal(isRevealed(undefined), false, 'no storage at all means hidden');
assert.equal(
  isRevealed({
    getItem() {
      throw new Error('SecurityError: storage is blocked');
    },
  }),
  false,
  'storage that throws means hidden, not a crash',
);

// The default is closed: a fresh browser with nothing stored shows nothing.
assert.equal(isRevealed({ getItem: () => null }), false);

console.log('reveal: all checks passed');
