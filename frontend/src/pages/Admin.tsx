import React, { useState } from 'react';
import { Users, ShieldCheck, Mail, Trash2, Bot, Cpu, Plus, Trophy, ExternalLink, RefreshCw, Calendar, MapPin, Sword } from 'lucide-react';
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
  useCreateMatch
} from '../api/hooks/useAdmin';
import { useMatches } from '../api/hooks/useMatches';
import { useCreateLeague } from '../api/hooks/useLeagues';
import { teamColors } from '../utils/teamColors';
import toast from 'react-hot-toast';

export default function Admin() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'tournaments' | 'leagues' | 'users' | 'campaigns' | 'system'>('tournaments');
  const [managingTournamentId, setManagingTournamentId] = useState<string | null>(null);

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleManageMatches = (tournamentId: string) => {
    setManagingTournamentId(tournamentId);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20 relative">
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
          { id: 'tournaments', label: 'Tournaments', icon: ShieldCheck },
          { id: 'leagues', label: 'Leagues', icon: Trophy },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'campaigns', label: 'Campaigns', icon: ShieldCheck },
          { id: 'system', label: 'System', icon: Cpu },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-display text-[10px] uppercase tracking-widest transition-all ${
              activeTab === tab.id 
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
        {activeTab === 'leagues' && <LeagueManagement />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'campaigns' && <CampaignManagement />}
        {activeTab === 'system' && <SystemManagement />}
      </main>
    </div>
  );
}

