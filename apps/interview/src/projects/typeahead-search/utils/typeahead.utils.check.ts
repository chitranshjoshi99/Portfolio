/**
 * ponytail: no test framework installed — run with
 * `node src/projects/typeahead-search/utils/typeahead.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { CITIES } from '../constants/city-dataset.ts';
import { INDEX_TOP_K } from '../constants/typeahead.constants.ts';
import {
  buildSuggestIndex,
  nextIndex,
  normalise,
  rankByScan,
  scoreCity,
  splitHighlight,
  suggest,
} from './typeahead.utils.ts';

const index = buildSuggestIndex(CITIES, INDEX_TOP_K);
const names = (cities: { name: string }[]) => cities.map((city) => city.name);

// --- the index is the shipped read path, so it is asserted directly -----------------------

// every prefix match, ordered by population — not by source order
const sanRanked = names(suggest(index, 'san', 10));
assert.deepEqual(sanRanked, [
  'Santiago',
  'San Francisco',
  'San Diego',
  'San Antonio',
  'Santa Cruz',
  'San Jose',
]);
assert.ok(sanRanked.every((name) => name.toLowerCase().startsWith('san')));

// a mid-name match is reachable — this is what indexing every suffix buys
assert.ok(names(suggest(index, 'ark', 10)).includes('Newark'));

// country match is the weakest signal and still returned
const indiaRanked = suggest(index, 'india', 20);
assert.ok(indiaRanked.length >= 8);
assert.ok(indiaRanked.every((city) => city.country === 'India'));

// case-insensitive and whitespace-tolerant
assert.deepEqual(names(suggest(index, '  TOKYO ', 5)), ['Tokyo']);
assert.equal(normalise('  DeLhi  '), 'delhi');

// limit is respected; empty and unmatched queries return nothing
assert.equal(suggest(index, 'a', 3).length, 3);
assert.equal(suggest(index, '   ', 5).length, 0);
assert.equal(suggest(index, 'zzzz', 5).length, 0);
assert.equal(scoreCity(CITIES[0], ''), -1);

// ties break on population, not source order
assert.deepEqual(names(suggest(index, 'new', 5)), ['New York', 'New Orleans', 'Newark']);

// a query cannot ask the index for more than it stored
assert.equal(suggest(index, 'a', INDEX_TOP_K + 50).length, Math.min(INDEX_TOP_K, suggest(index, 'a', INDEX_TOP_K).length));

// --- differential test: the index must agree with the O(N) scan, everywhere ---------------
// This is the check that makes shipping the index defensible. The scan is the oracle;
// if they ever disagree, the optimisation is wrong, not the scan.

const queries = new Set<string>();
for (const city of CITIES) {
  const name = city.name.toLowerCase();
  for (let start = 0; start < name.length; start += 1) {
    for (let end = start + 1; end <= Math.min(name.length, start + 5); end += 1) {
      queries.add(name.slice(start, end));
    }
  }
  queries.add(city.country.toLowerCase().slice(0, 4));
}
queries.add('zzz');
queries.add('q');

for (const query of queries) {
  for (const limit of [1, 5, 8, INDEX_TOP_K]) {
    assert.deepEqual(
      names(suggest(index, query, limit)),
      names(rankByScan(CITIES, query, limit)),
      `index disagrees with scan for ${JSON.stringify(query)} @ limit ${limit}`,
    );
  }
}
console.log(`differential: ${queries.size} queries x 4 limits, index === scan`);

// --- highlighting -------------------------------------------------------------------------

// highlight segments always reassemble to the original label, exactly
for (const query of ['san', 'SAN', 'francisco', 'zzz', '']) {
  for (const city of CITIES.slice(0, 20)) {
    const segments = splitHighlight(city.name, query);
    assert.equal(segments.map((segment) => segment.text).join(''), city.name);
    assert.ok(segments.every((segment) => segment.text !== ''));
  }
}
assert.deepEqual(splitHighlight('San Diego', 'san'), [
  { text: 'San', isMatch: true },
  { text: ' Diego', isMatch: false },
]);
assert.deepEqual(splitHighlight('Newark', 'ark'), [
  { text: 'New', isMatch: false },
  { text: 'ark', isMatch: true },
]);
assert.deepEqual(splitHighlight('Tokyo', 'zzz'), [{ text: 'Tokyo', isMatch: false }]);

// arrow-key movement wraps, and an empty list has no active option
assert.equal(nextIndex(-1, 1, 3), 0);
assert.equal(nextIndex(-1, -1, 3), 2);
assert.equal(nextIndex(2, 1, 3), 0);
assert.equal(nextIndex(0, -1, 3), 2);
assert.equal(nextIndex(0, 1, 0), -1);

console.log('typeahead.utils: all checks passed');
