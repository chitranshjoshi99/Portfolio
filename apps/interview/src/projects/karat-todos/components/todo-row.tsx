import type { Todo } from '../karat-todos.types';

interface TodoRowProps {
  todo: Todo;
  isEdited: boolean;
  isEditing: boolean;
  onToggle: (id: number) => void;
  onStartEdit: (id: number) => void;
  onSave: (id: number, text: string) => void;
  onCancel: () => void;
}

export function TodoRow({ todo, isEdited, isEditing, onToggle, onStartEdit, onSave, onCancel }: TodoRowProps) {
  return (
    <li className={`kt__row ${todo.completed ? 'kt__row--done' : ''}`}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        aria-label={`Mark "${todo.todo}" ${todo.completed ? 'not done' : 'done'}`}
      />
      {isEditing ? (
        <form
          className="kt__edit"
          onSubmit={(event) => {
            event.preventDefault();
            const input = event.currentTarget.elements.namedItem('text') as HTMLInputElement;
            onSave(todo.id, input.value);
          }}
        >
          <input
            name="text"
            defaultValue={todo.todo}
            autoFocus
            aria-label="Todo text"
            onKeyDown={(event) => event.key === 'Escape' && onCancel()}
          />
          <button type="submit">Save</button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </form>
      ) : (
        <>
          {/* Rendered as text. The one hostile row proves it: its <img onerror> never runs. */}
          <span className="kt__text">{todo.todo}</span>
          {isEdited && <span className="kt__badge">edited</span>}
          <button type="button" className="kt__link" onClick={() => onStartEdit(todo.id)}>
            Edit
          </button>
        </>
      )}
    </li>
  );
}
