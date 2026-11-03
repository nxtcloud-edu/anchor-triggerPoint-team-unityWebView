import { fetchMe, login as loginCommand } from '@/api/command';
import type { AdminUser, LoginRequest } from '@/api/types';
import { clearToken, hasAuth, setToken } from '@/utils/auth';
import { create } from 'zustand';

const DEV_ACCOUNT = 'developer';

interface AuthState {
  user: AdminUser | null;
  initialized: boolean;
  refresh: () => Promise<void>;
  login: (body: LoginRequest) => Promise<void>;
  /** 목 모드 전용 — 아이디·비밀번호 없이 개발자 계정으로 로그인 */
  devLogin: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(set => ({
  user: null,
  initialized: false,
  refresh: async () => {
    if (!hasAuth()) {
      set({ user: null, initialized: true });
      return;
    }
    try {
      set({ user: await fetchMe(), initialized: true });
    } catch {
      clearToken();
      set({ user: null, initialized: true });
    }
  },
  login: async body => {
    const res = await loginCommand(body);
    setToken(res.token);
    set({ user: res.user });
  },
  devLogin: async () => {
    const res = await loginCommand({ username: DEV_ACCOUNT, password: DEV_ACCOUNT });
    setToken(res.token);
    set({ user: res.user });
  },
  logout: () => {
    clearToken();
    set({ user: null });
  },
}));
