/** Exactly the dummyjson.com /todos item shape the Karat prompt hands you. */
export interface Todo {
  id: number;
  todo: string;
  completed: boolean;
  userId: number;
}

/** Exactly the dummyjson.com /todos response envelope. */
export interface TodoPage {
  todos: Todo[];
  total: number;
  skip: number;
  limit: number;
}

export interface UserGroup {
  userId: number;
  todos: Todo[];
}

/** Local edits only — the server copy stays pristine and a refetch never loses them. */
export type Patch = Partial<Pick<Todo, 'todo' | 'completed'>>;
export type PatchMap = Record<number, Patch>;
