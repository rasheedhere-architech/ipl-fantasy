import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';

import { useQueryClient } from '@tanstack/react-query';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // Clear any old session before fetching new profile
      useAuthStore.getState().logout();
      queryClient.clear();
      
      const fetchProfile = (retries = 2) => {
        apiClient.get('/auth/me', { 
          headers: { Authorization: `Bearer ${token}` } 
        })
        .then((response) => {
          setUser(response.data, token);
          const redirectTo = localStorage.getItem('redirect_after_login') || '/matchcenter';
          localStorage.removeItem('redirect_after_login');
          navigate(redirectTo);
        })
        .catch((error) => {
          if (retries > 0) {
            console.warn(`Profile fetch failed, retrying... (${retries} left)`);
            setTimeout(() => fetchProfile(retries - 1), 1000);
          } else {
            console.error('Failed to fetch user profile after retries', error);
            navigate('/login?error=auth_failed');
          }
        });
      };

      fetchProfile();
    } else {
      navigate('/login?error=no_token');
    }
  }, [searchParams, navigate, setUser]);

  return (
    <div className="min-h-screen bg-ipl-navy flex justify-center items-center">
      <div className="text-white font-display text-2xl animate-pulse">Authenticating...</div>
    </div>
  );
}
