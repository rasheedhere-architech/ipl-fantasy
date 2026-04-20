import { Trophy, TerminalSquare } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const devLoginEnabled = import.meta.env.VITE_DEV_LOGIN === 'true';

  const handleLogin = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleDevLogin = async (role: 'admin' | 'user' | 'guest') => {
    try {
      const { data } = await apiClient.post('/auth/dev-login', null, { params: { role } });
      setUser(data.user, data.token);
      toast.success(`Logged in as ${role}`);
      navigate('/matchcenter');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Dev login failed — is DEV_LOGIN_ENABLED=true?');
    }
  };

  return (
    <div className="min-h-screen bg-ipl-navy flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Trophy className="w-20 h-20 text-ipl-gold mx-auto mb-6" />
          <h1 className="text-5xl text-white font-bold tracking-widest">IPL FANTASY</h1>
          <p className="text-gray-400 mt-2 font-display tracking-widest">PRIVATE LEAGUE</p>
        </div>

        <div className="glass-panel p-8 rounded-none border border-white/10 relative group">
          {/* Neon decorative accents */}
          <div className="absolute top-0 left-0 w-8 h-[2px] bg-ipl-gold"></div>
          <div className="absolute top-0 left-0 w-[2px] h-8 bg-ipl-gold"></div>
          <div className="absolute bottom-0 right-0 w-8 h-[2px] bg-ipl-gold"></div>
          <div className="absolute bottom-0 right-0 w-[2px] h-8 bg-ipl-gold"></div>

          {error === 'not_invited' && (
            <div className="bg-ipl-live/20 border border-ipl-live text-white font-display text-center p-3 mb-6 animate-pulse">
              ACCESS DENIED. You are not on the guest list.
            </div>
          )}

          <p className="text-gray-300 mb-8 text-center text-sm">
            Sign in below to submit your predictions and access the leaderboard.
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-black py-4 px-6 font-display uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
            Sign in with Google
          </button>

          {devLoginEnabled && (
            <div className="mt-6 pt-6 border-t border-dashed border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <TerminalSquare className="w-4 h-4 text-ipl-gold" />
                <p className="text-ipl-gold font-display text-[10px] uppercase tracking-widest">Dev Bypass</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['admin', 'user', 'guest'] as const).map(role => (
                  <button
                    key={role}
                    onClick={() => handleDevLogin(role)}
                    className="py-2 border border-white/10 text-gray-400 hover:border-ipl-gold hover:text-ipl-gold font-display text-[10px] uppercase tracking-widest transition-all"
                  >
                    {role}
                  </button>
                ))}
              </div>
              <p className="text-gray-600 text-[10px] font-display mt-2 text-center">
                Requires <code className="text-ipl-gold">DEV_LOGIN_ENABLED=true</code> on backend
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
