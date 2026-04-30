import { useLeaderboard } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';
import { useState } from 'react';
import { Trophy, History, X, Info, ChevronDown, ChevronUp, Zap, Target, Check, AlertCircle } from 'lucide-react';

export default function LeaderboardSection({ leagueId, leagueName, tournamentName }: { leagueId: string, leagueName: string, tournamentName: string }) {
  const { user: currentUser } = useAuthStore();
  const { data: leaderboard, isLoading } = useLeaderboard(leagueId);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const handleRowClick = (entry: any) => {
    setSelectedUser(entry);
    setExpandedMatch(null);
    if (window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById(`progression-details-${leagueId}`)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b-2 border-white/10 pb-4">
        <h2 className="text-2xl font-display text-white">{leagueName}</h2>
        <p className="text-gray-400 mt-1 italic tracking-widest text-xs uppercase opacity-60">
          {tournamentName} Standings
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        <div className="lg:col-span-3 glass-panel overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center animate-pulse text-white font-display text-xl tracking-widest">LOADING STANDINGS...</div>
          ) : (
            <div className="overflow-x-auto w-full custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[450px] md:min-w-[700px] whitespace-nowrap">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase w-12 text-center">Rank</th>
                    <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase">Player</th>
                    <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-center hidden lg:table-cell">
                      <div className="text-[10px] md:text-xs uppercase">History</div>
                      <div className="text-[8px] text-gray-500 font-mono tracking-tighter mt-0.5 opacity-60">(Latest → Oldest)</div>
                    </th>
                    <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase text-right">Points</th>
                    <th className="p-2 md:p-4 font-display tracking-wider text-gray-400 text-[10px] md:text-xs uppercase text-center w-16">Pwrups</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard?.map((entry: any) => (
                    <tr
                      key={entry.username}
                      onClick={() => handleRowClick(entry)}
                      className={`border-b border-white/5 transition-all group cursor-pointer ${selectedUser?.username === entry.username ? 'bg-ipl-gold/20' :
                          entry.username === currentUser?.name ? 'bg-white/5' : 'hover:bg-white/5'
                        }`}
                    >
                      <td className="p-2 md:p-4">
                        <div className="flex items-center justify-center gap-2 font-display text-sm md:text-lg">
                          {entry.rank <= 3 ? (
                            <span className={`w-6 h-6 md:w-8 md:h-8 flex items-center justify-center rounded-sm ${entry.rank === 1 ? 'bg-ipl-gold text-black' :
                              entry.rank === 2 ? 'bg-gray-300 text-black' : 'bg-[#CD7F32] text-black'
                              }`}>
                              {entry.rank}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-mono text-xs md:text-base">{entry.rank}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 md:p-4">
                        <div className="flex items-center gap-2 md:gap-4">
                          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border border-white/10 overflow-hidden group-hover:border-ipl-gold transition-colors shrink-0">
                            <img src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`} alt={entry.username} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className={`text-xs md:text-sm font-display tracking-wide truncate max-w-[80px] md:max-w-[120px] ${entry.rank <= 3 ? 'text-white' : 'text-gray-300'}`}>
                              {entry.username}
                            </span>
                            <span className="text-[8px] md:text-[10px] text-gray-500 uppercase font-display tracking-tighter">
                              M: {entry.matches_played}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 md:p-4 hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                          {entry.progression?.slice(0, 10).map((prog: any, idx: number) => (
                            <div
                              key={idx}
                              className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-[10px] font-mono rounded-sm border ${prog.points >= 25 ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                                prog.points > 0 ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                                  prog.points < 0 ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                                    'bg-white/5 border-white/10 text-gray-500'
                                }`}
                              title={`Earned ${prog.points} points in ${prog.teams}`}
                            >
                              {prog.points > 0 ? '+' : ''}{prog.points}
                            </div>
                          ))}
                          {(!entry.progression || entry.progression.length === 0) && (
                            <span className="text-gray-600 font-display text-[10px] uppercase opacity-40 italic">New Entrant</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 md:p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-xl md:text-2xl font-display text-ipl-gold leading-none">{entry.total_points}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            {entry.base_points > 0 && (
                              <span className="text-[7px] md:text-[8px] px-1 bg-ipl-gold/10 border border-ipl-gold/30 text-ipl-gold rounded uppercase font-bold tracking-tighter">
                                +{entry.base_points}
                              </span>
                            )}
                            <span className="text-[8px] md:text-[10px] text-gray-500 font-display uppercase tracking-widest leading-none">PTS</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 md:p-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-base md:text-lg font-display text-ipl-live">{entry.remaining_powerups !== undefined ? entry.remaining_powerups : 10}</span>
                          <span className="text-[7px] md:text-[8px] text-gray-500 uppercase tracking-widest leading-none">Left</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {leaderboard?.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-display uppercase tracking-widest opacity-30 italic">NO RANKINGS AVAILABLE YET</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected User Details Sidebar */}
        <div id={`progression-details-${leagueId}`} className="lg:col-span-1 space-y-4">
          {!selectedUser ? (
            <div className="glass-panel p-8 text-center border-dashed border-2 border-white/10 opacity-40">
              <History className="w-10 h-10 text-white/20 mx-auto mb-4" />
              <p className="text-[10px] font-display uppercase tracking-widest leading-loose">
                Select a player to view<br />match-by-match<br />progression
              </p>
            </div>
          ) : (
            <div className="glass-panel p-6 animate-in fade-in slide-in-from-right-4 duration-500 border-t-2 border-ipl-gold">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.username}`}
                    className="w-10 h-10 rounded-full border border-ipl-gold/30"
                    alt=""
                  />
                  <div>
                    <h3 className="text-white font-display uppercase text-sm tracking-tight">{selectedUser.username}</h3>
                    <p className="text-ipl-gold text-[10px] font-display uppercase tracking-widest">Rank #{selectedUser.rank}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                  <Trophy className="w-4 h-4 text-ipl-gold opacity-50" />
                  <h4 className="text-[10px] font-display text-gray-400 uppercase tracking-widest">Match History</h4>
                  <span className="ml-auto text-[8px] font-mono text-gray-500 tracking-tighter opacity-60">(Latest First)</span>
                </div>

                <div className="max-h-[500px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
                  {selectedUser.progression?.length === 0 ? (
                    <p className="text-center py-10 text-gray-600 font-display text-[10px] uppercase italic">No matches played yet</p>
                  ) : (
                    selectedUser.progression?.map((prog: any, idx: number) => {
                      const isExpanded = expandedMatch === prog.match_number;
                      return (
                        <div key={idx} className={`bg-white/5 border border-white/10 overflow-hidden transition-all duration-300 ${isExpanded ? 'border-ipl-gold/50 bg-ipl-gold/5' : 'hover:border-white/20'}`}>
                          <button
                            onClick={() => setExpandedMatch(isExpanded ? null : prog.match_number)}
                            className="w-full text-left p-3 flex flex-col group/row"
                          >
                            <div className="flex justify-between items-start mb-1 w-full">
                              <span className="text-[9px] font-mono text-gray-500 flex items-center gap-1">
                                MATCH {prog.match_number}
                                {prog.breakdown && (isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5 opacity-40" />)}
                              </span>
                              <span className={`text-xs font-display font-bold ${prog.points > 0 ? 'text-green-400' : prog.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                {prog.points > 0 ? '+' : ''}{prog.points}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-300 font-display uppercase tracking-tight truncate group-hover/row:text-white transition-colors">
                              {prog.teams}
                            </div>
                          </button>

                          {isExpanded && prog.breakdown && (
                            <div className="px-3 pb-3 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="space-y-1.5 mt-2">
                                {prog.breakdown.rules?.map((rule: any, ridx: number) => (
                                  <div key={ridx} className="flex justify-between items-center text-[9px] bg-white/5 p-1.5 rounded-sm">
                                    <div className="flex items-center gap-1.5">
                                      {rule.status === 'correct' || rule.status === 'bingo' ? (
                                        <Check className="w-3 h-3 text-green-500 shrink-0" />
                                      ) : rule.status === 'range' ? (
                                        <Target className="w-3 h-3 text-blue-400 shrink-0" />
                                      ) : (
                                        <AlertCircle className="w-3 h-3 text-red-500/50 shrink-0" />
                                      )}
                                      <div className="flex flex-col">
                                        <span className="text-gray-300 font-display uppercase tracking-tighter">{rule.category}</span>
                                        <span className="text-[7px] text-gray-500 font-mono">
                                          P: {rule.predicted} | A: {rule.actual}
                                        </span>
                                      </div>
                                    </div>
                                    <span className={`font-mono font-bold ${rule.points > 0 ? 'text-green-400' : rule.points < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                      {rule.points > 0 ? '+' : ''}{rule.points}
                                    </span>
                                  </div>
                                ))}

                                {prog.breakdown.powerup?.used && (
                                  <div className="flex justify-between items-center text-[9px] bg-ipl-live/10 border border-ipl-live/20 p-1.5 rounded-sm">
                                    <div className="flex items-center gap-1.5">
                                      <Zap className="w-3 h-3 text-ipl-live" />
                                      <span className="text-ipl-live font-display uppercase tracking-tighter">Powerup Applied (2x)</span>
                                    </div>
                                    <span className="text-ipl-live font-mono font-bold">
                                      ×2
                                    </span>
                                  </div>
                                )}

                                <div className="mt-2 text-[8px] text-gray-500 font-mono text-center uppercase tracking-widest opacity-40">
                                  Breakdown Log Complete
                                </div>
                              </div>
                            </div>
                          )}

                          {isExpanded && !prog.breakdown && (
                            <div className="px-3 pb-3 pt-1 text-[9px] text-gray-500 italic text-center font-display uppercase tracking-widest bg-red-500/5 mt-2 rounded border border-red-500/10">
                              {prog.points < 0 ? 'Non-participation Penalty (-5)' : 'No breakdown data available'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {currentUser?.is_guest && (
            <div className="glass-panel p-6 border-l-4 border-l-ipl-gold bg-white/[0.02] mt-8">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-ipl-gold" />
                <h4 className="text-[10px] font-display text-white uppercase tracking-widest">Guest Standing</h4>
              </div>
              <p className="text-[10px] text-gray-500 font-display leading-relaxed">
                As a Guest, your points are not tracked in the global standings. Contact an admin to become a full expert and join the race for the top!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
