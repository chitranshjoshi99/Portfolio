export type Round =
  | 'karat-css'
  | 'karat-trivia'
  | 'karat-sd'
  | 'ui-coding'
  | 'js-coding'
  | 'system-design'
  | 'react'
  | 'ai-round'
  | 'values';

export type Frequency = 'very-high' | 'high' | 'medium' | 'low';

export interface BankQuestion {
  id: string;
  round: Round;
  /** The prompt as it was reported, trimmed but not rewritten. */
  prompt: string;
  /** The answer, or the approach that gets full marks. One or two sentences. */
  answer: string;
  /** Where it was reported. */
  sources: string[];
  /** The project in this app that builds it. */
  projectId?: string;
  frequency: Frequency;
}

export const ROUND_LABELS: Record<Round, string> = {
  'karat-css': 'Karat · HTML & CSS',
  'karat-trivia': 'Karat · trivia',
  'karat-sd': 'Karat · 20-min design',
  'ui-coding': 'Browser / UI round',
  'js-coding': 'JS / SDK round',
  'system-design': 'Frontend system design',
  react: 'React follow-ups',
  'ai-round': 'AI-assisted round',
  values: 'Values & management',
};

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  'very-high': 'asked constantly',
  high: 'asked often',
  medium: 'reported a few times',
  low: 'reported once / aggregator only',
};
