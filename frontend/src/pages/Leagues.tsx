import React, { useState } from 'react';
import { useMyLeagues, useJoinLeague, useCreateLeague } from '../api/hooks/useLeagues';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiPlus, FiArrowRight, FiShield } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { Trophy } from 'lucide-react';

export default function Leagues() {
  const { data: leagues, isLoading } = useMyLeagues();
  const joinLeague = useJoinLeague();
  const createLeague = useCreateLeague();
  const navigate = useNavigate();

  const [joinCode, setJoinCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeaguePowerups, setNewLeaguePowerups] = useState(10);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode) return;
    try {
      await joinLeague.mutateAsync(joinCode);
      toast.success('Successfully joined league!');
      setJoinCode('');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to join league');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeagueName) return;
    try {
      // Hardcode tournament ID for now, as Phase 1 only uses ipl-2026
      await createLeague.mutateAsync({
        name: newLeagueName,
        tournament_id: 'ipl-2026',
        starting_powerups: newLeaguePowerups
      });
      toast.success('League created!');
      setShowCreate(false);
      setNewLeagueName('');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create league');
    }
  };

  if (isLoading) {
    return <div className="text-white opacity-50">Loading leagues...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display text-white tracking-tight italic uppercase">My Battlegrounds</h1>
          <p className="text-white/60 mt-2 font-body italic text-sm tracking-tight">Compete in the Global League or join your private group.</p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Join League Card */}
        <div className="bg-ipl-surface border border-white/10 rounded-xl p-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-ipl-gold opacity-50 group-hover:opacity-100 transition-opacity" />
          <h2 className="text-xl font-display text-white mb-6 flex items-center gap-3">
            <FiUsers className="text-ipl-gold" /> Join a League
          </h2>
          <form onSubmit={handleJoin} className="flex gap-3">
            <input
              type="text"
              placeholder="ENTER JOIN CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="flex-1 bg-ipl-navy border-2 border-white/10 rounded-lg px-4 py-3 text-white font-display tracking-widest focus:outline-none focus:border-ipl-gold transition-all"
            />
            <button
              disabled={joinLeague.isPending || !joinCode}
              type="submit"
              className="bg-ipl-gold hover:bg-white disabled:opacity-30 text-ipl-navy px-8 py-3 rounded-lg font-display text-sm tracking-widest uppercase transition-all shadow-neon"
            >
              {joinLeague.isPending ? 'JOINING...' : 'JOIN'}
            </button>
          </form>
        </div>
      </div>

      {/* My Leagues List */}
      <div className="space-y-6">
        <h2 className="text-xl font-display text-white flex items-center gap-3">
          <Trophy className="w-5 h-5 text-ipl-gold" /> My Leagues
        </h2>
        {leagues?.length === 0 ? (
          <div className="text-gray-500 font-display uppercase tracking-[0.2em] text-center py-20 bg-ipl-surface/50 rounded-xl border-2 border-dashed border-white/5">
            You haven't joined any leagues yet.
          </div>
        ) : (
          <div className="grid gap-4">
            {leagues?.map((league) => (
              <div
                key={league.id}
                onClick={() => navigate(`/leagues/${league.id}`)}
                className="group bg-ipl-surface border border-white/5 hover:border-ipl-gold/50 cursor-pointer rounded-xl p-6 flex justify-between items-center transition-all duration-300 hover:shadow-neon"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-display font-bold shadow-2xl transition-transform group-hover:scale-110
                    ${league.id === 'global-league' ? 'bg-gradient-to-br from-ipl-gold to-yellow-600 text-ipl-navy' : 'bg-ipl-navy text-ipl-gold border border-ipl-gold/20'}
                  `}>
                    {league.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-display text-white flex items-center gap-2 group-hover:text-ipl-gold transition-colors">
                      {league.name}
                      {league.is_admin && <FiShield className="text-ipl-gold text-sm" title="League Admin" />}
                    </h3>
                    <p className="text-[10px] font-display uppercase tracking-widest text-gray-500 mt-1">
                      {league.id === 'global-league' ? 'Official IPL Fantasy 2026' : 'Private League'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-gray-500 group-hover:text-ipl-gold transition-all translate-x-4 group-hover:translate-x-0">
                  <span className="text-[10px] font-display uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">View League</span>
                  <FiArrowRight className="w-5 h-5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
