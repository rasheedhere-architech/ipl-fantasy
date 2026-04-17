import { useAnalysis, useLeaderboard } from '../api/hooks/useMatches';
import { Trophy, TrendingUp, Medal, Calendar, BarChart3, Star } from 'lucide-react';

export default function Analysis() {
  const { data, isLoading: isAnalysisLoading } = useAnalysis();
  const { data: leaderboard, isLoading: isLBLoading } = useLeaderboard();

  const isLoading = isAnalysisLoading || isLBLoading;


  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(dateStr));
    } catch (e) {
      return dateStr;
    }
  };


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-ipl-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 font-display tracking-widest text-xs uppercase animate-pulse">Running Deep Analysis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <header className="relative py-8 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-ipl-gold/5 to-transparent skew-x-12 -translate-x-1/2" />
        <div className="relative">
          <h1 className="text-4xl font-display text-white tracking-tight">Performance <span className="text-ipl-gold">Analytics</span></h1>
          <p className="text-gray-400 mt-2 font-display text-xs uppercase tracking-[0.3em] opacity-60 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-ipl-gold" />
            Insights & Historic Trends
          </p>
        </div>
      </header>

      {/* Elite Performance Visual Chart (Reference Image Style) */}
      <section className="glass-panel p-8 bg-gradient-to-b from-white/[0.03] to-transparent overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
          <Star className="w-5 h-5 text-ipl-gold" />
          <h2 className="text-xl font-display text-white uppercase tracking-tight">Elite Performance Split</h2>
          <span className="text-[10px] text-gray-500 ml-auto uppercase tracking-widest font-mono flex items-center gap-4">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-ipl-gold rounded-full" /> Match Points</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white/20 rounded-full" /> Base Points</span>
          </span>
        </div>

        <div className="flex items-end justify-around gap-4 min-w-[600px] h-[400px] pb-12 relative px-4">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5 pr-8">
              {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-t border-white" />)}
            </div>

            {(() => {
              const maxPoints = leaderboard && leaderboard.length > 0 
                ? Math.max(...leaderboard.map((u: any) => u.total_points)) 
                : 1;
              
              return leaderboard?.map((user: any) => {
                const matchPoints = user.total_points - user.base_points;
                const matchHeight = (matchPoints / maxPoints) * 100;
                const baseHeight = (user.base_points / maxPoints) * 100;
                
                return (

                <div key={user.username} className="relative flex flex-col items-center group w-20">
                    {/* Total Value on Top */}
                    <div className="absolute -top-8 text-sm font-display font-bold text-white group-hover:text-ipl-gold transition-colors">
                        {user.total_points}
                    </div>

                    {/* Stacked Bar */}
                    <div className="w-12 flex flex-col justify-end transition-all duration-700 ease-out h-[250px]">
                        {/* Match Points Segment */}
                        <div 
                           className="bg-ipl-gold relative group-hover:brightness-110 transition-all cursor-help"
                           style={{ height: `${matchHeight}%` }}
                        >
                            <span className="absolute -left-12 top-2 text-[10px] font-mono text-ipl-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-0.5 rounded pointer-events-none z-10">
                                Match: {matchPoints}
                            </span>
                        </div>
                        {/* Base Points Segment */}
                        <div 
                           className="bg-white/10 relative group-hover:bg-white/20 transition-all cursor-help"
                           style={{ height: `${baseHeight}%` }}
                        >
                            <span className="absolute -left-12 bottom-2 text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-0.5 rounded pointer-events-none z-10">
                                Base: {user.base_points}
                            </span>
                        </div>
                    </div>

                    {/* Avatar at Bottom */}
                    <div className="mt-4 relative">
                        <div className="w-14 h-14 rounded-full border-2 border-white/10 group-hover:border-ipl-gold transition-all overflow-hidden z-20 bg-ipl-surface shadow-2xl scale-125">
                            <img 
                               src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                               alt="" 
                               className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-ipl-gold/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Username */}
                    <span className="mt-4 text-[10px] font-display text-gray-500 uppercase tracking-widest text-center truncate w-full">
                        {user.username}
                    </span>
                </div>
              );
            });
          })()}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Weekly Trends */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4">
            <TrendingUp className="w-6 h-6 text-ipl-gold" />
            <div>
              <h2 className="text-xl font-display text-white">Weekly Trending</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Top Performers (Last 7 Days)</p>
            </div>
          </div>

          <div className="space-y-3">
            {data?.weekly_podium?.map((user: any, idx: number) => (
              <div key={user.username} className={`glass-panel p-4 flex items-center justify-between group transition-all hover:bg-white/[0.05] ${idx === 0 ? 'border-l-2 border-l-ipl-gold' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img 
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                      className="w-10 h-10 rounded-full border border-white/10"
                      alt=""
                    />
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-ipl-surface ${
                      idx === 0 ? 'bg-ipl-gold text-black' : 
                      idx === 1 ? 'bg-gray-300 text-black' : 
                      'bg-[#CD7F32] text-black'
                    }`}>
                      {idx + 1}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-display text-white group-hover:text-ipl-gold transition-colors">{user.username}</h3>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 font-display">
                      <span className="flex items-center gap-1 uppercase tracking-tighter">
                        <Calendar className="w-3 h-3" /> {user.matches} Matches
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-display text-ipl-gold">+{user.points}</p>
                  <p className="text-[8px] text-gray-600 uppercase tracking-widest leading-none">Total PTS</p>
                </div>
              </div>
            ))}
            {(!data?.weekly_podium || data.weekly_podium.length === 0) && (
                <div className="p-12 text-center glass-panel border-dashed border-2 border-white/5 opacity-30">
                    <p className="text-[10px] font-display uppercase tracking-widest">No match data from the last 7 days</p>
                </div>
            )}
          </div>
        </div>

        {/* Right Column: Match Podiums */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4">
            <Medal className="w-6 h-6 text-ipl-gold" />
            <div>
              <h2 className="text-xl font-display text-white">Match Podiums</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Top 3 Players per Match</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.recent_podiums?.map((match: any) => (
              <div key={match.match_id} className="glass-panel overflow-hidden flex flex-col group transition-all hover:border-white/20">
                <div className="bg-white/5 p-3 flex justify-between items-center border-b border-white/5">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-display text-gray-500 uppercase tracking-widest">
                       {formatDate(match.match_date)}
                    </span>
                    <span className="text-xs font-display text-white uppercase group-hover:text-ipl-gold transition-colors">
                      {match.match_name}
                    </span>
                  </div>
                  <Trophy className="w-4 h-4 text-ipl-gold opacity-30" />
                </div>
                
                <div className="p-4 space-y-3 bg-gradient-to-br from-transparent to-white/[0.02]">
                  {match.top_players.map((player: any, pIdx: number) => (
                    <div key={player.username} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-[10px] font-mono w-4 ${
                          pIdx === 0 ? 'text-ipl-gold' : 
                          pIdx === 1 ? 'text-gray-300' : 
                          'text-[#CD7F32]'
                        }`}>#{pIdx + 1}</span>
                        <div className="flex items-center gap-2">
                          <img 
                            src={player.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${player.username}`} 
                            className="w-6 h-6 rounded-full border border-white/10"
                            alt=""
                          />
                          <span className="text-[11px] font-display text-gray-300">{player.username}</span>
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-ipl-gold">{player.points} pts</span>
                    </div>
                  ))}
                  {match.top_players.length === 0 && (
                      <p className="text-[10px] text-center text-gray-600 uppercase italic py-4">Result pending calculation</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
