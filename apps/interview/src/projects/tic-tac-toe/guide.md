# Tic-Tac-Toe (N×N) — Interview Build Guide

Build a two-player tic-tac-toe that starts at 3×3 and scales to an N×N board with a configurable
K-in-a-row win, shows whose turn it is, detects win and draw, highlights the winning line, supports
undo and a new game, keeps score, and renders any number of independent boards from a prop. Plain
JavaScript, fresh CodeSandbox. Target 45–60 minutes.

This is the single most reported Atlassian browser-coding question (GreatFrontEnd lists *Tic-tac-toe*
and *Tic-tac-toe II*; LeetCode, FrontendLead and Glassdoor reports describe the same loop). The
interviewer does not stop at a working 3×3. They keep adding: *"now N×N"*, *"now the number of boards
comes in as a prop"*, *"now undo"*, *"now tell me the winner faster"*. Each extension is only cheap if
the first version was shaped right. That is what this guide optimises for.

**What gets built, and what gets only discussed**

| | Decision |
| --- | --- |
| State | **The move list is the only state.** Board, current player, winner and draw are all derived. Undo is `moves.slice(0, -1)`. |
| Win check | **Walk the 4 axes out from the last move**, at most `K − 1` steps each way — `O(K)` per move, any `K ≤ N`. The full-board scan is written first as the oracle and kept as the test. |
| Many boards | A self-contained `<Game>` owns its own hook. N boards = render it N times. No lifted state. |
| Discussed, not built | Per-line counters (`O(1)`, only when `K = N`), early draw detection, AI opponent (minimax), online multiplayer. |

**Minute budget**

| Time | Phase |
| --- | --- |
| 0–5 | Requirements, assumptions out loud |
| 5–10 | HLD, the "moves are the state" decision, state list |
| 10–18 | 3×3 board on screen, clicks alternate X/O |
| 18–30 | **Win detection — the algorithm section** |
| 30–38 | N×N + K-in-a-row, draw, new game |
| 38–46 | Undo, scores, N boards as a prop |
| 46–55 | Keyboard grid, ARIA, status region |
| 55–60 | Demo, trade-off talk |

---

## 0. Sandbox setup

React + JS template, one file. Split only when it stops fitting on screen.

```text
src/
  App.jsx
  styles.css
```

