import { Sidebar } from '@/components/header/Sidebar';
import { Toast } from '@/components/ui/Toast';
import { Outlet } from 'react-router-dom';

export const AppLayout = () => (
  <div className="grid min-h-screen grid-cols-1 md:grid-cols-[232px_1fr]">
    <Sidebar />
    <div className="min-w-0 px-4 pt-4 pb-12 md:px-7 md:pt-[22px]">
      <Outlet />
    </div>
    <Toast />
  </div>
);
