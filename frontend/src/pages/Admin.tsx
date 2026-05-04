import React, { useState } from 'react';
import { Users, ShieldCheck, Mail, Trash2, Cpu, Plus, Trophy, RefreshCw, Calendar, MapPin, Sword, Star, Pencil, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import {
  useAllowlist,
  useAddAllowlist,
  useDeleteAllowlist,
  useAllUsers,
  useUpdateBasePoints,
  useTriggerAIPredictions,
  useTournaments,
  useAllLeagues,
  useCreateTournament,
  useCreateMatch,
  useUpdateMatch,
  useAddLeagueMember,
  useBulkImportMatches,
  useTournamentQuestionBank,
  useAddTournamentQuestion,
  useUpdateTournamentQuestion,
  useDeleteTournamentQuestion,
  useTournamentMatchAnswers,
  useUpdateTournamentMatchAnswers
} from '../api/hooks/useAdmin';
import { useMatches } from '../api/hooks/useMatches';
import { useCreateLeague, useLeagueDetails, useToggleLeagueAdmin, useKickMember } from '../api/hooks/useLeagues';
import { teamColors } from '../utils/teamColors';
import toast from 'react-hot-toast';

export default function Admin() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'tournaments' | 'leagues' | 'users' | 'campaigns' | 'system'>(user?.is_admin ? 'tournaments' : 'leagues');
  const [managingTournamentId, setManagingTournamentId] = useState<string | null>(null);
  const [managingLeagueId, setManagingLeagueId] = useState<string | null>(null);

  if (!user?.is_admin && !user?.is_league_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleManageMatches = (tournamentId: string) => {
    setManagingTournamentId(tournamentId);
  };

  return (
    <div className="space-y-8 w-full max-w-full mx-auto pb-20 relative">
      <header className="flex justify-between items-end border-b-2 border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-display text-ipl-gold flex items-center gap-3 italic uppercase tracking-tighter">
            <ShieldCheck className="w-8 h-8" />
            Global Control Center
          </h1>
          <p className="text-gray-400 mt-1 uppercase text-[10px] tracking-[0.3em] font-display">Multi-Tenant Management & Scoring Engine</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10 w-fit">
        {[
          ...(user?.is_admin ? [{ id: 'tournaments', label: 'Tournaments', icon: ShieldCheck }] : []),
          { id: 'leagues', label: 'Leagues', icon: Trophy },
          ...(user?.is_admin ? [{ id: 'users', label: 'Users', icon: Users }] : []),
          { id: 'campaigns', label: 'Campaigns', icon: ShieldCheck },
          ...(user?.is_admin ? [{ id: 'system', label: 'System', icon: Cpu }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-display text-[10px] uppercase tracking-widest transition-all ${activeTab === tab.id
              ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/20'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'tournaments' && (
          managingTournamentId
            ? <TournamentMatchManager tournamentId={managingTournamentId} onBack={() => setManagingTournamentId(null)} />
            : <TournamentRegistry onManageMatches={handleManageMatches} />
        )}
        {activeTab === 'leagues' && (
          managingLeagueId
            ? <LeagueUserManager leagueId={managingLeagueId} onBack={() => setManagingLeagueId(null)} />
            : <LeagueManagement onManageUsers={(id) => setManagingLeagueId(id)} />
        )}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'campaigns' && <CampaignManagement />}
        {activeTab === 'system' && <SystemManagement />}
      </main>
    </div>
  );
}

function LeagueManagement({ onManageUsers }: { onManageUsers: (id: string) => void }) {
  const { user } = useAuthStore();
  const { data: leagues, isLoading: isLeaguesLoading } = useAllLeagues();
  const { data: tournaments } = useTournaments();
  const createLeague = useCreateLeague();

  const [newName, setNewName] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');
  const [powerups, setPowerups] = useState(10);
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !selectedTournament) return;
    try {
      const res = await createLeague.mutateAsync({
        name: newName,
        tournament_id: selectedTournament,
        starting_powerups: powerups
      });
      setCreatedCode(res.join_code);
      toast.success('League created successfully!');
      setNewName('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create league');
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Create Section - Only for Global Admins */}
      {user?.is_admin && (
        <section className="glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-ipl-gold/10 rounded-lg">
              <Plus className="w-6 h-6 text-ipl-gold" />
            </div>
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Provision New League</h2>
          </div>

          {createdCode ? (
            <div className="bg-ipl-green/10 border border-ipl-green/30 p-6 rounded-xl animate-in zoom-in duration-300">
              <p className="text-[10px] font-display text-ipl-green uppercase tracking-widest mb-2">League Created Successfully!</p>
              <div className="flex flex-col items-center gap-4 py-4">
                <span className="text-4xl font-display text-white tracking-[0.2em] font-bold underline decoration-ipl-green underline-offset-8">
                  {createdCode}
                </span>
                <p className="text-[10px] text-gray-500 text-center font-display uppercase tracking-widest">Share this join code with the league admin</p>
              </div>
              <button
                onClick={() => setCreatedCode(null)}
                className="w-full mt-4 py-3 border border-white/10 text-white font-display text-[10px] uppercase tracking-[0.2em] hover:bg-white/5 transition-all"
              >
                Provision Another
              </button>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Internal League Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all"
                  placeholder="e.g. Corporate Challenge"
                />
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Tournament Base</label>
                <select
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all"
                >
                  <option value="">Select Tournament...</option>
                  {tournaments?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Starting Powerups</label>
                <input
                  type="number"
                  value={powerups}
                  onChange={(e) => setPowerups(parseInt(e.target.value) || 0)}
                  className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={createLeague.isPending || !newName || !selectedTournament}
                className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-30"
              >
                {createLeague.isPending ? 'PROVISIONING...' : 'PROVISION LEAGUE'}
              </button>
            </form>
          )}
        </section>
      )}

      {/* Leagues List - Full width if create section is hidden */}
      <section className={`${user?.is_admin ? 'lg:col-span-2' : 'lg:col-span-3'} glass-panel p-6 border-t-2 border-white/10`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Active Battlegrounds</h2>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">League Detail</th>
                <th className="p-4 font-normal">Tournament</th>
                <th className="p-4 font-normal">Join Code</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display">
              {isLeaguesLoading ? (
                <tr><td colSpan={4} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing League Registry...</td></tr>
              ) : leagues?.map(league => (
                <tr key={league.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{league.name}</span>
                      <span className="text-[9px] text-gray-600 font-mono italic tracking-tighter uppercase">{league.id}</span>
                    </div>
                  </td>
                  <td className="p-4 text-[10px] text-gray-400 uppercase tracking-widest">{league.tournament_id}</td>
                  <td className="p-4">
                    <span className="font-mono text-ipl-gold text-sm tracking-widest bg-ipl-gold/5 px-3 py-1 rounded border border-ipl-gold/10">
                      {league.join_code}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onManageUsers(league.id)}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-ipl-navy transition-all font-display text-[10px] uppercase tracking-widest flex items-center gap-2 ml-auto"
                    >
                      <Users className="w-3 h-3" />
                      Manage Users
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserManagement() {
  const { data: users, isLoading } = useAllUsers();
  const { mutate: updateBasePoints, isPending } = useUpdateBasePoints();
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});
  const [localPowerups, setLocalPowerups] = useState<Record<string, number>>({});
  const [localTelegram, setLocalTelegram] = useState<Record<string, boolean>>({});
  const [localTelegramUser, setLocalTelegramUser] = useState<Record<string, string>>({});

  const { data: allowlist, isLoading: isAllowlistLoading } = useAllowlist();
  const { mutate: addEmail, isPending: isAdding } = useAddAllowlist();
  const { mutate: deleteEmail } = useDeleteAllowlist();
  const [newEmail, setNewEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);

  const handleUpdate = (userId: string) => {
    const user = users?.find(u => u.id === userId);
    updateBasePoints({
      userId,
      basePoints: localPoints[userId] ?? user?.base_points ?? 0,
      basePowerups: localPowerups[userId] ?? user?.base_powerups ?? 10,
      isTelegramAdmin: localTelegram[userId] ?? user?.is_telegram_admin ?? false,
      telegramUsername: localTelegramUser[userId] ?? user?.telegram_username
    }, {
      onSuccess: () => toast.success(`Updated ${user?.name}`),
      onError: () => toast.error('Update failed')
    });
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const emails = newEmail.split(',').map(e => e.trim()).filter(Boolean);
    addEmail({ emails, isGuest }, {
      onSuccess: () => {
        setNewEmail('');
        toast.success(`Successfully Whitelisted ${emails.length} Users`);
      }
    });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Manual Whitelist */}
      <section className="glass-panel p-6 border-t-2 border-t-ipl-live h-fit">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-ipl-live" />
          <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Manual Whitelist</h2>
        </div>
        <form onSubmit={handleAddEmail} className="space-y-6">
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Email Addresses (Comma separated)</label>
            <textarea
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-live focus:outline-none transition-all h-32"
              placeholder="user1@example.com, user2@example.com"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="guestCheck"
              checked={isGuest}
              onChange={(e) => setIsGuest(e.target.checked)}
              className="w-4 h-4 rounded border-white/10 bg-black/40 text-ipl-live focus:ring-ipl-live"
            />
            <label htmlFor="guestCheck" className="text-[10px] font-display uppercase tracking-widest text-gray-400 cursor-pointer">Mark as Guest Users</label>
          </div>
          <button
            type="submit"
            disabled={isAdding || !newEmail.trim()}
            className="w-full py-4 bg-ipl-live text-white font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:text-ipl-navy hover:scale-[1.02] transition-all disabled:opacity-30"
          >
            {isAdding ? 'Whitelisting...' : 'Whitelist Users'}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-white/5">
          <h3 className="text-[10px] font-display uppercase tracking-[0.2em] text-gray-500 mb-4">Pending Whitelist ({allowlist?.length || 0})</h3>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
            {isAllowlistLoading ? (
              <div className="animate-pulse text-[10px] text-gray-600 font-display">Syncing...</div>
            ) : allowlist?.map(item => (
              <div key={item.email} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/5 group">
                <div className="flex flex-col">
                  <span className="text-[11px] text-gray-300 font-display">{item.email}</span>
                  {item.is_guest && <span className="text-[8px] text-ipl-gold uppercase tracking-widest">Guest</span>}
                </div>
                <button onClick={() => deleteEmail(item.email)} className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Directory Management */}
      <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">User Directory</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">Player</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal">Stats</th>
                <th className="p-4 font-normal">Telegram</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display text-xs text-gray-400">
              {isLoading ? (
                <tr><td colSpan={5} className="p-10 text-center animate-pulse text-[10px] uppercase tracking-widest text-gray-600">Syncing Master Records...</td></tr>
              ) : users?.map(u => (
                <tr key={u.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`} className="w-8 h-8 rounded-full border border-white/10" alt="" />
                      <div className="flex flex-col">
                        <span className="text-white group-hover:text-ipl-gold transition-colors">{u.name}</span>
                        <span className="text-[9px] text-gray-600 font-mono tracking-tighter uppercase">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      {u.is_admin && <span className="px-2 py-0.5 bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/20 rounded text-[8px] uppercase tracking-widest font-bold w-fit">Admin</span>}
                      {u.is_guest && <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[8px] uppercase tracking-widest font-bold w-fit">Guest</span>}
                      {!u.is_admin && !u.is_guest && <span className="px-2 py-0.5 bg-white/5 text-gray-500 border border-white/10 rounded text-[8px] uppercase tracking-widest font-bold w-fit">Player</span>}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-600 uppercase">Pts:</span>
                        <input
                          type="number"
                          defaultValue={u.base_points}
                          onBlur={(e) => setLocalPoints({ ...localPoints, [u.id]: parseInt(e.target.value) })}
                          className="w-16 bg-black/40 border border-white/5 px-2 py-1 text-[10px] font-mono text-white focus:border-ipl-gold outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-gray-600 uppercase">Pwr:</span>
                        <input
                          type="number"
                          defaultValue={u.base_powerups}
                          onBlur={(e) => setLocalPowerups({ ...localPowerups, [u.id]: parseInt(e.target.value) })}
                          className="w-16 bg-black/40 border border-white/5 px-2 py-1 text-[10px] font-mono text-white focus:border-ipl-gold outline-none"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          defaultChecked={u.is_telegram_admin}
                          onChange={(e) => setLocalTelegram({ ...localTelegram, [u.id]: e.target.checked })}
                          className="w-3 h-3 rounded border-white/10 bg-black/40 text-ipl-gold focus:ring-ipl-gold"
                        />
                        <span className="text-[8px] text-gray-500 uppercase tracking-widest">Bot Admin</span>
                      </div>
                      <input
                        type="text"
                        defaultValue={u.telegram_username}
                        placeholder="@username"
                        onBlur={(e) => setLocalTelegramUser({ ...localTelegramUser, [u.id]: e.target.value })}
                        className="w-24 bg-black/40 border border-white/5 px-2 py-1 text-[10px] font-mono text-white focus:border-ipl-gold outline-none"
                      />
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleUpdate(u.id)}
                      disabled={isPending}
                      className="p-2 border border-white/10 text-gray-500 hover:text-ipl-gold hover:border-ipl-gold transition-all"
                      title="Save Changes"
                    >
                      <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CampaignManagement() {
  const { user } = useAuthStore();
  return (
    <div className="max-w-2xl mx-auto">
      <section className="glass-panel p-10 border-t-2 border-ipl-gold flex flex-col items-center justify-center text-center">
        <ShieldCheck className="w-16 h-16 text-ipl-gold mb-6 opacity-20" />
        <h2 className="text-2xl font-display text-white mb-2 uppercase italic tracking-tighter">
          {user?.is_admin ? 'Master Campaigns' : 'League Campaigns'}
        </h2>
        <p className="text-xs text-gray-500 mb-8 max-w-sm uppercase tracking-widest font-display">
          {user?.is_admin
            ? 'Manage global match questions for the 2026 Season'
            : 'Manage custom questions and engagement for your leagues'}
        </p>
        <a href="/admin/campaigns" className="px-10 py-4 bg-white text-ipl-navy font-display text-xs uppercase tracking-[0.3em] font-bold hover:bg-ipl-gold transition-all">
          Launch Builder
        </a>
      </section>
    </div>
  );
}

function SystemManagement() {
  const { mutate: triggerAI, isPending } = useTriggerAIPredictions();
  return (
    <div className="max-w-2xl mx-auto glass-panel p-10 border-t-2 border-blue-500 text-center">
      <Cpu className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-20" />
      <h2 className="text-2xl font-display text-white mb-2 uppercase italic tracking-tighter">Scoring Engine Controls</h2>
      <p className="text-xs text-gray-400 mb-10 font-mono uppercase tracking-widest">Manual Override for Scoring & AI Predictions</p>

      <div className="grid gap-6">
        <button
          onClick={() => triggerAI(undefined, { onSuccess: () => toast.success('Scoring engine triggered') })}
          className="py-5 bg-ipl-live text-white font-display text-xs uppercase tracking-[0.4em] hover:bg-red-600 transition-all shadow-neon shadow-red-500/20"
        >
          {isPending ? 'PROCESSING...' : 'TRIGGER GLOBAL SCORING'}
        </button>
        <div className="text-[10px] text-gray-600 font-mono uppercase tracking-widest italic">
          Last processed: {new Date().toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function TournamentRegistry({ onManageMatches }: { onManageMatches: (id: string) => void }) {
  const { data: tournaments, isLoading, refetch } = useTournaments();
  const createTournament = useCreateTournament();

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId || !newName) return;
    try {
      await createTournament.mutateAsync({
        id: newId,
        name: newName,
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined
      });
      toast.success('Tournament registered successfully!');
      setNewId('');
      setNewName('');
      setStartsAt('');
      setEndsAt('');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <section className="glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-ipl-gold/10 rounded-lg">
            <Plus className="w-6 h-6 text-ipl-gold" />
          </div>
          <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Register Tournament</h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Unique ID (Slug)</label>
            <input
              type="text"
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all font-mono"
              placeholder="e.g. ipl-2027"
            />
          </div>
          <div>
            <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Display Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all"
              placeholder="e.g. IPL Season 2027"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Starts At</label>
              <input
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Ends At</label>
              <input
                type="date"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all text-xs"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createTournament.isPending || !newId || !newName}
            className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-30"
          >
            {createTournament.isPending ? 'Registering...' : 'Register Tournament'}
          </button>
        </form>
      </section>

      <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-ipl-gold" />
            <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Tournament Registry</h2>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                <th className="p-4 font-normal">Tournament</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal">Timeline</th>
                <th className="p-4 font-normal text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-display text-xs text-gray-400">
              {isLoading ? (
                <tr><td colSpan={4} className="p-10 text-center animate-pulse uppercase tracking-widest text-gray-600 font-display text-[10px]">Syncing Tournament Records...</td></tr>
              ) : tournaments?.map(t => (
                <tr key={t.id} className="group hover:bg-white/5 transition-all">
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{t.name}</span>
                      <span className="text-[9px] text-gray-600 font-mono italic uppercase tracking-tighter">{t.id}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] uppercase tracking-widest">
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-[10px] tracking-tight">
                    {t.starts_at ? new Date(t.starts_at).toLocaleDateString() : 'N/A'} — {t.ends_at ? new Date(t.ends_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => onManageMatches(t.id)}
                      className="px-4 py-2 bg-white/5 border border-white/10 text-white hover:bg-white hover:text-ipl-navy transition-all font-display text-[10px] uppercase tracking-widest flex items-center gap-2 ml-auto"
                    >
                      <Sword className="w-3 h-3" />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TournamentMatchManager({ tournamentId, onBack }: { tournamentId: string, onBack: () => void }) {
  const { data: matches, isLoading, refetch } = useMatches(tournamentId);
  const createMatch = useCreateMatch();
  const updateMatch = useUpdateMatch();
  const bulkImport = useBulkImportMatches();

  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'bank' | 'grading'>('schedule');
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [matchId, setMatchId] = useState('');
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [venue, setVenue] = useState('');
  const [startTime, setStartTime] = useState('');
  const [gradingMatchId, setGradingMatchId] = useState<string | null>(null);

  const handleEditMatch = (m: any) => {
    setEditingMatch(m);
    setMatchId(m.id);
    setTeam1(m.team1);
    setTeam2(m.team2);
    setVenue(m.venue);
    // Convert to local datetime string for input
    const date = new Date(m.start_time);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setStartTime(localDateTime);
    toast.info(`Editing match: ${m.team1} vs ${m.team2}`);
  };

  const resetMatchForm = () => {
    setEditingMatch(null);
    setMatchId('');
    setTeam1('');
    setTeam2('');
    setVenue('');
    setStartTime('');
  };

  const handleSubmitMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId || !team1 || !team2 || !venue || !startTime) {
      toast.error('Please fill all fields');
      return;
    }

    const payload = {
      id: matchId,
      team1,
      team2,
      venue,
      start_time: new Date(startTime).toISOString(),
      tournament_id: tournamentId,
      status: editingMatch ? editingMatch.status : 'upcoming'
    };

    if (editingMatch) {
      updateMatch.mutate(
        { matchId: editingMatch.id, payload },
        {
          onSuccess: () => {
            toast.success('Match updated successfully!');
            refetch();
            resetMatchForm();
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Update failed');
          }
        }
      );
    } else {
      createMatch.mutate(
        payload,
        {
          onSuccess: () => {
            toast.success('Match scheduled successfully!');
            refetch();
            resetMatchForm();
          },
          onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Creation failed');
          }
        }
      );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all">
          <RefreshCw className="w-5 h-5 rotate-[-90deg]" />
        </button>
        <div>
          <h2 className="text-2xl font-display text-white uppercase italic tracking-tighter flex items-center gap-3">
            <Sword className="text-ipl-gold" />
            Manage Tournament: {tournamentId}
          </h2>
          <p className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Schedule and monitor match states</p>
        </div>
      </div>

      <nav className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10 w-fit mb-8">
        {[
          { id: 'schedule', label: 'Match Schedule', icon: Calendar },
          { id: 'bank', label: 'Question Bank', icon: ShieldCheck },
          { id: 'grading', label: 'Grading', icon: Star },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-display text-[10px] uppercase tracking-widest transition-all ${activeSubTab === tab.id
              ? 'bg-ipl-gold text-ipl-navy shadow-neon shadow-ipl-gold/20'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {activeSubTab === 'schedule' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-8 h-fit">
            <section className="glass-panel p-6 border-t-2 border-ipl-gold/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
                    {editingMatch ? <Pencil className="w-4 h-4 text-ipl-gold" /> : <Plus className="w-4 h-4 text-ipl-gold" />}
                    {editingMatch ? 'Edit Match' : 'Schedule Match'}
                  </h3>
                  {editingMatch && (
                    <button onClick={resetMatchForm} className="text-[9px] font-display uppercase tracking-widest text-gray-500 hover:text-white flex items-center gap-1">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  )}
                </div>
                <form onSubmit={handleSubmitMatch} className="space-y-5">
                  <div>
                    <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Match ID (Slug)</label>
                    <input
                      type="text"
                      value={matchId}
                      onChange={(e) => setMatchId(e.target.value)}
                      placeholder="e.g. m1-mi-csk"
                      disabled={!!editingMatch}
                      className="w-full bg-black/40 border border-white/10 p-3 text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all disabled:opacity-50"
                    />
                  </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Team 1</label>
                    <select
                      value={team1}
                      onChange={(e) => setTeam1(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                    >
                      <option value="">Select...</option>
                      {Object.keys(teamColors).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Team 2</label>
                    <select
                      value={team2}
                      onChange={(e) => setTeam2(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                    >
                      <option value="">Select...</option>
                      {Object.keys(teamColors).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Venue</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      placeholder="e.g. Wankhede Stadium"
                      className="w-full bg-black/40 border border-white/10 p-3 pl-10 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Start Time (Local)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 p-3 pl-10 text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={createMatch.isPending || updateMatch.isPending}
                  className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-30"
                >
                  {createMatch.isPending || updateMatch.isPending ? 'PROCESSING...' : editingMatch ? 'UPDATE MATCH' : 'ADD MATCH'}
                </button>
              </form>
            </section>

            <section className="glass-panel p-6 border-t-2 border-ipl-live/50">
              <h3 className="text-lg font-display text-white italic uppercase mb-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-ipl-live" />
                Bulk Import Matches
              </h3>
              <p className="text-[10px] text-gray-400 font-display mb-6">Upload a CSV file to create multiple matches at once.</p>

              <div className="space-y-4">
                <div className="bg-black/40 border border-white/10 p-3 rounded-lg flex items-center justify-between">
                  <span className="text-[10px] font-mono text-gray-300">sample_format.csv</span>
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," + "id,team1,team2,venue,start_time\nipl-2026-01,CSK,RCB,Chennai,2026-03-22T19:30:00Z\nipl-2026-02,DC,PBKS,Mohali,2026-03-23T15:30:00Z";
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "sample_matches.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="text-[9px] font-display uppercase tracking-widest text-ipl-gold hover:text-white transition-all"
                  >
                    Download Sample
                  </button>
                </div>

                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    bulkImport.mutate(
                      { tournamentId, file },
                      {
                        onSuccess: (data) => {
                          toast.success(data.message || 'Matches imported successfully!');
                          refetch();
                          e.target.value = '';
                        },
                        onError: (err: any) => {
                          toast.error(err.response?.data?.detail || 'Import failed');
                        }
                      }
                    );
                  }}
                  className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:border-0
                  file:text-[10px] file:font-display file:uppercase file:tracking-widest
                  file:bg-ipl-live/10 file:text-ipl-live
                  hover:file:bg-ipl-live/20 transition-all cursor-pointer"
                />
              </div>
            </section>
          </div>

          <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
                <Calendar className="w-5 h-5 text-ipl-gold" />
                Match Schedule
              </h3>
              <span className="text-[10px] text-gray-500 font-display uppercase tracking-widest">{matches?.length || 0} Matches Registered</span>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-20 text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing Tournament Schedule...</div>
              ) : matches?.length === 0 ? (
                <div className="text-center py-20 bg-black/20 border border-dashed border-white/10 rounded-xl text-[10px] uppercase tracking-widest text-gray-600">No matches found for this tournament.</div>
              ) : matches?.map((match, idx) => (
                <React.Fragment key={match.id}>
                  <div className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-[10px] font-display text-gray-500 border border-white/10 group-hover:border-ipl-gold/30 group-hover:text-ipl-gold transition-all">
                        {idx + 1}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-white group-hover:text-ipl-gold transition-colors">{match.team1}</span>
                        <span className="text-[10px] text-gray-500 italic uppercase">VS</span>
                        <span className="text-xl font-bold text-white group-hover:text-ipl-gold transition-colors">{match.team2}</span>
                      </div>
                      <div className="h-8 w-px bg-white/10" />
                      <div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin className="w-3 h-3" />
                          <span className="text-[10px] font-display uppercase tracking-widest">{match.venue}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 mt-1">
                          <Calendar className="w-3 h-3" />
                          <span className="text-[9px] font-mono italic">{new Date(match.start_time).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-widest font-bold ${match.status === 'upcoming' ? 'bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/20' :
                        match.status === 'live' ? 'bg-ipl-live/10 text-ipl-live border border-ipl-live/20 animate-pulse' :
                          'bg-white/5 text-gray-500 border border-white/10'
                        }`}>
                        {match.status}
                      </span>
                      <button
                        onClick={() => handleEditMatch(match)}
                        className="p-2 text-gray-500 hover:text-ipl-gold hover:bg-ipl-gold/10 rounded-lg transition-all"
                        title="Edit Match"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeSubTab === 'bank' && (
        <div className="max-w-2xl">
          <TournamentQuestionBankManager tournamentId={tournamentId} />
        </div>
      )}

      {activeSubTab === 'grading' && (
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-display text-white italic uppercase mb-6 flex items-center gap-2">
              <Star className="w-4 h-4 text-ipl-gold" />
              Select Match to Grade
            </h3>
            {isLoading ? (
              <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing...</div>
            ) : matches?.length === 0 ? (
              <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl text-[10px] uppercase tracking-widest text-gray-600">No matches found.</div>
            ) : matches?.map(match => (
              <button
                key={match.id}
                onClick={() => setGradingMatchId(match.id)}
                className={`w-full text-left p-4 border rounded-xl transition-all flex items-center justify-between ${gradingMatchId === match.id
                    ? 'bg-ipl-gold/10 border-ipl-gold shadow-[0_0_15px_rgba(244,196,48,0.2)]'
                    : 'bg-white/5 border-white/10 hover:border-ipl-gold/50'
                  }`}
              >
                <div>
                  <div className="flex items-center gap-2 text-white font-bold font-display">
                    <span>{match.team1}</span>
                    <span className="text-[10px] text-gray-500 italic font-normal">VS</span>
                    <span>{match.team2}</span>
                  </div>
                  <div className="text-[9px] font-mono text-gray-500 mt-1">{new Date(match.start_time).toLocaleDateString()}</div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[8px] uppercase tracking-widest font-bold ${match.status === 'upcoming' ? 'bg-ipl-gold/10 text-ipl-gold' :
                    match.status === 'live' ? 'bg-ipl-live/10 text-ipl-live animate-pulse' :
                      'bg-white/5 text-gray-500'
                  }`}>
                  {match.status}
                </span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {gradingMatchId ? (
              <div className="glass-panel p-6 border-t-2 border-ipl-gold/50">
                <TournamentMatchGrading tournamentId={tournamentId} matchId={gradingMatchId} onClose={() => setGradingMatchId(null)} />
              </div>
            ) : (
              <div className="glass-panel p-20 text-center border-dashed border-2 border-white/5 opacity-50 flex flex-col items-center gap-4 h-full justify-center">
                <div className="p-4 bg-white/5 rounded-full">
                  <Star className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">Select a match from the list to begin grading</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TournamentQuestionBankManager({ tournamentId }: { tournamentId: string }) {
  const { data: bank, isLoading, refetch } = useTournamentQuestionBank(tournamentId);
  const addQuestion = useAddTournamentQuestion();
  const updateQuestion = useUpdateTournamentQuestion();
  const deleteQuestion = useDeleteTournamentQuestion();

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<'toggle' | 'multiple_choice' | 'dropdown' | 'free_text' | 'free_number'>('toggle');
  const [optionsStr, setOptionsStr] = useState('');

  const handleEdit = (q: any) => {
    setEditingQuestionId(q.id);
    setKey(q.key);
    setQuestionText(q.question_text);
    setQuestionType(q.question_type);
    setOptionsStr(q.options ? q.options.join(', ') : '');
    // Scroll to form or just show it's editing
    toast.info(`Editing question: ${q.key}`);
  };

  const resetForm = () => {
    setEditingQuestionId(null);
    setKey('');
    setQuestionText('');
    setQuestionType('toggle');
    setOptionsStr('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key || !questionText) return;

    let options: string[] | null = null;
    if (['toggle', 'multiple_choice', 'dropdown'].includes(questionType)) {
      options = optionsStr.split(',').map(s => s.trim()).filter(Boolean);
      if (options.length < 2) {
        toast.error('Please provide at least 2 options');
        return;
      }
    }

    const payload = {
      key,
      question_text: questionText,
      question_type: questionType,
      options,
      default_scoring_rules: {
        exact_match_points: 10,
        wrong_answer_points: 0,
        within_range_points: 5
      },
      order_index: bank?.questions?.find((q: any) => q.id === editingQuestionId)?.order_index || bank?.questions?.length || 0,
      allow_powerup: true
    };

    try {
      if (editingQuestionId) {
        await updateQuestion.mutateAsync({ tournamentId, questionId: editingQuestionId, payload });
        toast.success('Question updated in bank');
      } else {
        await addQuestion.mutateAsync({ tournamentId, payload });
        toast.success('Question added to bank');
      }
      resetForm();
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save question');
    }
  };

  return (
    <section className="lg:col-span-3 glass-panel p-6 border-t-2 border-ipl-gold/50">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-ipl-gold" />
          Tournament Question Bank
        </h3>
        <span className="text-[10px] text-gray-500 font-display uppercase tracking-widest">{bank?.questions?.length || 0} Questions</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Add Question Form */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Question Key (Unique Identifier)</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="e.g. match_winner"
                className="w-full bg-black/40 border border-white/10 p-3 text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Question Text</label>
              <input
                type="text"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="e.g. Who will win the match?"
                className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as any)}
                className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
              >
                <option value="toggle">Toggle (2 options)</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="dropdown">Dropdown</option>
                <option value="free_text">Free Text</option>
                <option value="free_number">Free Number</option>
              </select>
            </div>
            {['toggle', 'multiple_choice', 'dropdown'].includes(questionType) && (
              <div>
                <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Options (Comma separated)</label>
                <input
                  type="text"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  placeholder="e.g. {{Team1}}, {{Team2}}"
                  className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                />
                <p className="text-[9px] text-gray-500 mt-1 uppercase tracking-widest">Use {'{{Team1}}'} and {'{{Team2}}'} for dynamic match teams</p>
              </div>
            )}
            <div className="flex gap-2">
              {editingQuestionId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 bg-white/5 text-gray-400 border border-white/10 font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white/10 hover:text-white transition-all"
                >
                  CANCEL
                </button>
              )}
              <button
                type="submit"
                disabled={addQuestion.isPending || updateQuestion.isPending || !key || !questionText}
                className={`flex-[2] py-3 font-display text-[10px] uppercase tracking-[0.3em] font-bold transition-all disabled:opacity-30 ${editingQuestionId
                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/50 hover:bg-blue-500 hover:text-white'
                    : 'bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/50 hover:bg-ipl-gold hover:text-ipl-navy'
                  }`}
              >
                {editingQuestionId ? (updateQuestion.isPending ? 'UPDATING...' : 'UPDATE QUESTION') : (addQuestion.isPending ? 'ADDING...' : 'ADD QUESTION TO BANK')}
              </button>
            </div>
          </form>
        </div>

        {/* Existing Questions */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="text-center py-10 text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Loading Question Bank...</div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {bank?.questions?.length === 0 ? (
                <div className="text-center py-10 bg-black/20 border border-dashed border-white/10 rounded-xl text-[10px] uppercase tracking-widest text-gray-600">No questions in bank yet.</div>
              ) : bank?.questions?.map((q: any) => (
                <div key={q.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex items-start justify-between">
                  <div>
                    <span className="px-2 py-0.5 bg-white/10 text-[8px] font-mono uppercase tracking-widest text-gray-400 rounded mr-2">{q.key}</span>
                    <span className="text-sm font-bold text-white block mt-1">{q.question_text}</span>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[9px] text-gray-500 uppercase tracking-widest">Type: {q.question_type}</span>
                      {q.options && q.options.length > 0 && (
                        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Options: {q.options.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(q)}
                      className="p-2 text-gray-500 hover:text-blue-400 hover:bg-white/5 rounded-full transition-colors"
                      title="Edit Question"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete question '${q.key}' from the bank?`)) {
                          deleteQuestion.mutate({ tournamentId, questionId: q.id }, {
                            onSuccess: () => toast.success(`Question '${q.key}' deleted`),
                            onError: (err: any) => toast.error(err.response?.data?.detail || 'Failed to delete question')
                          });
                        }
                      }}
                      disabled={deleteQuestion.isPending}
                      className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-full transition-colors disabled:opacity-30"
                      title="Delete Question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function LeagueUserManager({ leagueId, onBack }: { leagueId: string, onBack: () => void }) {
  const { data: league, isLoading, refetch } = useLeagueDetails(leagueId);
  const { data: allUsers } = useAllUsers();

  const toggleAdmin = useToggleLeagueAdmin(leagueId);
  const kickMember = useKickMember(leagueId);
  const addMember = useAddLeagueMember();

  const [selectedUserId, setSelectedUserId] = useState('');

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      await addMember.mutateAsync({ leagueId, userId: selectedUserId });
      toast.success('User provisioned to league');
      setSelectedUserId('');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to provision user');
    }
  };

  const availableUsers = allUsers?.filter(u => !league?.participants?.find(p => p.id === u.id)) || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-all">
          <RefreshCw className="w-5 h-5 rotate-[-90deg]" />
        </button>
        <div>
          <h2 className="text-2xl font-display text-white uppercase italic tracking-tighter flex items-center gap-3">
            <Users className="text-ipl-gold" />
            League Roster: {league?.name || 'Loading...'}
          </h2>
          <p className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Manage members and admin roles</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit">
          <h3 className="text-lg font-display text-white italic uppercase mb-6 flex items-center gap-2">
            <Plus className="w-4 h-4 text-ipl-gold" />
            Provision User
          </h3>
          <form onSubmit={handleAddMember} className="space-y-5">
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Select User from Global Directory</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
              >
                <option value="">Select user...</option>
                {availableUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={addMember.isPending || !selectedUserId}
              className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-30"
            >
              {addMember.isPending ? 'PROVISIONING...' : 'ADD USER'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-display text-white italic uppercase flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-ipl-gold" />
              Current Members
            </h3>
            <span className="text-[10px] text-gray-500 font-display uppercase tracking-widest">{league?.participants?.length || 0} Members</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/20">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 text-[9px] uppercase tracking-[0.2em] text-gray-500 font-display">
                  <th className="p-4 font-normal">Player</th>
                  <th className="p-4 font-normal text-center">League Admin</th>
                  <th className="p-4 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-display">
                {isLoading ? (
                  <tr><td colSpan={3} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600 animate-pulse">Syncing League Roster...</td></tr>
                ) : league?.participants?.length === 0 ? (
                  <tr><td colSpan={3} className="p-10 text-center text-[10px] uppercase tracking-widest text-gray-600 bg-black/20 border border-dashed border-white/10 rounded-xl">No members found in this league.</td></tr>
                ) : league?.participants?.map(participant => (
                  <tr key={participant.id} className="hover:bg-white/5 transition-all group">
                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <img
                          src={participant.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${participant.name}`}
                          className="w-10 h-10 rounded-full border border-white/10 group-hover:border-ipl-gold transition-colors"
                          alt=""
                        />
                        <div className="flex flex-col">
                          <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{participant.name}</span>
                          <span className="text-[9px] text-gray-600 font-mono">Joined: {new Date(participant.joined_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => toggleAdmin.mutate({ userId: participant.id, isAdmin: !participant.is_league_admin })}
                        className={`p-2 border transition-all ${participant.is_league_admin ? 'bg-ipl-gold/10 border-ipl-gold text-ipl-gold' : 'border-white/10 text-gray-600 hover:text-white'}`}
                        title={participant.is_league_admin ? "Remove Admin Role" : "Make League Admin"}
                      >
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${participant.name} from this league?`)) {
                            kickMember.mutate(participant.id);
                          }
                        }}
                        className="p-2 text-gray-600 hover:text-red-500 transition-colors ml-auto flex items-center gap-2"
                        title="Remove User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function TournamentMatchGrading({ tournamentId, matchId, onClose }: { tournamentId: string, matchId: string, onClose: () => void }) {
  const { data: matches } = useMatches(tournamentId);
  const currentMatch = matches?.find(m => m.id === matchId);

  const { data: questionBank } = useTournamentQuestionBank(tournamentId);
  const { data: answers, isLoading } = useTournamentMatchAnswers(tournamentId, matchId);
  const { mutate: updateAnswers, isPending } = useUpdateTournamentMatchAnswers();
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (answers?.correct_answers) {
      setCorrectAnswers(answers.correct_answers);
    } else {
      setCorrectAnswers({});
    }
  }, [answers]);

  const handleSave = () => {
    updateAnswers({
      tournamentId,
      matchId,
      correct_answers: correctAnswers
    }, {
      onSuccess: () => {
        toast.success('Grading complete. Scores triggered globally and per league!');
        onClose();
      },
      onError: () => toast.error('Failed to save results')
    });
  };

  if (isLoading) return <div className="text-center py-10 animate-pulse font-display text-gray-600 text-xs">Loading keys...</div>;
  if (!questionBank?.questions || questionBank.questions.length === 0) {
    return <div className="text-center py-10 text-gray-500 font-display text-[10px] uppercase tracking-widest">No questions in the tournament bank.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xl font-display text-white italic">Match Results</h3>
          <p className="text-[10px] text-gray-400 uppercase font-display tracking-widest mt-1">Set correct answers for the entire tournament for this match</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-white/10 text-gray-400 hover:text-white font-display text-xs uppercase tracking-[0.2em] transition-all hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-8 py-3 bg-ipl-gold text-black font-display text-xs uppercase tracking-[0.2em] hover:bg-white transition-all disabled:opacity-30 shadow-[0_0_20px_rgba(244,196,48,0.2)]"
          >
            {isPending ? 'Propagating...' : 'Release Scores'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 mt-6">
        {questionBank.questions.map((q: any) => {
          const replacedText = q.question_text
            .replace(/\{\{Team1\}\}/gi, currentMatch?.team1 || 'Team 1')
            .replace(/\{\{Team2\}\}/gi, currentMatch?.team2 || 'Team 2');

          const choiceTypes = ['toggle', 'multiple_choice', 'dropdown'];
          const isChoice = choiceTypes.includes(q.question_type);

          const replacedOptions = q.options?.map((opt: string) =>
            opt.replace(/\{\{Team1\}\}/gi, currentMatch?.team1 || 'Team 1')
              .replace(/\{\{Team2\}\}/gi, currentMatch?.team2 || 'Team 2')
          );

          return (
            <div key={q.id} className="p-6 border-l-2 border-white/10 hover:border-ipl-gold transition-all bg-white/5 rounded-r-xl">
              <h4 className="text-sm font-display text-white tracking-widest uppercase mb-4">{replacedText}</h4>
              {isChoice && replacedOptions ? (
                <div className="flex flex-wrap gap-3">
                  {replacedOptions.map((opt: string) => (
                    <button
                      key={opt}
                      onClick={() => setCorrectAnswers(prev => ({ ...prev, [q.key]: opt }))}
                      className={`px-4 py-2 font-display text-xs uppercase tracking-widest transition-all ${correctAnswers[q.key] === opt
                          ? 'bg-ipl-gold text-ipl-navy'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type={q.question_type === 'free_number' ? 'number' : 'text'}
                  value={correctAnswers[q.key] || ''}
                  onChange={(e) => setCorrectAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 p-3 text-white font-display text-xs focus:border-ipl-gold focus:outline-none transition-all"
                  placeholder={`Enter correct ${q.question_type.replace('free_', '')}...`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