function LeagueManagement() {
  const { data: leagues, isLoading: isLeaguesLoading } = useAllLeagues();
  const { data: tournaments } = useTournaments();
  const createLeague = useCreateLeague();
  
  const [showCreate, setShowCreate] = useState(false);
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
      {/* Create Section */}
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
                placeholder="e.g. Google Cloud Elite"
              />
            </div>
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Associate Tournament</label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 p-3 text-white font-display focus:border-ipl-gold focus:outline-none transition-all appearance-none"
              >
                <option value="">Select Tournament...</option>
                {tournaments?.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2">Default Starting Powerups</label>
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
              {createLeague.isPending ? 'Provisioing...' : 'Provision League'}
            </button>
          </form>
        )}
      </section>

      {/* List Section */}
      <section className="lg:col-span-2 glass-panel p-6 border-t-2 border-white/10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
             <Trophy className="w-6 h-6 text-ipl-gold" />
             <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Active Battlegrounds</h2>
          </div>
          <button className="p-2 hover:bg-white/5 rounded-full transition-all text-gray-500 hover:text-ipl-gold">
            <RefreshCw className="w-4 h-4" />
          </button>
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
                    <button className="text-gray-600 hover:text-white transition-all">
                      <ExternalLink className="w-4 h-4" />
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

  return (
    <div className="glass-panel p-8 border-t-2 border-white/10">
       <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <Users className="w-6 h-6 text-blue-500" />
        </div>
        <div>
          <h2 className="text-2xl font-display text-white italic tracking-tighter uppercase">Global User Directory</h2>
          <p className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Adjust starting scores and delegating admin privileges</p>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 uppercase font-display text-[10px] tracking-widest text-gray-500">
              <th className="p-4 font-normal">Active Player</th>
              <th className="p-4 font-normal text-center">Base Score</th>
              <th className="p-4 font-normal text-center">Powerups</th>
              <th className="p-4 font-normal text-center">TG Access</th>
              <th className="p-4 font-normal text-right">Settings</th>
            </tr>
          </thead>
          <tbody className="font-display divide-y divide-white/5">
            {users?.map((user) => (
              <tr key={user.id} className="hover:bg-white/5 transition-all group">
                <td className="p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`}
                      className="w-10 h-10 rounded-full border border-white/10 group-hover:border-ipl-gold transition-colors"
                      alt=""
                    />
                    <div className="flex flex-col">
                      <span className="text-sm text-white group-hover:text-ipl-gold transition-colors">{user.name}</span>
                      <span className="text-[9px] text-gray-600 font-mono">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-center">
                   <input
                    type="number"
                    className="w-16 bg-black/40 border border-white/10 p-2 text-center text-white focus:border-ipl-gold focus:outline-none transition-all font-mono text-xs"
                    value={localPoints[user.id] ?? user.base_points}
                    onChange={(e) => setLocalPoints({ ...localPoints, [user.id]: parseInt(e.target.value) || 0 })}
                  />
                </td>
                <td className="p-4 text-center">
                  <input
                    type="number"
                    className="w-16 bg-black/40 border border-white/10 p-2 text-center text-white focus:border-blue-400 focus:outline-none transition-all font-mono text-xs"
                    value={localPowerups[user.id] ?? user.base_powerups}
                    onChange={(e) => setLocalPowerups({ ...localPowerups, [user.id]: parseInt(e.target.value) || 0 })}
                  />
                </td>
                <td className="p-4 text-center">
                  <button 
                    onClick={() => setLocalTelegram({ ...localTelegram, [user.id]: !(localTelegram[user.id] ?? user.is_telegram_admin) })}
                    className={`p-2 border transition-all ${ (localTelegram[user.id] ?? user.is_telegram_admin) ? 'bg-ipl-live border-ipl-live text-white' : 'border-white/10 text-gray-600' }`}
                  >
                    <Bot className="w-4 h-4" />
                  </button>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => handleUpdate(user.id)}
                    disabled={isPending}
                    className="px-4 py-2 bg-white text-ipl-navy text-[10px] font-bold uppercase tracking-widest hover:bg-ipl-gold transition-all"
                  >
                    {isPending ? '...' : 'SAVE'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignManagement() {
  const { data: allowlist, isLoading: isAllowlistLoading } = useAllowlist();
  const { mutate: addEmail, isPending: isAdding } = useAddAllowlist();
  const { mutate: deleteEmail } = useDeleteAllowlist();
  const [newEmail, setNewEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);

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
    <div className="grid lg:grid-cols-2 gap-8">
      <section className="glass-panel p-6 border-t-2 border-t-ipl-live">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-6 h-6 text-ipl-live" />
          <h2 className="text-xl font-display text-white italic uppercase tracking-tight">Manual Whitelist</h2>
        </div>
        <form onSubmit={handleAddEmail} className="flex gap-2 mb-6">
           <input
            type="text"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Comma separated emails..."
            className="flex-1 bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-xs"
          />
          <button type="submit" className="bg-ipl-live text-white px-6 font-display text-[10px] uppercase tracking-widest">
            {isAdding ? 'ADDING...' : 'ADD'}
          </button>
        </form>
        <div className="h-[400px] overflow-y-auto custom-scrollbar border border-white/10 bg-black/20">
           {allowlist?.map(entry => (
             <div key={entry.email} className="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 group">
                <span className="font-mono text-xs text-gray-300">{entry.email}</span>
                <button onClick={() => deleteEmail(entry.email)} className="text-gray-600 hover:text-ipl-live opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
           ))}
        </div>
      </section>

      <section className="glass-panel p-6 border-t-2 border-ipl-gold flex flex-col items-center justify-center text-center">
        <ShieldCheck className="w-16 h-16 text-ipl-gold mb-6 opacity-20" />
        <h2 className="text-2xl font-display text-white mb-2 uppercase italic tracking-tighter">Master Campaigns</h2>
        <p className="text-xs text-gray-500 mb-8 max-w-sm uppercase tracking-widest font-display">Manage global match questions for the 2026 Season</p>
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
                      Manage Matches
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

  const [matchId, setMatchId] = useState('');
  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [venue, setVenue] = useState('');
  const [tossTime, setTossTime] = useState('');

  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchId || !team1 || !team2 || !venue || !tossTime) return;
    try {
      await createMatch.mutateAsync({
        id: matchId,
        team1,
        team2,
        venue,
        toss_time: new Date(tossTime).toISOString(),
        tournament_id: tournamentId
      });
      toast.success('Match created successfully!');
      setMatchId('');
      setTeam1('');
      setTeam2('');
      setVenue('');
      setTossTime('');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create match');
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
            Tournament Match Manager
          </h2>
          <p className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Tournament: {tournamentId}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="glass-panel p-6 border-t-2 border-ipl-gold/50 h-fit">
          <h3 className="text-lg font-display text-white italic uppercase mb-6 flex items-center gap-2">
            <Plus className="w-4 h-4 text-ipl-gold" />
            Add New Match
          </h3>
          <form onSubmit={handleCreateMatch} className="space-y-5">
            <div>
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Internal Match ID</label>
              <input
                type="text"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="e.g. m1-mi-csk"
                className="w-full bg-black/40 border border-white/10 p-3 text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
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
              <label className="block text-[9px] font-display uppercase tracking-[0.2em] text-gray-500 mb-1.5">Toss Time (Local)</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  type="datetime-local"
                  value={tossTime}
                  onChange={(e) => setTossTime(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-3 pl-10 text-white font-mono text-xs focus:border-ipl-gold focus:outline-none transition-all"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={createMatch.isPending}
              className="w-full py-4 bg-ipl-gold text-ipl-navy font-display text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-white hover:scale-[1.02] transition-all disabled:opacity-30"
            >
              {createMatch.isPending ? 'CREATING...' : 'ADD MATCH'}
            </button>
          </form>
        </section>

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
            ) : matches?.map(match => (
              <div key={match.id} className="bg-white/5 border border-white/10 p-4 rounded-xl hover:bg-white/10 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-6">
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
                      <span className="text-[9px] font-mono italic">{new Date(match.tossTime).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-[8px] uppercase tracking-widest font-bold ${
                    match.status === 'upcoming' ? 'bg-ipl-gold/10 text-ipl-gold border border-ipl-gold/20' :
                    match.status === 'live' ? 'bg-ipl-live/10 text-ipl-live border border-ipl-live/20 animate-pulse' :
                    'bg-white/5 text-gray-500 border border-white/10'
                  }`}>
                    {match.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
