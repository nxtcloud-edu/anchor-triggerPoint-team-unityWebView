import { useEffect, useState, type DependencyList } from 'react';

/** command 함수 호출 결과를 상태로 — 의존값이 바뀌면 다시 불러온다 */
export const useAsync = <T>(fn: () => Promise<T>, deps: DependencyList) => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fn()
      .then(r => {
        if (!alive) return;
        setData(r);
        setError('');
      })
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, deps);

  return { data, error, loading };
};

export const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};
