import { useState } from 'react';
import { useAnalysis, useLeaderboard } from '../api/hooks/useMatches';
import { Trophy, TrendingUp, Medal, Calendar, BarChart3, Star, Zap, Crown, Target, ShieldAlert, ShieldCheck, Info, RotateCcw, UserPlus } from 'lucide-react';

export default function Analysis() {
  const { data, isLoading: isAnalysisLoading } = useAnalysis();
  const { data: leaderboard, isLoading: isLBLoading } = useLeaderboard();
  const [trendingTab, setTrendingTab] = useState<'weekly' | 'today'>('today');
  const [accuracySort, setAccuracySort] = useState<'accuracy' | 'percentile'>('accuracy');

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
        <p className="text-gray-400 font-display tracking-widest text-xs uppercase animate-pulse">Crunching the numbers...</p>
      </div>
    );
  }

  const hof = data?.hall_of_fame || {};

  return (
    <div className="space-y-12 pb-12">
      {/* Hall of Fame Widget */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-ipl-gold/10 border border-ipl-gold/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-ipl-gold" />
          </div>
          <div>
            <h2 className="text-xl font-display text-white uppercase tracking-wider">Hall of Fame</h2>
            <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">The Current Season Kings</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            {
              key: 'universe_boss',
              label: 'Universe Boss',
              icon: <Zap className="w-4 h-4" />,
              color: 'text-yellow-400',
              desc: 'Highest Single Score',
              info: 'The Chris Gayle approach. Awarded to the player with the highest points scored in a single match this season.',
              winner: hof.universe_boss
            },
            {
              key: 'heath_streak',
              label: 'Heath Streak',
              icon: <TrendingUp className="w-4 h-4" />,
              color: 'text-ipl-gold',
              desc: 'Longest Winning Run',
              info: 'A tribute to the legend. Awarded for the longest continuous streak of matches without negative points.',
              winner: hof.heath_streak
            },
            {
              key: 'yorker_king',
              label: 'Yorker King',
              icon: <Target className="w-4 h-4" />,
              color: 'text-red-400',
              desc: 'Most Bullseyes',
              info: 'Bumrah-level precision. Awarded for predicting the exact powerplay score of either team.',
              winner: hof.yorker_king
            },
            {
              key: 'dwayne_bravo',
              label: 'Bravo Award',
              icon: <ShieldAlert className="w-4 h-4" />,
              color: 'text-orange-400',
              desc: 'Boldest Predictor',
              info: 'Dwayne Bravo style. Awarded for making extreme predictions (scores < 35 or > 100).',
              winner: hof.dwayne_bravo
            },
            {
              key: 'the_wall',
              label: 'The Wall',
              icon: <ShieldCheck className="w-4 h-4" />,
              color: 'text-blue-400',
              desc: 'Unmatched Consistency',
              info: 'Channeling Rahul Dravid. Awarded for stable high-performance (20+ pts) in 7 of the last 10 matches.',
              winner: hof.the_wall
            },
            {
              key: 'hat_trick',
              label: 'Hat-Trick',
              icon: <Medal className="w-4 h-4" />,
              color: 'text-green-400',
              desc: 'Triple Threat',
              info: 'Malinga Magic. Awarded for scoring 30+ points in 3 consecutive matches.',
              winner: hof.hat_trick
            },
            {
              key: 'the_big_show',
              label: 'The Big Show',
              icon: <Star className="w-4 h-4" />,
              color: 'text-purple-400',
              desc: 'Max Powerup Yield',
              info: 'Glenn Maxwell vibes. Awarded for earning the highest points from a single Powerup usage.',
              winner: hof.the_big_show
            },
            {
              key: 'captain_cool',
              label: 'Captain Cool',
              icon: <Calendar className="w-4 h-4" />,
              color: 'text-emerald-400',
              desc: 'Clutch Performer',
              info: 'The MSD Finish. Awarded for the highest average points in the most recent 5 matches.',
              winner: hof.captain_cool
            },
            {
              key: 'chase_master',
              label: 'Chase Master',
              icon: <BarChart3 className="w-4 h-4" />,
              color: 'text-rose-400',
              desc: 'Biggest Rank Jump',
              info: 'Virat Kohli spirit. Awarded for climbing the most positions on the leaderboard in a single week.',
              winner: hof.chase_master
            },
            {
              key: 'impact_player',
              label: 'Impact Player',
              icon: <Zap className="w-4 h-4" />,
              color: 'text-indigo-400',
              desc: 'Powerplay King',
              info: 'Andre Russell energy. Awarded for the highest total points earned from Powerplay predictions.',
              winner: hof.impact_player
            },
            {
              key: 'switch_hit',
              label: 'Switch Hit',
              icon: <Medal className="w-4 h-4" />,
              color: 'text-fuchsia-400',
              desc: 'Double Bullseye',
              info: 'Kevin Pietersen style. Awarded for correctly predicting the exact powerplay scores of BOTH teams in a single match.',
              winner: hof.switch_hit
            },
            {
              key: 'caught_bowled',
              label: 'Caught & Bowled',
              icon: <Star className="w-4 h-4" />,
              color: 'text-cyan-400',
              desc: 'The Perfect Match',
              info: 'Pollard-level dominance. Awarded for correctly predicting Match Winner, Player of the Match, and a Bullseye in the same match.',
              winner: hof.caught_bowled
            },
            {
              key: 'hit_wicket',
              label: 'Hit Wicket',
              icon: <ShieldAlert className="w-4 h-4" />,
              color: 'text-slate-400',
              desc: 'Powerup Fail',
              info: 'An unfortunate slip. Awarded to players who used a Powerup but ended up with a penalty score.',
              winner: hof.hit_wicket
            },
            {
              key: 'direct_hit',
              label: 'Direct hit but just miss',
              icon: <Target className="w-4 h-4" />,
              color: 'text-red-500',
              desc: 'Heartbreak Miss',
              info: 'Sir Jadeja precision. Awarded for predictions that were off by exactly 1 run from a Bullseye.',
              winner: hof.direct_hit
            },
            {
              key: 'doosra_spinner',
              label: 'Doosra Spinner',
              icon: <RotateCcw className="w-4 h-4" />,
              color: 'text-pink-400',
              desc: 'Wrong Way',
              info: 'The master of misdirection. Awarded to the expert with the most incorrect Match Winner predictions.',
              winner: hof.doosra_spinner
            },
            {
              key: 'one_man_army',
              label: 'One Man Army',
              icon: <UserPlus className="w-4 h-4" />,
              color: 'text-purple-400',
              desc: 'Lone Wolf',
              info: 'Standing alone. Awarded to the expert who is the ONLY person to predict a specific team to win in a match.',
              winner: hof.one_man_army
            }
          ].map((award) => (
            <div key={award.key} className="group relative bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-ipl-gold/30 transition-all duration-500">
              {/* Background Glow (Clipped separately to avoid cutting off tooltips) */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-2xl opacity-10 group-hover:opacity-30 transition-opacity ${award.color.replace('text', 'bg')}`} />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className={`flex items-center justify-between gap-2 mb-3 ${award.color}`}>
                  <div className="flex items-center gap-2">
                    {award.icon}
                    <span className="text-[10px] font-display uppercase tracking-widest">{award.label}</span>
                  </div>
                  <div className="relative group/info">
                    <Info className="w-3.5 h-3.5 text-gray-600 hover:text-gray-400 cursor-help transition-colors" />
                    <div className="absolute bottom-full right-0 mb-2 w-56 p-3 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover/info:opacity-100 pointer-events-none transition-all duration-200 transform translate-y-1 group-hover/info:translate-y-0 z-[100]">
                      <div className="relative">
                        {/* Pointer Arrow */}
                        <div className="absolute -bottom-4 right-1 w-2 h-2 bg-[#1e293b] border-r border-b border-white/10 rotate-45" />
                        <p className="text-[10px] text-gray-300 font-medium leading-relaxed italic">
                          {award.info}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {award.winner && award.winner.length > 0 ? (
                  <div className="flex flex-col flex-grow">
                    <div className="space-y-2 mb-3">
                      {award.winner.map((w: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors">
                          <div className="relative flex-shrink-0">
                            <img
                              src={w.avatar_url || 'https://www.gravatar.com/avatar?d=mp'}
                              alt={w.username}
                              className="h-8 w-8 rounded-full border border-white/10"
                            />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-ipl-gold rounded-full flex items-center justify-center border border-[#0f172a]">
                              <Crown className="w-1.5 h-1.5 text-white" />
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[11px] font-bold text-white truncate leading-tight">
                              {w.username}
                            </span>
                            <span className="text-[9px] text-ipl-gold font-mono uppercase tracking-tighter">
                              {award.key === 'universe_boss' ? `${w.value} Pts` :
                                award.key === 'heath_streak' ? `${w.value} Matches` :
                                  award.key === 'the_wall' ? 'Consistent' :
                                    award.key === 'dwayne_bravo' ? `${w.value} Bold Calls` :
                                      award.key === 'hat_trick' ? `${w.value} Matches` :
                                        award.key === 'the_big_show' ? `${w.value} Pts` :
                                          award.key === 'captain_cool' ? `${Math.round(w.value)} Avg` :
                                            award.key === 'chase_master' ? `+${w.value}` :
                                              award.key === 'impact_player' ? `${w.value} Pts` :
                                                award.key === 'switch_hit' ? `${w.value} Doubles` :
                                                  award.key === 'caught_bowled' ? `${w.value} Perfects` :
                                                    award.key === 'hit_wicket' ? `${w.value} Fails` :
                                                      award.key === 'direct_hit' ? `${w.value} Misses` :
                                                        award.key === 'doosra_spinner' ? `${w.value} Wrongs` :
                                                          award.key === 'one_man_army' ? `${w.value} Solos` :
                                                            `${w.value} Bullseyes`}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-center items-center py-6 opacity-30 grayscale flex-grow">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Vacant</span>
                  </div>
                )}

                <p className="text-[9px] text-gray-400 font-medium leading-relaxed italic border-t border-white/5 pt-2 mt-auto">
                  {award.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
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

      <div className="space-y-12">
        {/* Dynamic Trending Section (Full Width) */}
        <section className="glass-panel p-8 bg-gradient-to-r from-white/[0.03] to-transparent">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 border-b border-white/5 pb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-ipl-gold" />
              <div>
                <h2 className="text-xl font-display text-white uppercase tracking-tight">Trending <span className="text-ipl-gold">Experts</span></h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Top Performers by Points</p>
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 self-start shadow-inner">
              <button
                onClick={() => setTrendingTab('today')}
                className={`px-6 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 ${trendingTab === 'today' ? 'bg-ipl-gold text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                Match Day
              </button>
              <button
                onClick={() => setTrendingTab('weekly')}
                className={`px-6 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 ${trendingTab === 'weekly' ? 'bg-ipl-gold text-black shadow-lg scale-105' : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                Weekly Trend
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(() => {
              const items = trendingTab === 'weekly' ? data?.weekly_podium : data?.today_podium;
              return items?.map((user: any, idx: number) => (
                <div key={user.username} className={`glass-panel p-3 flex flex-row md:flex-col items-center md:items-start group transition-all hover:bg-white/[0.05] relative overflow-hidden ${idx === 0 ? 'border-ipl-gold/40 shadow-[0_0_20px_rgba(255,215,0,0.05)]' : ''}`}>
                  <div className="flex items-center gap-3 md:mb-4 flex-1 md:flex-none">
                    <div className="relative shrink-0">
                      <img
                        src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`}
                        className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10"
                        alt=""
                      />
                      <div className={`absolute -top-1 -right-1 w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-bold border-2 border-ipl-surface shadow-lg ${idx === 0 ? 'bg-ipl-gold text-black' :
                        idx === 1 ? 'bg-gray-300 text-black' :
                          'bg-[#CD7F32] text-black'
                        }`}>
                        {idx + 1}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs md:text-sm font-display text-white group-hover:text-ipl-gold transition-colors truncate uppercase leading-tight">{user.username}</h3>
                      <p className="text-[8px] md:text-[9px] text-gray-500 uppercase tracking-tighter flex items-center gap-1 mt-0.5">
                        <Calendar className="w-2.5 h-2.5" /> {user.matches} {user.matches === 1 ? 'Match' : 'Matches'}
                      </p>
                    </div>
                  </div>
                  <div className="md:mt-auto md:pt-3 md:border-t border-white/5 flex items-baseline justify-end md:justify-between gap-3 shrink-0">
                    <span className="hidden md:inline text-[8px] text-gray-600 uppercase tracking-widest font-bold">Points</span>
                    <span className="text-xl md:text-2xl font-display text-ipl-gold whitespace-nowrap">+{user.points}</span>
                  </div>
                  {idx === 0 && <div className="absolute top-0 right-0 w-6 h-6 md:w-8 md:h-8 bg-ipl-gold/10 rounded-bl-2xl md:rounded-bl-3xl flex items-center justify-center"><Crown className="w-2.5 h-2.5 md:w-3 h-3 text-ipl-gold" /></div>}
                </div>
              ));
            })()}
            {((trendingTab === 'weekly' && (!data?.weekly_podium || data.weekly_podium.length === 0)) ||
              (trendingTab === 'today' && (!data?.today_podium || data.today_podium.length === 0))) && (
                <div className="col-span-full py-12 text-center glass-panel border-dashed border-2 border-white/5 opacity-30 rounded-xl">
                  <p className="text-[10px] font-display uppercase tracking-widest">
                    No active momentum in the last {trendingTab === 'weekly' ? '7 days' : '24 hours'}
                  </p>
                </div>
              )}
          </div>
        </section>

        {/* Elite Performance Visual Chart (Now Full Width) */}
        <section className="glass-panel p-4 md:p-8 bg-gradient-to-b from-white/[0.03] to-transparent overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12 md:mb-20 border-b border-white/5 pb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-ipl-gold/10 rounded-lg">
                <Star className="w-5 h-5 text-ipl-gold" />
              </div>
              <div>
                <h2 className="text-xl font-display text-white uppercase tracking-tight">Elite Performance Split</h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mt-0.5">Player Points Composition</p>
              </div>
            </div>
            <div className="flex items-center gap-4 md:gap-8 bg-white/5 px-4 md:px-5 py-2 rounded-xl border border-white/5 shadow-inner self-start lg:self-center">
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-ipl-gold rounded-full shadow-[0_0_10px_rgba(255,215,0,0.5)]" />
                <span className="text-[8px] md:text-[10px] text-gray-300 uppercase tracking-widest font-mono font-bold">Match</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-white/20 rounded-full" />
                <span className="text-[8px] md:text-[10px] text-gray-400 uppercase tracking-widest font-mono">Base</span>
              </div>
            </div>
          </div>

          {(() => {
            const experts = leaderboard?.filter((u: any) => !u.is_guest) || [];
            const expertStatsList = experts.map((u: any) => data?.powerups_stats?.find((s: any) => s.username === u.username));
            const maxWins = Math.max(...expertStatsList.map((s: any) => s?.match_wins || 0), 0);
            const maxPoints = experts.length > 0 ? Math.max(...experts.map((u: any) => u.total_points)) : 1;

            return (
              <>
                {/* Desktop/Tablet View: Scrollable Bar Chart */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar scrollbar-hide">
                  <div className="flex items-end justify-start gap-6 min-w-max h-[750px] pb-24 pt-48 relative px-8 scrollbar-hide">
                    {/* Horizontal Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-[0.03] pt-48 pb-48">
                      {[0, 1, 2, 3, 4].map(i => <div key={i} className="border-t border-white" />)}
                    </div>

                    {experts.map((user: any) => {
                      const expertStats = data?.powerups_stats?.find((s: any) => s.username === user.username);
                      const matchWins = expertStats?.match_wins || 0;
                      const isTopWinner = matchWins > 0 && matchWins === maxWins;
                      const matchPoints = user.total_points - user.base_points;

                      return (
                        <div key={user.username} className="relative flex flex-col items-center group w-24 flex-shrink-0">
                          <div className="h-[400px] w-full flex flex-col justify-end items-center mb-10">
                            <div className="flex flex-col items-center w-full transition-all duration-1000 ease-out" style={{ height: `${((matchPoints + user.base_points) / maxPoints) * 100}%` }}>
                              <div className="flex flex-col items-center mb-4 whitespace-nowrap animate-in fade-in slide-in-from-bottom-4 duration-1000">
                                {matchWins > 0 && (
                                  <div className="flex items-center justify-center gap-0.5 mb-1 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/5">
                                    {Array.from({ length: Math.min(matchWins, 3) }).map((_, i) => (
                                      <Star key={i} className="w-2.5 h-2.5 text-ipl-gold fill-ipl-gold animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                                    ))}
                                    {matchWins > 3 && <span className="text-[8px] text-ipl-gold font-bold ml-1">+{matchWins - 3}</span>}
                                  </div>
                                )}
                                <div className="text-xl font-display font-bold text-white group-hover:text-ipl-gold transition-colors drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                                  {user.total_points}
                                </div>
                              </div>
                              <div className="w-14 flex flex-col justify-end flex-1 rounded-t-sm overflow-hidden shadow-2xl group-hover:shadow-ipl-gold/20 transition-all border-x border-t border-white/5">
                                <div className="bg-ipl-gold relative group-hover:brightness-110 transition-all cursor-help" style={{ height: `${(matchPoints / (matchPoints + user.base_points)) * 100}%` }}>
                                  <span className="absolute -left-16 top-2 text-[10px] font-mono text-ipl-gold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/90 border border-white/10 px-2 py-1 rounded pointer-events-none z-40">Match: {matchPoints} pts</span>
                                </div>
                                <div className="bg-white/10 relative group-hover:bg-white/20 transition-all cursor-help" style={{ height: `${(user.base_points / (matchPoints + user.base_points)) * 100}%` }}>
                                  <span className="absolute -left-16 bottom-2 text-[10px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/90 border border-white/10 px-2 py-1 rounded pointer-events-none z-40">Base: {user.base_points} pts</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-center w-full">
                            <div className="relative">
                              {isTopWinner && <div className="absolute -top-12 inset-x-0 flex justify-center z-30 animate-bounce"><Crown className="w-6 h-6 text-ipl-gold fill-ipl-gold drop-shadow-[0_0_15px_rgba(255,215,0,0.7)]" /></div>}
                              <div className={`w-16 h-16 rounded-full border-2 group-hover:border-ipl-gold transition-all overflow-hidden z-20 bg-ipl-surface shadow-2xl scale-125 ${matchWins > 0 ? 'border-ipl-gold shadow-[0_0_20px_rgba(255,215,0,0.4)]' : 'border-white/10'}`}>
                                <img src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="" className="w-full h-full object-cover" />
                              </div>
                            </div>
                            <div className="flex flex-col items-center mt-10 w-full px-2">
                              <span className="text-[10px] font-display text-gray-400 uppercase tracking-widest text-center line-clamp-2 min-h-[1.5rem] leading-tight group-hover:text-white transition-colors">{user.username}</span>
                              {matchWins > 0 && <div className="flex items-center gap-1.5 mt-2 px-2.5 py-0.5 bg-ipl-gold/10 rounded-full border border-ipl-gold/20 shadow-[0_0_15px_rgba(255,215,0,0.15)]"><Trophy className="w-3 h-3 text-ipl-gold" /><span className="text-[10px] font-bold text-ipl-gold font-mono">{matchWins}</span></div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mobile View: Tactical Tactical Rows */}
                <div className="md:hidden space-y-4">
                  {experts.map((user: any, idx: number) => {
                    const expertStats = data?.powerups_stats?.find((s: any) => s.username === user.username);
                    const matchWins = expertStats?.match_wins || 0;
                    const matchPoints = user.total_points - user.base_points;
                    const matchPercent = (matchPoints / user.total_points) * 100;

                    return (
                      <div key={user.username} className="glass-panel p-4 border-l-2 border-ipl-gold/30 animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <img src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} className="w-10 h-10 rounded-full border border-white/10" alt={user.username} />
                              {matchWins > 0 && <div className="absolute -top-1 -right-1 bg-ipl-gold text-black rounded-full p-0.5"><Trophy className="w-2 h-2" /></div>}
                            </div>
                            <div>
                              <p className="text-[10px] font-display text-white uppercase tracking-tight truncate w-32">{user.username}</p>
                              <p className="text-[8px] text-gray-500 uppercase tracking-[0.2em]">{matchWins} Match Victories</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-display text-white tracking-tighter leading-none">{user.total_points}</p>
                            <p className="text-[7px] text-ipl-gold uppercase font-bold tracking-widest mt-1">Total Points</p>
                          </div>
                        </div>

                        {/* Tactical Stacked Bar */}
                        <div className="relative h-4 bg-white/5 rounded-full overflow-hidden flex border border-white/5">
                          <div className="h-full bg-ipl-gold shadow-[0_0_15px_rgba(255,215,0,0.2)]" style={{ width: `${matchPercent}%` }} />
                          <div className="h-full bg-white/10" style={{ width: `${100 - matchPercent}%` }} />

                          {/* Centered Divider Glow */}
                          <div className="absolute top-0 bottom-0 w-px bg-white/30" style={{ left: `${matchPercent}%` }} />
                        </div>

                        <div className="flex justify-between items-center mt-2 px-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-bold text-ipl-gold uppercase tracking-tighter">Match: {matchPoints}pts</span>
                            <span className="text-[7px] text-gray-500 font-mono">({Math.round(matchPercent)}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[7px] text-gray-500 font-mono">({Math.round(100 - matchPercent)}%)</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Base: {user.base_points}pts</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </section>

        {/* Accuracy & Global Standing Section */}
        <section className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-ipl-gold pl-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-6 h-6 text-ipl-gold" />
              <div>
                <h2 className="text-xl font-display text-white italic tracking-tight">Accuracy <span className="text-ipl-gold">& Standing</span></h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Core Prediction Performance</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              {/* Sorting Toggle */}
              <div className="flex bg-white/5 p-1 rounded-lg border border-white/5 shadow-inner">
                <button
                  onClick={() => setAccuracySort('accuracy')}
                  className={`px-4 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all duration-300 ${accuracySort === 'accuracy' ? 'bg-ipl-gold text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  By Accuracy
                </button>
                <button
                  onClick={() => setAccuracySort('percentile')}
                  className={`px-4 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all duration-300 ${accuracySort === 'percentile' ? 'bg-ipl-gold text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  By Standing
                </button>
              </div>

              {/* Skill Rank Legend */}
              <div className="flex flex-wrap items-center gap-3 bg-white/5 px-4 py-2 rounded-lg border border-white/5 backdrop-blur-sm">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...(data?.accuracy_stats || [])]
              .sort((a: any, b: any) => {
                if (accuracySort === 'accuracy') {
                  return (b.accuracy || 0) - (a.accuracy || 0);
                }
                return (b.percentile || 0) - (a.percentile || 0);
              })
              .map((stat: any, idx: number) => {
                const getSkillClass = (accuracy: number) => {
                  if (accuracy >= 50) return { label: 'Elite Predictor', bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400' };
                  if (accuracy >= 35) return { label: 'Expert Picker', bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' };
                  if (accuracy >= 20) return { label: 'Senior Analyst', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' };
                  return { label: 'Contender', bg: 'bg-white/5', border: 'border-white/10', text: 'text-gray-400' };
                };
                const skill = getSkillClass(stat.accuracy);

                return (
                  <div key={stat.username} className="glass-panel p-5 space-y-4 relative group transition-all hover:bg-white/[0.04] overflow-hidden">
                    {/* Rank Crown for #1 */}
                    {idx === 0 && (
                      <div className="absolute top-0 right-0 w-8 h-8 bg-ipl-gold/10 rounded-bl-3xl flex items-center justify-center">
                        <Crown className="w-3.5 h-3.5 text-ipl-gold drop-shadow-[0_0_5px_rgba(255,215,0,0.5)]" />
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={stat.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${stat.username}`}
                            className={`w-10 h-10 rounded-full border-2 transition-colors ${skill.border} group-hover:border-ipl-gold/50`}
                            alt=""
                          />
                          {/* Rank Badge */}
                          <div className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#0f111a] shadow-xl transition-transform group-hover:scale-110 ${idx === 0 ? 'bg-ipl-gold text-black ring-2 ring-ipl-gold/20' :
                            idx === 1 ? 'bg-gray-300 text-black ring-2 ring-gray-300/20' :
                              idx === 2 ? 'bg-[#CD7F32] text-black ring-2 ring-[#CD7F32]/20' :
                                'bg-[#1e2235] text-white ring-2 ring-white/5'
                            }`}>
                            {idx + 1}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-sm font-display text-white uppercase tracking-tight group-hover:text-ipl-gold transition-colors">{stat.username}</h3>
                          <span className={`text-[7px] px-1.5 py-0.5 rounded-full border uppercase font-bold tracking-widest ${skill.bg} ${skill.border} ${skill.text}`}>
                            {skill.label}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1">
                          <span className="text-2xl font-display text-ipl-gold">{stat.accuracy}%</span>
                          <span className="text-[8px] text-gray-600 uppercase font-bold tracking-widest font-mono">Acc</span>
                        </div>
                      </div>
                    </div>

                    {/* Badges Section */}
                    {stat.badges && stat.badges.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {stat.badges.map((badge: any) => (
                          <div key={badge.name} className="flex items-center gap-1.5 bg-ipl-gold/5 px-2 py-1 rounded-md border border-white/5 group/badge hover:bg-ipl-gold/10 hover:border-ipl-gold/20 transition-all cursor-help">
                            {badge.type === 'streak' && <TrendingUp className="w-2.5 h-2.5 text-ipl-gold" />}
                            {badge.type === 'brave' && <ShieldAlert className="w-2.5 h-2.5 text-orange-400" />}
                            {badge.type === 'bumrah' && <Target className="w-2.5 h-2.5 text-red-400" />}
                            {badge.type === 'wall' && <ShieldCheck className="w-2.5 h-2.5 text-blue-400" />}
                            <div className="flex flex-col">
                              <span className="text-[7px] text-white/90 font-bold uppercase leading-none tracking-tighter">{badge.name}</span>
                              <span className="text-[6px] text-gray-500 font-mono mt-0.5">
                                {badge.type === 'streak' ? `${badge.value} Matches` :
                                  badge.type === 'brave' ? `${badge.value} Bold Calls` :
                                    badge.type === 'bumrah' ? `${badge.value} Bullseyes` :
                                      badge.value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between border border-white/5 relative overflow-hidden">
                      <div className="relative z-10">
                        <p className="text-[8px] text-gray-500 uppercase tracking-widest font-mono">Global Percentile</p>
                        <p className="text-lg font-display text-white">Top {Math.max(1, Math.round(100 - stat.percentile))}%</p>
                      </div>
                      <div className="text-right relative z-10">
                        <p className="text-[8px] text-gray-500 uppercase tracking-widest font-mono">Standing</p>
                        <p className="text-lg font-display text-ipl-gold">{stat.percentile}%</p>
                      </div>
                      {/* Progress bar background */}
                      <div className="absolute bottom-0 left-0 h-1 bg-ipl-gold/20" style={{ width: '100%' }} />
                      <div className="absolute bottom-0 left-0 h-1 bg-ipl-gold shadow-[0_0_10px_rgba(255,215,0,0.5)] transition-all duration-1000" style={{ width: `${stat.percentile}%` }} />
                    </div>
                  </div>
                );
              })}
          </div>
        </section>

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
                const skill = getSkillClass(stat.accuracy);

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
                                className={`px-2 py-0.5 border rounded-sm text-[8px] font-mono tracking-tighter transition-all cursor-default ${m.match_status !== 'completed' ? 'bg-white/5 border-white/5 text-gray-500' :
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
                      <div className="flex items-center gap-1.5">
                        {player.used_powerup && (
                          <Zap className="w-2.5 h-2.5 text-ipl-gold fill-ipl-gold animate-pulse" />
                        )}
                        <span className="text-xs font-mono font-bold text-ipl-gold">{player.points} pts</span>
                      </div>
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
    </div>
  );
}
