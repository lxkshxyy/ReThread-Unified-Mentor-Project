import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { PageLoader } from './components/ui';
import { useAuth } from './context/AuthContext';
import Home from './pages/Home';

const Auth = lazy(() => import('./pages/Auth'));
const Browse = lazy(() => import('./pages/Browse'));
const ItemDetail = lazy(() => import('./pages/ItemDetail'));
const ListingForm = lazy(() => import('./pages/ListingForm'));
const SwapRequest = lazy(() => import('./pages/SwapRequest'));
const Swaps = lazy(() => import('./pages/Swaps'));
const SwapDetail = lazy(() => import('./pages/SwapDetail'));
const Chat = lazy(() => import('./pages/Chat'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Nearby = lazy(() => import('./pages/Nearby'));
const CalculatorPage = lazy(() => import('./pages/Calculator'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/admin/Admin'));
const NotFound = lazy(() => import('./pages/NotFound'));

function RequireAuth({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<GuestOnly><Auth mode="login" /></GuestOnly>} />
          <Route path="register" element={<GuestOnly><Auth mode="register" /></GuestOnly>} />
          <Route path="browse" element={<Browse />} />
          <Route path="items/new" element={<RequireAuth><ListingForm /></RequireAuth>} />
          <Route path="items/:id/edit" element={<RequireAuth><ListingForm /></RequireAuth>} />
          <Route path="items/:id" element={<ItemDetail />} />
          <Route path="swap/new" element={<RequireAuth><SwapRequest /></RequireAuth>} />
          <Route path="swaps" element={<RequireAuth><Swaps /></RequireAuth>} />
          <Route path="swaps/:id" element={<RequireAuth><SwapDetail /></RequireAuth>} />
          <Route path="chat" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="chat/:id" element={<RequireAuth><Chat /></RequireAuth>} />
          <Route path="dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="nearby" element={<Nearby />} />
          <Route path="calculator" element={<CalculatorPage />} />
          <Route path="profile/:id" element={<Profile />} />
          <Route path="settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
          <Route path="admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
