import { MESSAGE, SIZE_OPTIONS } from '../constants/tic-tac-toe.constants';
import { useTicTacToe } from '../hooks/use-tic-tac-toe';
import { Board } from './board';

interface GameProps {
  title: string;
  initialSize: number;
}

/** One fully independent game. Render it N times and you have N boards — no shared state. */
export function Game({ title, initialSize }: GameProps) {
  const game = useTicTacToe(initialSize);
  const { status } = game;

  const message =
    status.kind === 'won'
      ? MESSAGE.won(status.winner)
      : status.kind === 'draw'
        ? MESSAGE.draw
        : MESSAGE.turn(status.next);

  return (
    <article className="ttt__game">
      <header className="ttt__head">
        <h2 className="ttt__title">{title}</h2>
        <label className="ttt__field">
          Size
          <select value={game.size} onChange={(event) => game.changeSize(Number(event.target.value))}>
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}×{size}
              </option>
            ))}
          </select>
        </label>
        <label className="ttt__field">
          In a row
          <select
            value={game.winLength}
            onChange={(event) => game.changeWinLength(Number(event.target.value))}
          >
            {SIZE_OPTIONS.filter((k) => k <= game.size).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p
        className={`ttt__status ttt__status--${status.kind}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </p>

      <Board
        size={game.size}
        board={game.board}
        winningLine={status.kind === 'won' ? status.line : null}
        isOver={status.kind !== 'playing'}
        tabStop={game.tabStop}
        onPlay={game.play}
        onKeyDown={game.handleCellKeyDown}
        onFocusCell={game.setTabStop}
        registerCell={game.registerCell}
      />

      <footer className="ttt__foot">
        <button
          type="button"
          className="ttt__btn"
          onClick={game.undo}
          disabled={game.moveCount === 0 || status.kind !== 'playing'}
        >
          Undo
        </button>
        <button type="button" className="ttt__btn ttt__btn--primary" onClick={game.newGame}>
          New game
        </button>
        <span className="ttt__score">
          X {game.scores.X} · O {game.scores.O} · draws {game.scores.draws}
        </span>
      </footer>
    </article>
  );
}
