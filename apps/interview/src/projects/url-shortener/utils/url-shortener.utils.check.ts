/**
 * ponytail: no test framework installed — run with
 * `node src/projects/url-shortener/utils/url-shortener.utils.check.ts`.
 */
import assert from 'node:assert/strict';
import { ERROR, FIRST_ID } from '../constants/url-shortener.constants.ts';
import type { ShortLink } from '../url-shortener.types.ts';
import { parseState } from './link-storage.ts';
import {
  buildLinkIndex,
  extractCode,
  findByCode,
  findByLongUrl,
  fromBase62,
  incrementVisit,
  parseLongUrl,
  toBase62,
  truncateUrl,
  validateAlias,
} from './url-shortener.utils.ts';

const link = (code: string, longUrl: string): ShortLink => ({
  code,
  longUrl,
  createdAt: 0,
  clicks: 0,
  lastVisitedAt: null,
  isCustom: false,
});

const ok = (result: ReturnType<typeof parseLongUrl>) => {
  assert.ok('url' in result, `expected a url, got ${JSON.stringify(result)}`);
  return result.url;
};
const failure = (result: ReturnType<typeof parseLongUrl>) => {
  assert.ok('error' in result, `expected an error, got ${JSON.stringify(result)}`);
  return result.error;
};

// --- URL validation is a trust boundary: only http(s) may reach an href -------
assert.equal(failure(parseLongUrl('javascript:alert(1)')).message, ERROR.urlProtocol);
assert.equal(failure(parseLongUrl('JavaScript:alert(1)')).message, ERROR.urlProtocol);
assert.equal(failure(parseLongUrl('data:text/html,<script>x</script>')).message, ERROR.urlProtocol);
assert.equal(failure(parseLongUrl('ftp://files.example.com')).message, ERROR.urlProtocol);
assert.equal(failure(parseLongUrl('   ')).message, ERROR.urlRequired);
assert.equal(failure(parseLongUrl('https://')).message, ERROR.urlInvalid);
assert.equal(failure(parseLongUrl('not a url')).message, ERROR.urlInvalid);
assert.equal(failure(parseLongUrl('localhost')).message, ERROR.urlInvalid);

// bare host gets https, and the URL is normalised on the way out
assert.equal(ok(parseLongUrl('example.com')), 'https://example.com/');
assert.equal(ok(parseLongUrl('  https://example.com/a?b=1  ')), 'https://example.com/a?b=1');
assert.equal(ok(parseLongUrl('http://example.com')), 'http://example.com/');
assert.equal(ok(parseLongUrl('https://example.com/a#frag')), 'https://example.com/a#frag');

// normalisation is what makes duplicate detection work
assert.equal(ok(parseLongUrl('example.com/a')), ok(parseLongUrl('https://example.com/a')));

// --- base62 round-trips and never collides over a long run -------------------
assert.equal(toBase62(0), 'a');
assert.equal(fromBase62(toBase62(FIRST_ID)), FIRST_ID);
const codes = new Set<string>();
for (let id = FIRST_ID; id < FIRST_ID + 5000; id += 1) {
  const code = toBase62(id);
  assert.equal(fromBase62(code), id);
  codes.add(code);
}
assert.equal(codes.size, 5000);
assert.ok(toBase62(FIRST_ID).length >= 3);

// --- alias rules -------------------------------------------------------------
const existing = [link('taken', 'https://example.com/')];
const index = buildLinkIndex(existing);
assert.equal(validateAlias('my-link_1', index), null);
assert.equal(validateAlias('ab', index)!.message, ERROR.aliasLength);
assert.equal(validateAlias('a'.repeat(25), index)!.message, ERROR.aliasLength);
assert.equal(validateAlias('has space', index)!.message, ERROR.aliasCharset);
assert.equal(validateAlias('bad/slash', index)!.message, ERROR.aliasCharset);
assert.equal(validateAlias('admin', index)!.message, ERROR.aliasReserved);
assert.equal(validateAlias('TAKEN', index)!.message, ERROR.aliasTaken); // case-insensitive

