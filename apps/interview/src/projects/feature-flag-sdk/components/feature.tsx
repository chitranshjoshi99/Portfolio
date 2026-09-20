import type { ReactNode } from 'react';
import { useFeatureFlag } from '../hooks/use-feature-flag';

interface FeatureProps {
  name: string;
  /** Rendered when the flag is off — and while loading, so the page never flashes the new UI. */
  fallback?: ReactNode;
  defaultValue?: boolean;
  children: ReactNode;
}

/** <Feature name="new-editor" fallback={<OldEditor />}><NewEditor /></Feature> */
export function Feature({ name, fallback = null, defaultValue = false, children }: FeatureProps) {
  const { enabled, isLoading } = useFeatureFlag(name, defaultValue);
  if (isLoading) return <>{fallback}</>;
  return <>{enabled ? children : fallback}</>;
}
