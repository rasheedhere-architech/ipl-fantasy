import { useLeaderboard } from '../api/hooks/useMatches';
import { useAuthStore } from '../store/auth';

export default function Leaderboard() {
  const { user: currentUser } = useAuthStore();
  const { data: leaderboard, isLoading } = useLeaderboard();

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end border-b-2 border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-display text-white">Global Leaderboard</h1>
          <p className="text-gray-400 mt-1">Top players of the season</p>
        </div>
      </header>

      <div className="glass-panel overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center animate-pulse text-white font-display text-xl tracking-widest">LOADING STANDINGS...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="p-4 font-display tracking-wider text-gray-400 text-xs uppercase">Rank</th>
                <th className="p-4 font-display tracking-wider text-gray-400 text-xs uppercase">Player</th>
                <th className="p-4 font-display tracking-wider text-gray-400 text-xs uppercase text-center hidden md:table-cell">History (Match Progression)</th>
                <th className="p-4 font-display tracking-wider text-gray-400 text-xs uppercase text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard?.map((entry: any) => (
                <tr key={entry.username} className={`border-b border-white/5 transition-all group ${entry.username === currentUser?.name ? 'bg-ipl-gold/10' : 'hover:bg-white/5'}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-2 font-display text-lg">
                      {entry.rank <= 3 ? (
                        <span className={`w-8 h-8 flex items-center justify-center rounded-sm ${
                          entry.rank === 1 ? 'bg-ipl-gold text-black' : 
                          entry.rank === 2 ? 'bg-gray-300 text-black' : 'bg-[#CD7F32] text-black'
                        }`}>
                          {entry.rank}
                        </span>
                      ) : (
                        <span className="text-gray-500 ml-3 font-mono">{entry.rank}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full border-2 border-white/10 overflow-hidden group-hover:border-ipl-gold transition-colors shrink-0">
                        <img src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`} alt={entry.username} />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-display tracking-wide truncate max-w-[120px] ${entry.rank <= 3 ? 'text-white' : 'text-gray-300'}`}>
                          {entry.username}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase font-display tracking-tighter">
                          Matches: {entry.matches_played}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <div className="flex items-center justify-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                      {entry.progression?.slice(-7).map((points: number, idx: number) => (
                        <div 
                          key={idx}
                          className={`w-7 h-7 flex-shrink-0 flex items-center justify-center text-[10px] font-mono rounded-sm border ${
                            points >= 25 ? 'bg-green-500/20 border-green-500/30 text-green-400' :
                            points > 0 ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' :
                            points < 0 ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                            'bg-white/5 border-white/10 text-gray-500'
                          }`}
                          title={`Earned ${points} points`}
                        >
                          {points > 0 ? '+' : ''}{points}
                        </div>
                      ))}
                      {(!entry.progression || entry.progression.length === 0) && (
                        <span className="text-gray-600 font-display text-[10px] uppercase opacity-40 italic">New Entrant</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-2xl font-display text-ipl-gold leading-none">{entry.total_points}</span>
                      <div className="flex items-center gap-1 mt-1">
                         {entry.base_points > 0 && (
                            <span className="text-[8px] px-1 bg-ipl-gold/10 border border-ipl-gold/30 text-ipl-gold rounded uppercase font-bold tracking-tighter">
                               Base: +{entry.base_points}
                            </span>
                         )}
                         <span className="text-[10px] text-gray-500 font-display uppercase tracking-widest leading-none">PTS</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {leaderboard?.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 font-display uppercase tracking-widest opacity-30 italic">NO RANKINGS AVAILABLE YET</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
