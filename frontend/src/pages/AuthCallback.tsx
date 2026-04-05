import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // Fetch user profile from the backend
      apiClient.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((response) => {
          setUser(response.data, token);
          navigate('/dashboard');
        })
        .catch((error) => {
          console.error('Failed to fetch user profile', error);
          navigate('/login?error=auth_failed');
        });
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