Target split (this repo's layout):

```text
tic-tac-toe/
  index.tsx                          # arena: board count + default size, renders N <Game>
  tic-tac-toe.types.ts               # Player, Cell, GameConfig, GameStatus, Scoreboard
  tic-tac-toe.css
  constants/tic-tac-toe.constants.ts # sizes, board limits, status messages
  utils/tic-tac-toe.utils.ts         # pure: playerForMove, buildBoard, lineThrough,
                                     #       findWinnerByScan (oracle), deriveStatus, nextCell
  utils/tic-tac-toe.utils.check.ts   # assertions + differential test vs the oracle
  hooks/use-tic-tac-toe.ts           # one game: moves, scores, derived board/status, keyboard
  hooks/use-arena.ts                 # board count, default size
  components/game.tsx                # one independent game: header, status, board, footer
  components/board.tsx               # the grid of cell buttons
```

Say: *"Win logic is pure so I can test it without React. One hook owns a game. The component that
renders a game has no knowledge that other games exist — so 'N boards' is a loop, not a refactor."*

---

## 1. Requirement gathering (5 minutes)

1. **"3×3 only, or should the board size be configurable?"**
   Hard-coding the 8 winning lines (`[[0,1,2],[3,4,5],…]`) is fine for 3×3 and a dead end for N×N.
   Ask now so you do not write the lookup table and then throw it away.
   *Default: configurable N, starting at 3.*
2. **"On a big board, is it N in a row or K in a row?"**
   N-in-a-row on 10×10 is unwinnable in practice; gomoku-style boards use K < N. This decides whether
   a per-line counter trick is legal (only when K = N) — the algorithm discussion hangs on it.
   *Default: K is configurable, `3 ≤ K ≤ N`, defaulting to N.*
3. **"Two humans on one screen, or against the computer?"**
   *Default: two humans, X always starts.*
4. **"Undo? Move history?"**
   This decides the state shape. If yes, you want a move list, not a mutable board.
   *Default: undo while the game is live.*
5. **"Several boards at once — does each keep its own score?"**
   *Default: yes, fully independent; board count comes in as a prop.*
6. **"Keyboard and screen reader?"**
   *Default: yes — one Tab stop, arrows inside the grid, a live status line.*
7. **"Should the game declare a draw early when no line can be completed?"**
   *Default: no — draw when the board is full; early draw is a discussed follow-up.*

Then state the plan in one breath:

> "The only state is the ordered list of cells played. The board is a replay of that list, the player
> to move is its length's parity, and the winner can only come from the last move — so I check the four
> lines through that one cell, `O(K)`, instead of scanning the board. I'll write the full scan first as
> a reference and assert the two agree. Each board is a self-contained component, so N boards is a map."

---

## 2. High-level design (HLD)

```text
            ┌──────────────────────────── <Arena boardCount=N defaultSize=S> ──────┐
            │   Array.from({length: N}) → <Game key=i initialSize=S />             │
            └───────────────┬───────────────────────────────────────────────────────┘
                            │ each Game owns its own hook — nothing shared
                            ▼
 click / Enter   ┌──────────────────┐      ┌──────────────────────────────┐
 ──────────────▶ │ play(index)      │ ───▶ │ moves: number[]  (the truth) │
                 │  guard: live &   │      └──────────────┬───────────────┘
                 │  empty cell      │                     │ useMemo
                 └──────────────────┘                     ▼
                                          ┌────────────────────────────────┐
                                          │ board = buildBoard(moves, N)   │ O(moves)
                                          │ status = deriveStatus(...)     │
                                          │   └─ lineThrough(last move)    │ O(K)
                                          └──────────────┬─────────────────┘
                                                         ▼
                                     ┌──────────────────────────────────────┐
                                     │ <Board> cells · status (aria-live)   │
                                     │ Undo = moves.slice(0,-1)             │
                                     └──────────────────────────────────────┘
```

Claims to make about this picture:

- **One source of truth.** Storing `board`, `currentPlayer` and `winner` separately is the classic bug
  farm — three pieces of state that must change together in every handler. A move list cannot
  disagree with itself.
- **The winner can only be created by the last move.** Play stops at the first win, so every earlier
  position had no winner. That single observation is what turns an `O(N²)` scan into `O(K)`.
- **Scoring happens in the event, not in an effect.** An effect that watches `status` and increments a
  counter double-counts under StrictMode and re-counts after undo/redo. Compute the next status inside
  `play` and score it there.
- **N boards need no coordination.** If a follow-up asks for a shared leaderboard, lift only the
  scores; the games stay independent.

---

## 3. Low-level design (LLD)

### State

```js
const [size, setSize]           = useState(initialSize); // N
const [winLength, setWinLength] = useState(initialSize); // K, 3 ≤ K ≤ N
const [moves, setMoves]         = useState([]);          // cell indices in play order — THE state
const [scores, setScores]       = useState({ X: 0, O: 0, draws: 0 });
const [tabStop, setTabStop]     = useState(0);           // roving tabindex: the one focusable cell
```

### Derived (never stored)

```js
const board  = useMemo(() => buildBoard(moves, size), [moves, size]);
const status = useMemo(() => deriveStatus(board, moves, size, winLength), [board, moves, size, winLength]);
```

### Refs

```js
const cellRefs = useRef(new Map()); // index -> button, so arrow keys can call .focus()
```

Say why it is a ref: which DOM node sits at index 7 is not UI state; storing it in state would render
on every mount.

### Pure function signatures

```js
playerForMove(turn)                          -> 'X' | 'O'     // parity
buildBoard(moves, size)                      -> Cell[]        // replay, O(moves)
lineThrough(board, size, winLength, index)   -> number[]|null // O(K) — the shipped check
findWinnerByScan(board, size, winLength)     -> 'X'|'O'|null  // O(N²·K) — the oracle
deriveStatus(board, moves, size, winLength)  -> {kind:'playing',next} | {kind:'won',winner,line} | {kind:'draw'}
nextCell(index, key, size)                   -> number        // arrow keys, clamped
```

---

## 4. The data model

```json
{
  "size": 5,
  "winLength": 4,
  "moves": [12, 6, 13, 7, 14],
  "scores": { "X": 2, "O": 1, "draws": 0 }
}
```

The board is a flat array of `N²` cells, index `row * N + col`. A 2-D array works too; the flat one
wins because a move is one number, a winning line is a list of numbers, and neighbours are index
arithmetic.

**The fork worth naming — store the board, or store the moves?**

| | Store `board` + `currentPlayer` + `winner` | Store `moves` only |
| --- | --- | --- |
| Play | update 3 things together | push one number |
| Undo | needs a separate history stack of boards | `moves.slice(0, -1)` |
| Replay / time travel | extra work | free — slice to any length |
| Bug surface | three states that can disagree | none — everything is derived |
| Cost | `O(1)` read | `O(moves)` replay per render; ≤ 100 cells, irrelevant |

Say the cost out loud and dismiss it with the number: at most `N² = 100` moves on the largest board.

`GameStatus` is a discriminated union rather than `winner` + `isDraw` booleans — the impossible state
"won *and* drawn" cannot be represented.

---

## 5. Pass 1 — the board on screen (target: 8 minutes)

```jsx
const playerForMove = (turn) => (turn % 2 === 0 ? 'X' : 'O');

function buildBoard(moves, size) {
  const board = Array.from({ length: size * size }, () => null);
  moves.forEach((cell, turn) => { board[cell] = playerForMove(turn); });
  return board;
}

export default function App() {
  const size = 3;
  const [moves, setMoves] = useState([]);
  const board = buildBoard(moves, size);

  const play = (index) => {
    if (board[index]) return;
    setMoves([...moves, index]);
  };

  return (
    <div className="board" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {board.map((cell, index) => (
        <button key={index} className="cell" onClick={() => play(index)}>{cell}</button>
      ))}
    </div>
  );
}
```

Demonstrate: clicks alternate X and O, an occupied cell ignores clicks. Point at `playerForMove` — no
`currentPlayer` state exists.

---

## 6. Pass 2 — win detection (target: 12 minutes)

This is the part the question exists for. Say every rung; build V0, then V3.

### 6.1 The ladder

#### V0 — scan the whole board (the oracle)

```js
const AXES = [[0, 1], [1, 0], [1, 1], [1, -1]]; // row, column, diagonal, anti-diagonal

function findWinnerByScan(board, size, winLength) {
  for (let index = 0; index < board.length; index++) {
    const player = board[index];
    if (!player) continue;
    const row = Math.floor(index / size), col = index % size;
    for (const [dRow, dCol] of AXES) {
      let count = 1;
      while (count < winLength) {
        const r = row + dRow * count, c = col + dCol * count;
        if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== player) break;
        count++;
      }
      if (count === winLength) return player;
    }
  }
  return null;
}
```

`O(N² · K)` per move. On 3×3 that is nothing; the problem is not speed, it is that it checks lines the
last move could not possibly have touched. It is obviously correct, which is why it stays as the test.

#### V1 — hard-coded 8 lines

```js
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const winner = LINES.find(([a, b, c]) => board[a] && board[a] === board[b] && board[a] === board[c]);
```

The React-tutorial answer. `O(1)` for 3×3 and **wrong the moment N changes** — the table is data you
would have to generate. If you write this, the "now N×N" follow-up is a rewrite. Mention it; don't
ship it.

#### V2 — per-line counters, `O(1)` per move (only when K = N)

Keep `rows[N]`, `cols[N]`, `diag`, `anti` counters. X adds +1, O adds −1. A move at `(r, c)` updates
at most 4 counters; `|counter| === N` is a win.

```js
function applyMove(counters, r, c, player, n) {
  const d = player === 'X' ? 1 : -1;
  counters.rows[r] += d;
  counters.cols[c] += d;
  if (r === c) counters.diag += d;
  if (r + c === n - 1) counters.anti += d;
  return [counters.rows[r], counters.cols[c], counters.diag, counters.anti].some((v) => Math.abs(v) === n);
}
```

Optimal for K = N. It **breaks for K < N**: a row counter of 3 on a 10-wide row says nothing about
whether the three are adjacent. Undo needs the reverse update. It also does not tell you *which*
cells won without a second pass.

#### V3 — walk out from the last move ← **build this**

Only a line through the cell just played can be new. Walk each of the 4 axes in both directions from
that cell, at most `K − 1` steps each way, counting same-player cells.

```js
function lineThrough(board, size, winLength, index) {
  const player = board[index];
  if (!player) return null;
  const row = Math.floor(index / size), col = index % size;

  for (const [dRow, dCol] of AXES) {
    const line = [index];
    for (const sign of [1, -1]) {                 // both directions — a gap filled mid-run counts
      let r = row + dRow * sign, c = col + dCol * sign;
      for (let step = 1; step < winLength; step++) {
        if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== player) break;
        line.push(r * size + c);
        r += dRow * sign; c += dCol * sign;
      }
    }
    if (line.length >= winLength) return line.sort((a, b) => a - b);
  }
  return null;
}
```

`O(K)` time (4 axes × 2 directions × ≤ K−1 steps), `O(K)` space for the line, works for every `K ≤ N`,
returns the winning cells for highlighting, needs no extra state, and undo is free because nothing was
accumulated.

### 6.2 Comparison

| Rung | Per move | Works for K < N | Winning cells | Extra state | Undo |
| --- | --- | --- | --- | --- | --- |
| V0 full scan | `O(N²·K)` | yes | yes | none | free |
| V1 8-line table | `O(1)` | **no (3×3 only)** | yes | none | free |
| V2 line counters | `O(1)` | **no** | needs 2nd pass | `2N + 2` ints | reverse update |
| **V3 walk from last move** | **`O(K)`** | **yes** | **yes** | **none** | **free** |

On a 10×10 with K = 5: V0 ≈ 100 × 4 × 5 = 2 000 cell reads per move; V3 ≤ 4 × 2 × 4 = 32.

### 6.3 Why V3 wins

What changed is not the loop, it is *what gets examined*. V0 answers "does anyone have a line anywhere?"
— a question whose answer was already *no* before this move. V3 answers the only question that can have
changed: "did this move complete a line?". V2 is faster still but only by encoding the assumption
K = N into its state, which is exactly the assumption the interviewer's next follow-up removes.

**Ship V3 in a 45-minute interview.** It is 15 lines, it survives every follow-up in this guide
(N×N, K < N, highlight, undo, multiple boards) without changes, and it is provably equal to V0 —
which you prove with the differential check below rather than by argument. Name V2 as the `O(1)`
option if K is fixed to N.

This is not dynamic programming; nothing is memoised across moves. It is a locality argument: the set
of lines that can change is the set through the changed cell.

### 6.4 Status

```js
function deriveStatus(board, moves, size, winLength) {
  const last = moves[moves.length - 1];
  if (last !== undefined) {
    const line = lineThrough(board, size, winLength, last);
    if (line) return { kind: 'won', winner: board[last], line };
  }
  if (moves.length === size * size) return { kind: 'draw' };
  return { kind: 'playing', next: playerForMove(moves.length) };
}
```

Order matters: check the win before the draw — the last move on a full board can be a winning move.

---

## 7. Pass 3 — N×N, K, new game, undo, scores (target: 10 minutes)

```js
const changeSize = (next) => { setSize(next); setWinLength((k) => Math.min(k === size ? next : k, next)); setMoves([]); };
const undo = () => { if (status.kind === 'playing') setMoves((m) => m.slice(0, -1)); };
const newGame = () => setMoves([]);

const play = (index) => {
  if (status.kind !== 'playing' || board[index] !== null) return;
  const nextMoves = [...moves, index];
  setMoves(nextMoves);
  const next = deriveStatus(buildBoard(nextMoves, size), nextMoves, size, winLength);
  if (next.kind === 'won') setScores((s) => ({ ...s, [next.winner]: s[next.winner] + 1 }));
  if (next.kind === 'draw') setScores((s) => ({ ...s, draws: s.draws + 1 }));
};
```

Say why undo is disabled once the game ends: undoing a finished game would leave a win in the score
that no longer happened. The alternative — derive scores from a list of completed games — is correct
too and worth naming if the interviewer wants undo-after-win.

Changing N resets the game. A 3×3 position means nothing on a 5×5 grid.

---

## 8. Pass 4 — N boards from a prop (target: 5 minutes)

```jsx
function Arena({ boardCount, defaultSize }) {
  return Array.from({ length: boardCount }, (_, i) => (
    <Game key={i} title={`Board ${i + 1}`} initialSize={defaultSize} />
  ));
}
```

Everything that belongs to a game lives in `useTicTacToe` inside `<Game>`. Nothing about the other
boards leaks in, so this is a map, not a refactor. `key={i}` is deliberate here: removing the last
board must not reset the others, and boards are never reordered.

If the follow-up is "one global scoreboard across boards", lift only `scores` via an `onResult`
callback prop. The boards stay independent.

---

## 9. Pass 5 — keyboard and screen readers (target: 6 minutes)

- **One Tab stop for the grid** (roving `tabIndex`): the focused cell has `tabIndex=0`, all others −1.
  A 10×10 board with 100 Tab stops is technically focusable and practically unusable.
- **Arrows move, Enter/Space plays** — buttons already fire `click` on Enter/Space.
- **`aria-disabled`, not `disabled`, on filled cells.** A `disabled` button leaves the focus order and
  the arrow keys would skip it — the grid would have holes.
- **Every cell has a label**: "Row 2, column 3, X". Screen readers otherwise announce "button X".
- **Status in `role="status"`** (`aria-live="polite"`), so "O to move" and "X wins" are announced.

```js
function nextCell(index, key, size) {
  const row = Math.floor(index / size), col = index % size;
  if (key === 'ArrowRight') return col < size - 1 ? index + 1 : index;
  if (key === 'ArrowLeft')  return col > 0 ? index - 1 : index;
  if (key === 'ArrowDown')  return row < size - 1 ? index + size : index;
  if (key === 'ArrowUp')    return row > 0 ? index - size : index;
  return index;
}
```

---

## 10. The single-file version — what you actually type

Assumes the CSS classes exist. No styles here.

```jsx
import { useMemo, useRef, useState } from 'react';

/* ───────────── constants/tic-tac-toe.constants.js ───────────── */

const MIN_SIZE = 3;
const MAX_SIZE = 10;
const SIZE_OPTIONS = Array.from({ length: MAX_SIZE - MIN_SIZE + 1 }, (_, i) => MIN_SIZE + i);
const AXES = [[0, 1], [1, 0], [1, 1], [1, -1]]; // row, column, diagonal, anti-diagonal

/* ───────────── utils/tic-tac-toe.utils.js — pure ───────────── */

const playerForMove = (turn) => (turn % 2 === 0 ? 'X' : 'O'); // X opens: no currentPlayer state

const clampWinLength = (k, size) => Math.min(size, Math.max(3, k));

function buildBoard(moves, size) {
  const board = Array.from({ length: size * size }, () => null);
  moves.forEach((cell, turn) => { board[cell] = playerForMove(turn); });
  return board;
}

// V3: only a line through the last move can be new. O(K).
function lineThrough(board, size, winLength, index) {
  const player = board[index];
  if (!player) return null;
  const row = Math.floor(index / size), col = index % size;
  for (const [dRow, dCol] of AXES) {
    const line = [index];
    for (const sign of [1, -1]) {
      let r = row + dRow * sign, c = col + dCol * sign;
      for (let step = 1; step < winLength; step++) {
        if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== player) break;
        line.push(r * size + c);
        r += dRow * sign; c += dCol * sign;
      }
    }
    if (line.length >= winLength) return line.sort((a, b) => a - b);
  }
  return null;
}

// V0: the oracle. O(N²·K). Tested against, never called by the UI.
function findWinnerByScan(board, size, winLength) {
  for (let index = 0; index < board.length; index++) {
    const player = board[index];
    if (!player) continue;
    const row = Math.floor(index / size), col = index % size;
    for (const [dRow, dCol] of AXES) {
      let count = 1;
      while (count < winLength) {
        const r = row + dRow * count, c = col + dCol * count;
        if (r < 0 || r >= size || c < 0 || c >= size || board[r * size + c] !== player) break;
        count++;
      }
      if (count === winLength) return player;
    }
  }
  return null;
}

function deriveStatus(board, moves, size, winLength) {
  const last = moves[moves.length - 1];
  if (last !== undefined) {
    const line = lineThrough(board, size, winLength, last);
    if (line) return { kind: 'won', winner: board[last], line }; // win before draw
  }
  if (moves.length === size * size) return { kind: 'draw' };
  return { kind: 'playing', next: playerForMove(moves.length) };
}

function nextCell(index, key, size) {
  const row = Math.floor(index / size), col = index % size;
  if (key === 'ArrowRight') return col < size - 1 ? index + 1 : index;
  if (key === 'ArrowLeft') return col > 0 ? index - 1 : index;
  if (key === 'ArrowDown') return row < size - 1 ? index + size : index;
  if (key === 'ArrowUp') return row > 0 ? index - size : index;
  return index;
}

/* ───────────── hooks/use-tic-tac-toe.js ───────────── */

function useTicTacToe(initialSize) {
  const [size, setSize] = useState(initialSize);
  const [winLength, setWinLength] = useState(initialSize);
  const [moves, setMoves] = useState([]);                       // THE state
  const [scores, setScores] = useState({ X: 0, O: 0, draws: 0 });
  const [tabStop, setTabStop] = useState(0);                    // roving tabindex
  const cellRefs = useRef(new Map());

  const board = useMemo(() => buildBoard(moves, size), [moves, size]);
  const status = useMemo(() => deriveStatus(board, moves, size, winLength), [board, moves, size, winLength]);

  const play = (index) => {
    if (status.kind !== 'playing' || board[index] !== null) return;
    const nextMoves = [...moves, index];
    setMoves(nextMoves);
    const next = deriveStatus(buildBoard(nextMoves, size), nextMoves, size, winLength); // score in the event
    if (next.kind === 'won') setScores((s) => ({ ...s, [next.winner]: s[next.winner] + 1 }));
    if (next.kind === 'draw') setScores((s) => ({ ...s, draws: s.draws + 1 }));
  };

  const undo = () => { if (status.kind === 'playing') setMoves((m) => m.slice(0, -1)); };
  const newGame = () => setMoves([]);
  const changeSize = (next) => {
    setSize(next);
    setWinLength((k) => clampWinLength(k === size ? next : k, next));
    setMoves([]);
    setTabStop(0);
  };
  const changeWinLength = (k) => { setWinLength(clampWinLength(k, size)); setMoves([]); };

  const onCellKeyDown = (event, index) => {
    const target = nextCell(index, event.key, size);
    if (target === index) return;
    event.preventDefault();                                     // arrows would scroll the page
    cellRefs.current.get(target)?.focus();
  };

  return { size, winLength, board, status, moves, scores, tabStop, setTabStop, cellRefs,
    play, undo, newGame, changeSize, changeWinLength, onCellKeyDown };
}

/* ───────────── components/game.jsx ───────────── */

function Game({ title, initialSize }) {
  const g = useTicTacToe(initialSize);
  const { status } = g;
  const winning = new Set(status.kind === 'won' ? status.line : []);
  const message = status.kind === 'won' ? `${status.winner} wins`
    : status.kind === 'draw' ? 'Draw — board full' : `${status.next} to move`;

  return (
    <article className="game">
      <header>
        <h2>{title}</h2>
        <select value={g.size} onChange={(e) => g.changeSize(Number(e.target.value))}>
          {SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}×{n}</option>)}
        </select>
        <select value={g.winLength} onChange={(e) => g.changeWinLength(Number(e.target.value))}>
          {SIZE_OPTIONS.filter((k) => k <= g.size).map((k) => <option key={k} value={k}>{k} in a row</option>)}
        </select>
      </header>

      <p className="status" role="status">{message}</p>

      <div className="board" role="group" aria-label={`${g.size} by ${g.size} board`}
        style={{ gridTemplateColumns: `repeat(${g.size}, 1fr)` }}>
        {g.board.map((cell, index) => (
          <button
            key={index}
            ref={(el) => { if (el) g.cellRefs.current.set(index, el); else g.cellRefs.current.delete(index); }}
            className={`cell ${winning.has(index) ? 'cell--win' : ''}`}
            tabIndex={index === g.tabStop ? 0 : -1}
            aria-disabled={cell !== null || status.kind !== 'playing'} // not `disabled`: keeps arrows working
            aria-label={`Row ${Math.floor(index / g.size) + 1}, column ${(index % g.size) + 1}, ${cell ?? 'empty'}`}
            onClick={() => g.play(index)}
            onKeyDown={(e) => g.onCellKeyDown(e, index)}
            onFocus={() => g.setTabStop(index)}
          >
            {cell}
          </button>
        ))}
      </div>

      <footer>
        <button onClick={g.undo} disabled={g.moves.length === 0 || status.kind !== 'playing'}>Undo</button>
        <button onClick={g.newGame}>New game</button>
        <span>X {g.scores.X} · O {g.scores.O} · draws {g.scores.draws}</span>
      </footer>
    </article>
  );
}

/* ───────────── App.jsx ───────────── */

export default function App() {
  const [boardCount, setBoardCount] = useState(1);
  return (
    <main>
      <label>
        Boards
        <input type="number" min={1} max={4} value={boardCount}
          onChange={(e) => setBoardCount(Math.min(4, Math.max(1, Number(e.target.value))))} />
      </label>
      <div className="games">
        {Array.from({ length: boardCount }, (_, i) => (
          <Game key={i} title={`Board ${i + 1}`} initialSize={3} />
        ))}
      </div>
    </main>
  );
}
```

**Build it in this order:** `playerForMove` + `buildBoard` + a clickable 3×3 (on screen in 8 minutes)
→ `findWinnerByScan` as the first win check → `lineThrough` + `deriveStatus`, swap the read path →
size/K selects → undo + new game + scores → extract `<Game>` and map N of them → roving tabindex,
labels, status region.

Narrate two lines while typing, because they are what the question is really testing:
`moves.forEach((cell, turn) => board[cell] = playerForMove(turn))` — *"the board is a replay; there is
no second copy of the truth"* — and the `for (const sign of [1, -1])` loop — *"both directions, because
a move can fill a gap in the middle of a run."*

---

## 11. Verification

```bash
node src/projects/tic-tac-toe/utils/tic-tac-toe.utils.check.ts
```

The first line it prints is the one to read aloud: `differential: 2250 random games, … positions,
lineThrough === scan` — every size 3–7, every K, the fast check agrees with the oracle on every move.

Demo script:

1. 3×3: X top row → "X wins", cells highlighted, board stops accepting moves, score X 1.
2. New game, play to a full board with no line → "Draw — board full".
3. Play the last cell *as a winning move* on a full board → it says win, not draw.
4. Switch to 6×6, K = 4; fill `0, 1, 3` then `2` → the gap-fill wins (both-direction walk).
5. Play two moves, Undo twice → back to empty, "X to move". Undo is disabled after a win.
6. Boards = 3 → three independent games; play on board 2, boards 1 and 3 untouched.
7. Tab into a grid → one stop; arrows move; Enter plays; screen reader reads "Row 1, column 1, empty".

---

## 12. Cross-questions and answers

**"Make it faster."**
Already `O(K)` per move and independent of N. The only faster option is V2's `O(1)` counters, which
are valid only for K = N. On a 3×3 none of this is measurable — say so; the point of V3 is that it
generalises, not that it saves microseconds.

**"Detect a draw before the board is full."**
A line is dead once it contains both marks. Track, per possible K-window, whether it still has only one
player's marks; when no live window remains, it's a draw. Precompute the window list once per (N, K):
`O(N² · 4)` windows, each move updates the windows through its cell — `O(K²)` per move in the worst
case. Not worth it for 3×3; worth naming.

**"Add a computer opponent."**
Minimax with alpha-beta for 3×3 (the full tree is ~255k games, alpha-beta makes it instant). For N×N,
minimax is infeasible; use depth-limited search with a heuristic (count open K-windows per player) or a
simple rule-based bot (win if you can, block if you must, else centre/near your pieces). Run it in a
worker if it can block the main thread.

**"Two players on different machines."**
The move list is already the perfect wire format — append-only, ordered. Server is authoritative:
client sends `{gameId, index, expectedMoveCount}`; the server rejects if `expectedMoveCount` is stale
(optimistic concurrency), validates turn and emptiness, appends, broadcasts over a WebSocket. Clients
replay. Reconnect = fetch the move list.

**"Persist the game across reloads."**
`localStorage.setItem(key, JSON.stringify({ size, winLength, moves }))` — three numbers and an array.
Derive everything else on load. Version the key so a later shape change doesn't crash old saves.

**"Why is `key={index}` fine here when it's usually a smell?"**
It is a smell for lists that reorder or insert in the middle — state follows the index, not the item.
Boards here are only appended/removed at the end and never reordered, so index *is* identity.

**"Time travel — jump to move 5."**
`moves.slice(0, 5)` for display; keep the full list and a `cursor` if the user can step forward again.
Playing a new move from the middle truncates the redo tail, same as an editor.

**"How would you test this?"**
The win logic is pure: unit tests for each axis, the gap-fill, win-on-full-board, plus the differential
test against the scan across thousands of random games (deterministic seed, so a failure reproduces).
Component tests with Testing Library: click sequences, status text, keyboard navigation. No test needs
React for the algorithm — that is why it is in `utils`.

**"What about accessibility of the winning line?"**
Colour alone fails WCAG 1.4.1. The status text says who won; add `aria-label` suffix "winning cell" on
highlighted cells, or a visually hidden list of the winning coordinates.
