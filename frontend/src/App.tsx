import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MatchCenter from './pages/MatchCenter';
import MatchPage from './pages/MatchPage';
import Leaderboard from './pages/Leaderboard';
import Analysis from './pages/Analysis';
import Admin from './pages/Admin';
import Campaigns from './pages/Campaigns';
import CampaignPage from './pages/CampaignPage';
import CampaignBuilderRoute, { CampaignBuilderNewRoute, CampaignBuilderEditRoute } from './pages/CampaignBuilder';
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
          <Route index element={<Navigate to="/matchcenter" replace />} />
          <Route path="matchcenter" element={<MatchCenter />} />
          <Route path="match/:id" element={<MatchPage />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="analysis" element={<Analysis />} />
          <Route path="admin" element={<Admin />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/:id" element={<CampaignPage />} />
          <Route path="admin/campaigns" element={<CampaignBuilderRoute />} />
          <Route path="admin/campaigns/new" element={<CampaignBuilderNewRoute />} />
          <Route path="admin/campaigns/:id/edit" element={<CampaignBuilderEditRoute />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
