import MatchCard from '../components/MatchCard';
import { useMatches, useMyPredictionStatus } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { Sparkles } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data: matches, isLoading, error } = useMatches();
  const { data: predictedMatchIds } = useMyPredictionStatus();

  if (isLoading) return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING ARENA...</div>;
  if (error) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCHES</div>;

  const todayMatches = matches?.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }) || [];

  const futureMatches = matches?.filter(m => {
    const d = new Date(m.tossTime);
    const now = new Date();
    return d.toDateString() !== now.toDateString();
  }) || [];

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-display text-white border-b-2 border-white/10 pb-4">
          MATCH CENTER
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

      {/* Today's Matches */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-ipl-live pl-4">
          <div className="w-2 h-2 rounded-full bg-ipl-live animate-pulse" />
          <h2 className="text-xl font-display text-white tracking-widest uppercase">Match Day</h2>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {todayMatches.length === 0 ? (
            <div className="glass-panel p-8 text-center border-dashed border-2 border-white/5 opacity-50 col-span-full">
              <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">No matches scheduled for today</p>
            </div>
          ) : (
            todayMatches.map((match: any) => (
              <MatchCard 
                key={match.id} 
                {...match} 
                has_predicted={predictedMatchIds?.includes(match.id)}
              />
            ))
          )}
        </div>
      </section>

      {/* Upcoming Matches */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-white/20 pl-4">
          <h2 className="text-xl font-display text-gray-400 tracking-widest uppercase">Upcoming Sagas</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {futureMatches.length === 0 ? (
            <p className="text-gray-400 col-span-full italic text-xs">No further matches synced for this window.</p>
          ) : (
            futureMatches.map((match: any) => (
              <MatchCard 
                key={match.id} 
                {...match} 
                has_predicted={predictedMatchIds?.includes(match.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
