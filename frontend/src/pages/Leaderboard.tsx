import { useMyLeagues } from '../api/hooks/useMatches';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import LeaderboardSection from '../components/LeaderboardSection';

export default function Leaderboard() {
  const { data: leagues } = useMyLeagues();

  // The global leaderboard ID is typically 'ipl-2026-global'
  // But wait, the previous code had:
  // const [selectedLeagueId, setSelectedLeagueId] = useState<string>("ipl-2026-global");

  // The global league is usually in the leagues array, or we can just explicitly render it first if we want.
  // Actually, useMyLeagues returns the global league (name="Global Leaderboard") plus any private leagues.
  // So we can just map over leagues. Let's make sure the global one is first.
  const sortedLeagues = leagues ? [...leagues].sort((a: any, b: any) => {
    if (a.id === 'ipl-2026-global') return -1;
    if (b.id === 'ipl-2026-global') return 1;
    return a.name.localeCompare(b.name);
  }) : [];

  return (
    <div className="space-y-12">

      {sortedLeagues.map((league: any) => (
        <LeaderboardSection
          key={league.id}
          leagueId={league.id}
          leagueName={league.name || (league.id === 'ipl-2026-global' ? 'Global Leaderboard' : 'League Leaderboard')}
          tournamentName={league.tournament_name || 'IPL 2026'}
        />
      ))}

      {!sortedLeagues.length && (
        <div className="p-8 text-center text-white font-display text-xl tracking-widest">
          LOADING STANDINGS...
        </div>
      )}
    </div>
  );
}
