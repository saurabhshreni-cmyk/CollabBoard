import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { ToastProvider } from './context/ToastContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import LandingPage from './components/LandingPage.jsx';
import NotFoundPage from './components/NotFoundPage.jsx';

// The board pulls in the canvas engine, which is most of the bundle. Loading
// it on demand keeps the landing page small and fast.
const WhiteboardRoom = lazy(() => import('./components/WhiteboardRoom.jsx'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center" role="status" aria-label="Loading">
      <span className="inline-block w-10 h-10 border-indigo-500 border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3, borderStyle: 'solid' }} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/room/:roomCode" element={<WhiteboardRoom />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </ErrorBoundary>
  );
}
