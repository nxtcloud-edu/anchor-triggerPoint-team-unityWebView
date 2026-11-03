import '@/index.css';
import '@/stores/themeStore';
import { enableMocking } from '@/mocks/enableMocking';
import { AppRouter } from '@/routes/routes';
import { useAuthStore } from '@/stores/authStore';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const bootstrap = async () => {
  await enableMocking();
  await useAuthStore.getState().refresh();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  );
};

void bootstrap();
