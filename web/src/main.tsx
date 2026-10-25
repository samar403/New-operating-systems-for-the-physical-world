import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import './styles.css';
import { AppShell } from './layouts/AppShell';
import { startStrata } from './lib/store';
import Landing from './pages/landing/Landing';

const page = (load: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(load);
  return (
    <Suspense fallback={<div className="mono blink p-6 text-[12px] uppercase tracking-[0.2em] text-muted">Loading…</div>}>
      <C />
    </Suspense>
  );
};

const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: page(() => import('./pages/app/CommandCenter')) },
      { path: 'twin', element: page(() => import('./pages/app/Twin')) },
      { path: 'work', element: page(() => import('./pages/app/WorkOrders')) },
      { path: 'agents', element: page(() => import('./pages/app/Workforce')) },
      { path: 'timeline', element: page(() => import('./pages/app/ShiftTape')) },
      { path: 'assets', element: page(() => import('./pages/app/Assets')) },
      { path: 'safety', element: page(() => import('./pages/app/Safety')) },
      { path: 'copilot', element: page(() => import('./pages/app/Copilot')) },
      { path: 'field', element: page(() => import('./pages/app/Field')) },
      { path: 'settings', element: page(() => import('./pages/app/Settings')) },
    ],
  },
  { path: '*', element: <Landing /> },
]);

void startStrata();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