// --- indexed lookups ---------------------------------------------------------
assert.equal(findByLongUrl(index, 'https://example.com/')!.code, 'taken');
assert.equal(findByLongUrl(index, 'https://other.com/'), undefined);
assert.equal(findByCode(index, '  TAKEN ')!.code, 'taken');
assert.equal(findByCode(index, 'missing'), undefined);
assert.equal(extractCode('https://short.ly/abc123'), 'abc123');
assert.equal(extractCode('short.ly/abc123/'), 'abc123');
assert.equal(extractCode('  abc123 '), 'abc123');

// codes are keyed lower-case, so a differently-cased alias cannot slip past the taken check
assert.equal(validateAlias('tAkEn', buildLinkIndex([link('TAKEN', 'https://example.com/')]))!.message, ERROR.aliasTaken);

// `links` is newest-first, so dedupe hands back the most recent link for a destination —
// the same row the linear `find` returned before the index existed
const sameTarget = [link('newer', 'https://dup.com/'), link('older', 'https://dup.com/')];
assert.equal(findByLongUrl(buildLinkIndex(sameTarget), 'https://dup.com/')!.code, 'newer');
assert.equal(
  findByLongUrl(buildLinkIndex(sameTarget), 'https://dup.com/'),
  sameTarget.find((item) => item.longUrl === 'https://dup.com/'),
);

// the index must agree with a linear scan — the thing it replaced
const scan = [link('aa1', 'https://a.com/'), link('bb2', 'https://b.com/'), link('cc3', 'https://c.com/')];
const scanIndex = buildLinkIndex(scan);
for (const probe of ['aa1', 'AA1', 'bb2', 'cc3', 'nope']) {
  assert.deepEqual(
    findByCode(scanIndex, probe),
    scan.find((item) => item.code.toLowerCase() === probe.trim().toLowerCase()),
  );
}

// --- visits are immutable and touch one row ---------------------------------
const two = [link('aaa', 'https://a.com/'), link('bbb', 'https://b.com/')];
const visited = incrementVisit(two, 'aaa', 1234);
assert.equal(visited[0].clicks, 1);
assert.equal(visited[0].lastVisitedAt, 1234);
assert.equal(visited[1], two[1]); // untouched row keeps its reference
assert.equal(two[0].clicks, 0); // original not mutated

// --- display helper ----------------------------------------------------------
assert.equal(truncateUrl('https://example.com/short'), 'https://example.com/short');
const long = `https://example.com/${'x'.repeat(120)}`;
assert.equal(truncateUrl(long).length, 58);
assert.ok(truncateUrl(long).startsWith('https://example.com/'));
assert.ok(truncateUrl(long).endsWith('x'));

// --- storage never throws and never trusts what it reads --------------------
assert.deepEqual(parseState(null), { links: [], nextId: FIRST_ID });
assert.deepEqual(parseState('{ not json'), { links: [], nextId: FIRST_ID });
assert.deepEqual(parseState('"a string"'), { links: [], nextId: FIRST_ID });
assert.deepEqual(parseState('{"links":"nope"}'), { links: [], nextId: FIRST_ID });

const stored = {
  links: [
    link('good', 'https://example.com/'),
    { code: 'bad', longUrl: 'https://example.com/', clicks: 'lots' }, // wrong shape
    null,
  ],
  nextId: FIRST_ID + 40,
};
const restored = parseState(JSON.stringify(stored));
assert.deepEqual(restored.links.map((item) => item.code), ['good']);
assert.equal(restored.nextId, FIRST_ID + 40);

// a stale nextId must never rewind far enough to re-issue an existing code
assert.equal(parseState(JSON.stringify({ links: [link('a', 'https://a.com/')], nextId: 5 })).nextId, FIRST_ID + 1);

// round-trip
const round = parseState(JSON.stringify({ links: [link('keep', 'https://k.com/')], nextId: FIRST_ID + 1 }));
assert.equal(round.links[0].longUrl, 'https://k.com/');

console.log('url-shortener.utils: all checks passed');
