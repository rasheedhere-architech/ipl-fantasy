import { Trophy } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const handleLogin = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    window.location.href = `${API_URL}/auth/google`;
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
        </div>
      </div>
    </div>
  );
}
