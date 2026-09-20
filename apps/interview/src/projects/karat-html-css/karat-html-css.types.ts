export interface CssTask {
  id: string;
  title: string;
  /** The prompt as it is handed over in the round. */
  prompt: string;
  /** Where this one was reported. */
  reported: string;
  /** What the grader is actually looking at. */
  checks: string[];
  /** The lines that fail people, and why. */
  traps: string[];
  /** Widths worth flipping between; the first is the default. */
  widths: number[];
  html: string;
  css: string;
  /** Extra script for the demo document. `formErrors` is injected separately. */
  js?: string;
  /** Inject the pure validator's source into the demo document. */
  needsValidator?: boolean;
}

export interface FormValues {
  name: string;
  email: string;
  password: string;
  confirm: string;
  terms: boolean;
}

export type FormErrors = Partial<Record<keyof FormValues, string>>;
