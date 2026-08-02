import { Routes, Route } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext.jsx';
import LandingPage from './components/LandingPage.jsx';
import WhiteboardRoom from './components/WhiteboardRoom.jsx';

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:roomCode" element={<WhiteboardRoom />} />
      </Routes>
    </ToastProvider>
  );
}
