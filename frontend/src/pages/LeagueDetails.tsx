import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLeagueDetails, useKickMember, useRefreshJoinCode } from '../api/hooks/useLeagues';
import { FiUsers, FiCopy, FiRefreshCw, FiTrash2, FiArrowLeft, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function LeagueDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: league, isLoading, error } = useLeagueDetails(id!);
  const kickMember = useKickMember(id!);
  const refreshCode = useRefreshJoinCode(id!);

  if (isLoading) {
    return <div className="text-white opacity-50 text-center py-10">Loading league details...</div>;
  }

  if (error || !league) {
    return <div className="text-red-400 text-center py-10">Failed to load league.</div>;
  }

  const copyJoinCode = () => {
    if (league.join_code) {
      navigator.clipboard.writeText(league.join_code);
      toast.success('Join code copied to clipboard!');
    }
  };

  const handleRefreshCode = async () => {
    if (window.confirm('Are you sure you want to invalidate the old join code and generate a new one?')) {
      try {
        await refreshCode.mutateAsync();
        toast.success('Join code refreshed!');
      } catch (e) {
        toast.error('Failed to refresh code');
      }
    }
  };

  const handleKick = async (userId: string, name: string) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the league?`)) {
      try {
        await kickMember.mutateAsync(userId);
        toast.success('Member removed');
      } catch (e: any) {
        toast.error(e.response?.data?.detail || 'Failed to remove member');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/leagues')}
        className="flex items-center gap-2 text-brand-300 hover:text-white transition-colors"
      >
        <FiArrowLeft /> Back to Leagues
      </button>

      <div className="bg-brand-800/30 border border-brand-700/50 rounded-xl p-8 backdrop-blur-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg shrink-0
            ${league.id === 'global-league' ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white' : 'bg-brand-700 text-brand-100'}
          `}>
            {league.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              {league.name}
              {league.is_admin && <FiShield className="text-brand-400 text-xl" title="You are League Admin" />}
            </h1>
            <p className="text-brand-300 mt-1 flex items-center gap-2">
              <FiUsers /> {league.participants.length} Members • {league.starting_powerups} Starting Powerups
            </p>
            {league.is_admin && (
              <Link
                to={`/leagues/${league.id}/admin`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-brand-400 hover:bg-brand-300 text-brand-950 font-bold rounded-lg transition-all text-sm"
              >
                <FiShield /> Manage League
              </Link>
            )}
          </div>
        </div>

        {league.is_admin && league.id !== 'global-league' && (
          <div className="bg-brand-900/50 border border-brand-600 rounded-lg p-4 flex flex-col items-center min-w-[200px]">
            <span className="text-xs text-brand-400 uppercase tracking-wider font-semibold mb-1">Invite Code</span>
            <div className="text-2xl font-mono text-white tracking-widest font-bold bg-black/20 px-4 py-2 rounded mb-3 w-full text-center">
              {league.join_code}
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={copyJoinCode}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-700 hover:bg-brand-600 text-white text-sm py-2 rounded transition-colors"
              >
                <FiCopy /> Copy
              </button>
              <button
                onClick={handleRefreshCode}
                disabled={refreshCode.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-700 text-brand-300 hover:text-white text-sm py-2 rounded transition-colors"
              >
                <FiRefreshCw className={refreshCode.isPending ? 'animate-spin' : ''} /> Reset
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-brand-800/20 border border-brand-700/50 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-brand-700/50 bg-brand-800/40">
          <h2 className="text-lg font-bold text-white">Members</h2>
        </div>
        <div className="divide-y divide-brand-700/30">
          {league.participants.map((p) => (
            <div key={p.id} className="p-4 px-6 flex items-center justify-between hover:bg-brand-800/20 transition-colors">
              <div className="flex items-center gap-4">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.name} className="w-10 h-10 rounded-full border border-brand-600" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-700 flex items-center justify-center text-white font-bold text-sm">
                    {p.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-medium text-white">{p.name}</div>
                  <div className="text-xs text-brand-400">Joined {new Date(p.joined_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-brand-200">{p.remaining_powerups}</div>
                  <div className="text-xs text-brand-500 uppercase tracking-wider">Powerups Left</div>
                </div>
                {league.is_admin && league.id !== 'global-league' && (
                  <button
                    onClick={() => handleKick(p.id, p.name)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10 p-2 rounded-lg transition-colors"
                    title="Remove Member"
                  >
                    <FiTrash2 />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
