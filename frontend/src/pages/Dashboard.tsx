import MatchCard from '../components/MatchCard';
import { useMatches } from '../api/hooks/useMatches';

export default function Dashboard() {
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
