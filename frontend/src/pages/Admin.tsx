import React, { useEffect, useState } from 'react';
import { Settings, Users, AlertTriangle, ShieldCheck, Mail, Trash2, CheckCircle, AlertCircle, Archive, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import { useAllowlist, useAddAllowlist, useDeleteAllowlist, useUpdateMatchResults, useAllUsers, useUpdateBasePoints } from '../api/hooks/useAdmin';
import { useMatches } from '../api/hooks/useMatches';
import { apiClient } from '../api/client';

export default function Admin() {
  const { user } = useAuthStore();
  const [newEmail, setNewEmail] = useState('');

  // State for match results form
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [matchResults, setMatchResults] = useState({
    winner: '',
    team1_powerplay_score: 0,
    team2_powerplay_score: 0,
    player_of_the_match: ''
  });
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

  const { data: allowlist, isLoading: isAllowlistLoading } = useAllowlist();
  const { mutate: addEmail, isPending: isAdding } = useAddAllowlist();
  const { mutate: deleteEmail } = useDeleteAllowlist();

  const { data: matches } = useMatches();
  const { mutate: updateResults, isPending: isUpdating } = useUpdateMatchResults();

  // Populate form with existing Ground Truth if available
  useEffect(() => {
    if (selectedMatchId && matches) {
      const selected = matches.find(m => m.id === selectedMatchId);
      if (selected) {
        setMatchResults({
          winner: selected.winner || '',
          team1_powerplay_score: selected.team1_powerplay_score || 0,
          team2_powerplay_score: selected.team2_powerplay_score || 0,
          player_of_the_match: selected.player_of_the_match || ''
        });
      }
    }
  }, [selectedMatchId, matches]);

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const showStatus = (message: string, type: 'success' | 'error') => {
    setStatus({ message, type });
    setTimeout(() => setStatus({ message: '', type: null }), 5000);
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const emails = newEmail.split(',').map(e => e.trim()).filter(Boolean);
    addEmail(emails, {
      onSuccess: () => setNewEmail('')
    });
  };

  const selectedMatch = matches?.find(m => m.id === selectedMatchId);

  const handleResultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchId) return;

    updateResults({
      matchId: selectedMatchId,
      answers: matchResults
    }, {
      onSuccess: () => {
        showStatus('Match results submitted and scoring triggered!', 'success');
        setSelectedMatchId('');
        setMatchResults({
          winner: '',
          team1_powerplay_score: 0,
          team2_powerplay_score: 0,
          player_of_the_match: ''
        });
      },
      onError: () => {
        showStatus('Failed to update match results. Please try again.', 'error');
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 relative">
      {status.type && (
        <div className={`fixed top-6 right-6 z-50 animate-in fade-in slide-in-from-right-10 duration-500 max-w-md w-full glass-panel border-l-4 ${status.type === 'success' ? 'border-l-ipl-gold shadow-[0_0_30px_rgba(244,196,48,0.2)]' : 'border-l-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]'} p-4 flex items-center gap-4`}>
          {status.type === 'success' ? (
            <div className="p-2 bg-ipl-gold/20 rounded-full">
              <CheckCircle className="w-5 h-5 text-ipl-gold" />
            </div>
          ) : (
            <div className="p-2 bg-red-500/20 rounded-full">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
          )}
          <div className="flex-1">
            <h4 className={`text-xs font-display uppercase tracking-widest ${status.type === 'success' ? 'text-ipl-gold' : 'text-red-500'}`}>
              {status.type === 'success' ? 'Operation Success' : 'System Error'}
            </h4>
            <p className="text-gray-300 text-sm mt-1 font-display tracking-tight">{status.message}</p>
          </div>
        </div>
      )}

      <header className="flex justify-between items-end border-b-2 border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-display text-ipl-live flex items-center gap-3">
            <ShieldCheck className="w-8 h-8" />
            Admin Operations
          </h1>
          <p className="text-gray-400 mt-1 uppercase text-xs tracking-[0.2em]">Manage system access and scoring engine</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Allowlist Management */}
        <section className="glass-panel p-6 border-t-2 border-t-ipl-live shadow-[0_10px_30px_rgba(205,38,38,0.1)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-ipl-live/10 rounded-lg">
              <Users className="w-6 h-6 text-ipl-live" />
            </div>
            <h2 className="text-xl font-display text-white">System Access List</h2>
          </div>

          <form onSubmit={handleAddEmail} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Add emails (comma separated)..."
                className="w-full bg-black/40 border-2 border-white/10 py-3 pl-10 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-ipl-live transition-all font-display text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isAdding || !newEmail}
              className="bg-ipl-live text-white font-display px-6 rounded-none uppercase tracking-widest hover:bg-red-500 transition-all disabled:opacity-30 disabled:grayscale"
            >
              {isAdding ? 'Adding...' : 'Add'}
            </button>
          </form>

          <div className="bg-black/20 border border-white/5 h-[400px] overflow-y-auto custom-scrollbar">
            {isAllowlistLoading ? (
              <div className="p-10 text-center text-gray-400 font-display animate-pulse tracking-widest text-xs uppercase">Initialising Directory...</div>
            ) : (
              <ul className="divide-y divide-white/5">
                {allowlist?.map((entry) => (
                  <li key={entry.email} className="px-5 py-4 flex justify-between items-center group hover:bg-white/5 transition-colors">
                    <span className="text-gray-300 font-mono text-sm tracking-tight">{entry.email}</span>
                    <button
                      onClick={() => deleteEmail(entry.email)}
                      className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Scoring Processor */}
        <section className="glass-panel p-6 border-t-2 border-t-ipl-gold shadow-[0_10px_30px_rgba(244,196,48,0.05)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-ipl-gold/10 rounded-lg">
              <Settings className="w-6 h-6 text-ipl-gold" />
            </div>
            <h2 className="text-xl font-display text-white">Match Result Processor</h2>
          </div>

          <div className="bg-ipl-gold/5 border border-ipl-gold/20 p-4 mb-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-ipl-gold shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-400 font-display uppercase tracking-wider leading-relaxed">
                Caution: Triggering the scoring engine calculates points for ALL users immediately. Ensure facts are correct against official BCCI match data.
              </p>
            </div>
          </div>

          <form onSubmit={handleResultSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em]">Select Match</label>
              <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 p-3 text-white focus:outline-none focus:border-ipl-gold transition-all text-sm font-display uppercase tracking-widest appearance-none"
              >
                <option value="">— Choose Any Match —</option>
                {matches?.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.status === 'completed' ? '🏁 ' : (m.status === 'live' ? '🔴 ' : '⏳ ')}
                    {m.team1} v {m.team2} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            {selectedMatch && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                {selectedMatch.status === 'completed' && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 flex gap-3 items-center mb-6">
                    <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                    <p className="text-[10px] text-red-500 font-display uppercase tracking-widest leading-relaxed">
                      Override Mode: Updating facts for a completed match will RE-CALCULATE scores for all users immediately. Proceed with caution.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em]">Match Winner</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[selectedMatch.team1, selectedMatch.team2].map(team => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setMatchResults({ ...matchResults, winner: team })}
                        className={`p-3 border-2 font-display text-xs tracking-widest transition-all ${matchResults.winner === team ? 'border-ipl-gold bg-ipl-gold text-black' : 'border-white/10 text-gray-500 hover:border-white/20'}`}
                      >
                        {team}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] truncate">{selectedMatch.team1} Score</label>
                    <input
                      type="number"
                      value={matchResults.team1_powerplay_score}
                      onChange={(e) => setMatchResults({ ...matchResults, team1_powerplay_score: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border-2 border-white/10 p-3 text-white focus:outline-none focus:border-ipl-gold transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] truncate">{selectedMatch.team2} Score</label>
                    <input
                      type="number"
                      value={matchResults.team2_powerplay_score}
                      onChange={(e) => setMatchResults({ ...matchResults, team2_powerplay_score: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/40 border-2 border-white/10 p-3 text-white focus:outline-none focus:border-ipl-gold transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em]">Player of the Match</label>
                  <input
                    type="text"
                    value={matchResults.player_of_the_match}
                    onChange={(e) => setMatchResults({ ...matchResults, player_of_the_match: e.target.value })}
                    placeholder="ENTER PLAYER NAME"
                    className="w-full bg-black/40 border-2 border-white/10 p-3 text-white focus:outline-none focus:border-ipl-gold transition-all font-display text-sm tracking-widest uppercase placeholder:text-gray-700"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdating || !matchResults.winner}
                  className="w-full bg-ipl-gold text-black font-display py-4 uppercase tracking-[0.3em] font-black hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale"
                >
                  {isUpdating ? 'Executing Logic...' : 'Trigger Scoring Engine'}
                </button>
              </div>
            )}
          </form>
        </section>

        {/* User Management Section */}
        <section className="mt-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
           <UserScoreManager />
        </section>
      </div>
    </div>
  );
}

function UserScoreManager() {
  const { data: users, isLoading } = useAllUsers();
  const { mutate: updateBasePoints, isPending } = useUpdateBasePoints();
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});

  const handleUpdate = (userId: string) => {
    const basePoints = localPoints[userId];
    if (basePoints === undefined) return;
    updateBasePoints({ userId, basePoints });
  };

  if (isLoading) return <div className="text-white font-display text-xs p-4 animate-pulse uppercase tracking-widest opacity-30">Loading database users...</div>;

  return (
    <div className="glass-panel p-8 border-t-2 border-ipl-gold/30">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-ipl-gold/10 rounded-xl border border-ipl-gold/20">
          <Users className="w-6 h-6 text-ipl-gold" />
        </div>
        <div>
          <h2 className="text-2xl font-display text-white italic tracking-tighter uppercase">Global User Management</h2>
          <p className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Adjust starting scores and season handicaps</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 uppercase font-display text-[10px] tracking-widest text-gray-500">
              <th className="p-4 font-normal">Active Player</th>
              <th className="p-4 font-normal text-center">Base Factor</th>
              <th className="p-4 font-normal text-right">Adjust Standing</th>
            </tr>
          </thead>
          <tbody className="font-display">
            {users?.map((user) => (
              <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-all group">
                <td className="p-4">
                  <div className="flex items-center gap-4">
                    <img 
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                      className="w-10 h-10 rounded-image border border-white/10 group-hover:border-ipl-gold transition-colors"
                      alt=""
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{user.name}</span>
                      <span className="text-[9px] text-gray-600 font-mono">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                   <div className="inline-block px-3 py-1 bg-ipl-gold/10 border border-ipl-gold/20 rounded font-mono text-ipl-gold text-lg">
                      {user.base_points}
                   </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end items-center gap-3">
                    <div className="relative group/input">
                      <input 
                        type="number"
                        placeholder={user.base_points.toString()}
                        className="w-20 bg-ipl-navy border-2 border-white/10 p-2 text-center text-white focus:border-ipl-gold focus:outline-none transition-all font-mono"
                        value={localPoints[user.id] ?? user.base_points}
                        onChange={(e) => setLocalPoints({...localPoints, [user.id]: parseInt(e.target.value) || 0})}
                      />
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity whitespace-nowrap bg-black text-[8px] px-2 py-0.5 rounded border border-white/10">NEW SCORE</div>
                    </div>
                    <button 
                      onClick={() => handleUpdate(user.id)}
                      disabled={isPending}
                      className="h-10 px-6 bg-white text-ipl-navy text-[11px] font-bold uppercase tracking-widest hover:bg-ipl-gold hover:scale-105 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {isPending ? 'Syncing...' : 'Save'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
