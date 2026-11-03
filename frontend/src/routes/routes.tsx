import { AppLayout } from '@/components/layout/AppLayout';
import AdminPage from '@/pages/admin';
import LoginPage from '@/pages/login';
import MePage from '@/pages/me';
import PlatoonDetailPage from '@/pages/platoonDetail';
import PlatoonsPage from '@/pages/platoons';
import UserDetailPage from '@/pages/userDetail';
import UsersPage from '@/pages/users';
import { PrivateRoute } from '@/routes/privateRoute';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

export const AppRouter = () => (
  <BrowserRouter basename={import.meta.env.BASE_URL}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/me/:userId" element={<MePage />} />
      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/platoons" element={<PlatoonsPage />} />
        <Route path="/platoons/:platoonId" element={<PlatoonDetailPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/:userId" element={<UserDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  </BrowserRouter>
);
