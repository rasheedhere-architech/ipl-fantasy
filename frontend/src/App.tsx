import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MatchPage from './pages/MatchPage';
import Leaderboard from './pages/Leaderboard';
import Admin from './pages/Admin';
import AdminQuestionManager from './pages/AdminQuestionManager';
import Layout from './components/Layout';

import AuthCallback from './pages/AuthCallback';

import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#0B0E1A',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'Outfit, sans-serif',
            fontSize: '12px',
            letterSpacing: '0.05em',
            borderRadius: '0px',
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#F4C430', // IPL Gold
              secondary: '#0B0E1A',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#E84040', // IPL Live Red
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Protected Routes Wrapper (mocked for now) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="match/:id" element={<MatchPage />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="admin" element={<Admin />} />
          <Route path="admin/questions" element={<AdminQuestionManager />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
