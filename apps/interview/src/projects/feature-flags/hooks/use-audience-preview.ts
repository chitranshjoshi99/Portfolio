import { useMemo, useState } from 'react';
import { AUDIENCE } from '../constants/flag-seed';
import type { AudienceUser, Environment, Evaluation, FeatureFlag } from '../feature-flags.types';
import { evaluate } from '../utils/rollout.utils';

export interface AudienceRow {
  user: AudienceUser;
  evaluation: Evaluation;
  /** The override currently stored for this user, if any. Drives the force on/off controls. */
  override: boolean | undefined;
}

export interface UseAudiencePreview {
  selected: FeatureFlag | null;
  select: (key: string) => void;
  rows: AudienceRow[];
  enabledCount: number;
}

/**
 * Evaluates one flag against the sample audience.
 *
 * The selection is held by key, not by object: a mutation replaces the flag object, and a
 * selection holding the old one would keep showing pre-save numbers.
 */
export function useAudiencePreview(flags: FeatureFlag[], environment: Environment): UseAudiencePreview {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const selected = flags.find((flag) => flag.key === selectedKey) ?? flags[0] ?? null;

  // Pure derivation, so it is a memo and not state — nothing here can drift from the flag.
  const rows = useMemo(
    () =>
      selected
        ? AUDIENCE.map((user) => ({
            user,
            evaluation: evaluate(selected, environment, user),
            override: selected.rules[environment].overrides[user.id],
          }))
        : [],
    [environment, selected],
  );

  return {
    selected,
    select: setSelectedKey,
    rows,
    enabledCount: rows.filter((row) => row.evaluation.enabled).length,
  };
}
