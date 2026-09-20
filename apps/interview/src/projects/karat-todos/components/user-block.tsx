import type { PatchMap, UserGroup } from '../karat-todos.types';
import { TodoRow } from './todo-row';

interface UserBlockProps {
  group: UserGroup;
  patches: PatchMap;
  editingId: number | null;
  onToggle: (id: number) => void;
  onStartEdit: (id: number) => void;
  onSave: (id: number, text: string) => void;
  onCancel: () => void;
}

export function UserBlock({ group, patches, editingId, ...handlers }: UserBlockProps) {
  const done = group.todos.filter((todo) => todo.completed).length;
  const headingId = `kt-user-${group.userId}`;

  return (
    <section className="kt__block" aria-labelledby={headingId}>
      <header className="kt__block-head">
        <h2 id={headingId}>User {group.userId}</h2>
        <span>
          {done}/{group.todos.length} done
        </span>
      </header>
      <ul className="kt__list">
        {group.todos.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            isEdited={todo.id in patches}
            isEditing={editingId === todo.id}
            {...handlers}
          />
        ))}
      </ul>
    </section>
  );
}
