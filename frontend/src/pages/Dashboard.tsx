import MatchCard from '../components/MatchCard';
import { useMatches } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data: matches, isLoading, error } = useMatches();

  if (isLoading) return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING ARENA...</div>;
  if (error) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCHES</div>;

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-display text-white border-b-2 border-white/10 pb-4">
          UPCOMING MATCHES
        </h1>
      </header>

      {user?.is_guest && (
        <div className="glass-panel border-l-4 border-l-ipl-gold p-6 bg-ipl-gold/5 flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-700">
          <div className="p-2 bg-ipl-gold/10 rounded-lg">
            <Sparkles className="w-6 h-6 text-ipl-gold" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-display uppercase text-sm tracking-widest">Welcome to the Guest Arena</h3>
            <p className="text-gray-400 text-xs font-display leading-relaxed">
              You're currently exploring as a <span className="text-ipl-gold font-bold">GUEST</span>. Feel free to view live matches, check the leaderboard, and see community predictions. Note that guests cannot submit their own predictions.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {matches?.length === 0 ? (
          <p className="text-gray-400">No matches synced yet.</p>
        ) : (
          matches?.map((match: any) => (
            <MatchCard key={match.id} {...match} />
          ))
        )}
      </div>
    </div>
  );
}
