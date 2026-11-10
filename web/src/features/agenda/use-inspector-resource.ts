import { useEffect, useState } from 'react';

export type InspectorResource<T> =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; data: T }
  | { key: string; status: 'error'; error: unknown };

export function useInspectorResource<T>(key: string, load: () => Promise<T>, revision: number): InspectorResource<T> {
  const [result, setResult] = useState<InspectorResource<T>>({ key, status: 'loading' });
  useEffect(() => {
    let active = true;
    if (!key) return () => { active = false; };
    setResult({ key, status: 'loading' });
    void load().then((data) => {
      if (active) setResult({ key, status: 'ready', data });
    }).catch((error: unknown) => {
      if (active) setResult({ key, status: 'error', error });
    });
    return () => { active = false; };
  }, [key, load, revision]);
  return result.key === key ? result : { key, status: 'loading' };
}
