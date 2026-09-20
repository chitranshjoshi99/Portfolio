import { Game } from './components/game';
import { MAX_BOARDS, MIN_BOARDS, SIZE_OPTIONS } from './constants/tic-tac-toe.constants';
import { useArena } from './hooks/use-arena';
import './tic-tac-toe.css';

export default function TicTacToePage() {
  const arena = useArena();

  return (
    <section className="ttt">
      <div className="ttt__arena-controls">
        <label className="ttt__field">
          Boards
          <input
            type="number"
            min={MIN_BOARDS}
            max={MAX_BOARDS}
            value={arena.boardCount}
            onChange={(event) => arena.setBoardCount(Number(event.target.value))}
          />
        </label>
        <label className="ttt__field">
          New boards start at
          <select
            value={arena.defaultSize}
            onChange={(event) => arena.setDefaultSize(Number(event.target.value))}
          >
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}×{size}
              </option>
            ))}
          </select>
        </label>
        <span className="ttt__hint">Arrow keys move between cells · Enter/Space plays</span>
      </div>

      <div className="ttt__games">
        {Array.from({ length: arena.boardCount }, (_, index) => (
          // key = index on purpose: board N keeps its game when boards after it are removed
          <Game key={index} title={`Board ${index + 1}`} initialSize={arena.defaultSize} />
        ))}
      </div>
    </section>
  );
}
