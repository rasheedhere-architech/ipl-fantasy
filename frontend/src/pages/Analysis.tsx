import { useAnalysis, useLeaderboard } from '../api/hooks/useMatches';
import { Trophy, TrendingUp, Medal, Calendar, BarChart3, Star, Zap, Crown } from 'lucide-react';

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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Elite Performance Visual Chart */}
        <section className="xl:col-span-3 glass-panel p-8 bg-gradient-to-b from-white/[0.03] to-transparent overflow-x-auto custom-scrollbar">
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
              const experts = leaderboard?.filter((u: any) => !u.is_guest).slice(0, 8) || [];
              const expertStatsList = experts.map((u: any) => data?.powerups_stats?.find((s: any) => s.username === u.username));
              const maxWins = Math.max(...expertStatsList.map((s: any) => s?.match_wins || 0), 0);
              
              const maxPoints = experts.length > 0
                ? Math.max(...experts.map((u: any) => u.total_points))
                : 1;

              return experts.map((user: any) => {
                const expertStats = data?.powerups_stats?.find((s: any) => s.username === user.username);
                const matchWins = expertStats?.match_wins || 0;
                const isTopWinner = matchWins > 0 && matchWins === maxWins;
                
                const matchPoints = user.total_points - user.base_points;
                const matchHeight = (matchPoints / maxPoints) * 100;
                const baseHeight = (user.base_points / maxPoints) * 100;

                return (

                  <div key={user.username} className="relative flex flex-col items-center group w-20">
                    {/* Achievement Stars */}
                    {matchWins > 0 && (
                      <div className="absolute -top-14 flex items-center justify-center gap-0.5 w-full">
                        {Array.from({ length: Math.min(matchWins, 3) }).map((_, i) => (
                          <Star key={i} className={`w-2 h-2 text-ipl-gold fill-ipl-gold animate-pulse`} style={{ animationDelay: `${i * 200}ms` }} />
                        ))}
                        {matchWins > 3 && <span className="text-[8px] text-ipl-gold font-bold">+{matchWins - 3}</span>}
                      </div>
                    )}

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
                      {isTopWinner && (
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 animate-bounce">
                          <Crown className="w-5 h-5 text-ipl-gold fill-ipl-gold drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]" />
                        </div>
                      )}
                      <div className={`w-14 h-14 rounded-full border-2 group-hover:border-ipl-gold transition-all overflow-hidden z-20 bg-ipl-surface shadow-2xl scale-125 ${
                        matchWins > 0 ? 'border-ipl-gold shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'border-white/10'
                      }`}>
                        <img
                          src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full blur-xl transition-opacity ${
                        matchWins > 0 ? 'bg-ipl-gold/20 opacity-100' : 'bg-ipl-gold/10 opacity-0 group-hover:opacity-100'
                      }`} />
                    </div>

                    {/* Username & Wins */}
                    <div className="flex flex-col items-center mt-4">
                      <span className="text-[10px] font-display text-gray-500 uppercase tracking-widest text-center truncate w-full">
                        {user.username}
                      </span>
                      {matchWins > 0 && (
                        <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 bg-ipl-gold/10 rounded-full border border-ipl-gold/20 shadow-[0_0_10px_rgba(255,215,0,0.1)]">
                          <Trophy className="w-2.5 h-2.5 text-ipl-gold" />
                          <span className="text-[9px] font-bold text-ipl-gold font-mono">{matchWins}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </section>

        {/* Weekly Trending Column */}
        <div className="xl:col-span-1 space-y-6">
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
                    <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-ipl-surface ${idx === 0 ? 'bg-ipl-gold text-black' :
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
      </div>

      {/* Powerups Usage Section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-ipl-gold pl-4">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-ipl-gold" />
            <div>
              <h2 className="text-xl font-display text-white italic tracking-tight">Powerup <span className="text-ipl-gold">Tracker</span></h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Expert Strategic Usage</p>
            </div>
          </div>

          {/* Skill Rank Legend */}
          <div className="flex flex-wrap items-center gap-4 bg-white/5 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm self-start md:self-auto">
            <span className="text-[9px] text-gray-600 uppercase tracking-widest font-mono mr-1">Rank Key:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
              <span className="text-[9px] text-purple-400 font-bold uppercase">Elite 50%+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
              <span className="text-[9px] text-green-400 font-bold uppercase">Expert 35%+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
              <span className="text-[9px] text-blue-400 font-bold uppercase">Senior 20%+</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full" />
              <span className="text-[9px] text-gray-600 font-bold uppercase tracking-tight">Contender</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...(data?.powerups_stats || [])]
            .sort((a: any, b: any) => (b.avg_points_per_powerup || 0) - (a.avg_points_per_powerup || 0))
            .map((stat: any) => {
            const getSkillClass = (accuracy: number) => {
              if (accuracy >= 50) return { label: 'Elite Predictor', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' };
              if (accuracy >= 35) return { label: 'Expert Picker', bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' };
              if (accuracy >= 20) return { label: 'Senior Analyst', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' };
              return { label: 'Contender', bg: 'bg-white/5', border: 'border-white/10', text: 'text-gray-400' };
            };
            const skill = getSkillClass(stat.prediction_accuracy);

            return (
              <div key={stat.username} className="glass-panel p-5 space-y-5 relative group transition-all hover:bg-white/[0.04]">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={stat.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stat.username}`}
                        className={`w-10 h-10 rounded-full border-2 transition-colors ${skill.border} group-hover:border-ipl-gold/50`}
                        alt=""
                      />
                      {stat.used_matches.length > 0 && (
                        <div className="absolute -top-1 -right-1">
                          <Zap className="w-3 h-3 text-ipl-gold fill-ipl-gold animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-display text-white uppercase tracking-tight group-hover:text-ipl-gold transition-colors">{stat.username}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-[7px] px-1.5 py-0.5 rounded-full border uppercase font-bold tracking-widest ${skill.bg} ${skill.border} ${skill.text}`}>
                          {skill.label}
                        </span>
                        {stat.match_wins > 0 && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-ipl-gold/10 border border-ipl-gold/20 rounded-full text-[7px] text-ipl-gold font-bold uppercase tracking-widest">
                            <Trophy className="w-2.5 h-2.5" /> {stat.match_wins} {stat.match_wins === 1 ? 'Win' : 'Wins'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span className="text-2xl font-display text-ipl-gold">{stat.base_powerups - stat.used_matches.length}</span>
                    <span className="text-[9px] text-gray-600 uppercase font-bold tracking-widest">Rem</span>
                  </div>
                </div>
              </div>

              {/* Effectiveness Stats */}
              <div className="flex items-center gap-2 py-3 border-y border-white/5">
                <div className="flex-1 min-w-0">
                  <p className="text-[7px] text-gray-500 uppercase font-mono truncate">Accuracy</p>
                  <p className={`text-xs font-display ${stat.prediction_accuracy > 35 ? 'text-green-400' : 'text-white'
                    }`}>{stat.prediction_accuracy}%</p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex-1 min-w-0 text-center">
                  <p className="text-[7px] text-gray-500 uppercase font-mono truncate">Efficiency</p>
                  <p className="text-xs font-display text-white">{stat.avg_points_per_powerup}</p>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div className="flex-1 min-w-0 text-right">
                  <p className="text-[7px] text-gray-500 uppercase font-mono truncate">Net Yield</p>
                  <p className="text-xs font-display text-ipl-gold">+{stat.total_powerup_points}</p>
                </div>
              </div>

              {/* Visual Inventory */}
              <div className="flex gap-1 h-1">
                {Array.from({ length: stat.base_powerups }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-all duration-500 ${i < stat.used_matches.length
                      ? 'bg-ipl-gold shadow-[0_0_8px_rgba(255,215,0,0.5)]'
                      : 'bg-white/5'
                      }`}
                  />
                ))}
              </div>

              {/* Usage History */}
              <div className="space-y-4 pt-2 border-t border-white/5">
                {/* Victory Record */}
                {stat.won_matches.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 opacity-60">
                      <Medal className="w-3 h-3 text-ipl-gold" /> Podium Victories
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {stat.won_matches.map((mNo: string) => (
                        <div key={mNo} className="px-2 py-0.5 bg-ipl-gold text-black rounded-sm text-[8px] font-bold shadow-[0_0_10px_rgba(255,215,0,0.2)]">
                          M{mNo}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Deployment Logs */}
                <div className="space-y-2">
                  <p className="text-[9px] text-gray-500 uppercase tracking-widest flex items-center gap-1.5 opacity-60">
                    <Zap className="w-3 h-3" /> Powerup Deployments
                  </p>
                  <div className="flex flex-wrap gap-1.5 min-h-[40px]">
                    {stat.used_matches.length > 0 ? (
                      stat.used_matches.map((m: any) => (
                        <div 
                          key={m.match_id} 
                          className={`px-2 py-0.5 border rounded-sm text-[8px] font-mono tracking-tighter transition-all cursor-default ${
                            m.match_status !== 'completed' ? 'bg-white/5 border-white/5 text-gray-500' :
                            m.points >= 40 ? 'bg-green-500/10 border-green-500/20 text-green-400 font-bold' :
                            m.points >= 20 ? 'bg-ipl-gold/10 border-ipl-gold/20 text-ipl-gold/70' :
                            m.points < 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-white/5 border-white/10 text-gray-400'
                          }`}
                          title={m.match_status === 'completed' ? `${m.points} points earned` : 'Pending calculation'}
                        >
                          M{m.match_number}: {m.teams}
                          {m.match_status === 'completed' && <span className="ml-1 opacity-50">({m.points})</span>}
                        </div>
                      ))
                    ) : (
                      <div className="w-full h-full flex items-center justify-center border border-dashed border-white/5 rounded p-2">
                        <span className="text-[8px] text-gray-700 uppercase tracking-[0.2em]">Idle Stage</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Subtle background glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-ipl-gold/0 to-ipl-gold/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4">
          <Medal className="w-6 h-6 text-ipl-gold" />
          <div>
            <h2 className="text-xl font-display text-white">Match Podiums</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Top 3 Players per Match</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data?.recent_podiums?.map((match: any) => (
            <div key={match.match_id} className="glass-panel overflow-hidden flex flex-col group transition-all hover:border-white/20">
              <div className="bg-white/5 p-3 flex justify-between items-center border-b border-white/5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-display text-gray-500 uppercase tracking-widest">
                    {formatDate(match.match_date)}
                  </span>
                  <span className="text-xs font-display text-white uppercase group-hover:text-ipl-gold transition-colors">
                    M{match.match_number}: {match.match_name}
                  </span>
                </div>
                <Trophy className="w-4 h-4 text-ipl-gold opacity-30" />
              </div>

              <div className="p-4 space-y-3 bg-gradient-to-br from-transparent to-white/[0.02]">
                {match.top_players.map((player: any) => (
                  <div key={player.username} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-mono w-4 ${player.rank === 1 ? 'text-ipl-gold' :
                        player.rank === 2 ? 'text-gray-300' :
                          'text-[#CD7F32]'
                        }`}>#{player.rank}</span>
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
      </section>
    </div>
  );
}
