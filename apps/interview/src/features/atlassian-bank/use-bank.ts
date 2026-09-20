import { useMemo, useState } from 'react';
import { QUESTIONS } from './bank.data';
import type { BankQuestion, Round } from './bank.types';

const matches = (question: BankQuestion, needle: string): boolean => {
  if (!needle) return true;
  return (
    question.prompt.toLowerCase().includes(needle) ||
    question.answer.toLowerCase().includes(needle) ||
    question.sources.join(' ').toLowerCase().includes(needle) ||
    (question.projectId ?? '').includes(needle)
  );
};

export function useBank() {
  const [query, setQuery] = useState('');
  const [round, setRound] = useState<Round | 'all'>('all');

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () => QUESTIONS.filter((question) => (round === 'all' || question.round === round) && matches(question, needle)),
    [needle, round],
  );

  /** Counts describe the search result, not the selected round, or every other tab reads zero. */
  const counts = useMemo(() => {
    const result = {} as Record<Round, number>;
    for (const question of QUESTIONS) {
      if (!matches(question, needle)) continue;
      result[question.round] = (result[question.round] ?? 0) + 1;
    }
    return result;
  }, [needle]);

  return {
    query,
    setQuery,
    round,
    setRound,
    visible,
    counts,
    total: QUESTIONS.length,
    matching: QUESTIONS.filter((question) => matches(question, needle)).length,
  };
}
