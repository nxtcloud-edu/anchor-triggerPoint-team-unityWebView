import { USE_MOCK } from '@/api/config';
import { BrandMark } from '@/components/header/icons';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { user, login, devLogin } = useAuthStore();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/admin';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => login({ username, password }));
  };

  const inputClass = 'w-full rounded-lg border border-border-default bg-bg-surface px-3 py-2';

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-page px-4">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-[14px] border border-border-default bg-bg-surface p-6"
      >
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <div className="flex flex-col">
            <div className="text-lg font-bold">Trigger_Point</div>
            <div className="text-xs text-text-muted">관리자 로그인</div>
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          아이디
          <input
            className={inputClass}
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          비밀번호
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="text-[13px] text-crit">{error}</div>}
        <Button type="submit" variant="primary" disabled={busy} className="justify-center">
          {busy ? '로그인 중…' : '로그인'}
        </Button>
        {USE_MOCK && (
          <div className="flex flex-col gap-2 border-t border-border-grid pt-4">
            <Button className="justify-center" disabled={busy} onClick={() => void run(devLogin)}>
              개발자 로그인
            </Button>
            <div className="text-center text-xs text-text-muted">
              목 모드 · 더미 데이터로 바로 들어갑니다
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default LoginPage;
