import React, { useState } from 'react';
import { Users, ShieldCheck, Mail, Trash2, Bot, Cpu } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import { useAllowlist, useAddAllowlist, useDeleteAllowlist, useAllUsers, useUpdateBasePoints, useTriggerAIPredictions } from '../api/hooks/useAdmin';
import toast from 'react-hot-toast';


export default function Admin() {
  const { user } = useAuthStore();
  const [newEmail, setNewEmail] = useState('');
  const [isGuest, setIsGuest] = useState(false);

  const { data: allowlist, isLoading: isAllowlistLoading } = useAllowlist();
  const { mutate: addEmail, isPending: isAdding } = useAddAllowlist();
  const { mutate: deleteEmail } = useDeleteAllowlist();
  
  const { mutate: triggerAI, isPending: isTriggerAIPending } = useTriggerAIPredictions();

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    const emails = newEmail.split(',').map(e => e.trim()).filter(Boolean);
    addEmail({ emails, isGuest }, {
      onSuccess: () => {
        setNewEmail('');
        setIsGuest(false);
        toast.success(`${emails.length} emails added as ${isGuest ? 'guests' : 'experts'}`);
      },
      onError: () => toast.error('Failed to update access list')
    });
  };



  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 relative">

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
              type="button"
              onClick={() => setIsGuest(!isGuest)}
              className={`px-4 font-display text-[10px] uppercase tracking-tighter transition-all border-2 flex items-center gap-2 ${isGuest ? 'bg-ipl-gold border-ipl-gold text-black' : 'border-white/10 text-gray-500 hover:border-white/20'}`}
            >
              <Users className="w-3 h-3" />
              {isGuest ? 'Guest Role' : 'Expert Role'}
            </button>
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
                    <div className="flex flex-col gap-1">
                      <span className="text-gray-300 font-mono text-sm tracking-tight">{entry.email}</span>
                      <span className={`text-[9px] font-display uppercase tracking-widest font-bold ${entry.is_guest ? 'text-ipl-gold' : 'text-ipl-live'}`}>
                        {entry.is_guest ? 'Guest' : 'Expert'} Access
                      </span>
                    </div>
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

        {/* AI Predictor Management */}
        <section className="glass-panel p-6 border-t-2 border-t-blue-500 shadow-[0_10px_30px_rgba(59,130,246,0.1)] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Bot className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-display text-white">AI Predictor Engine</h2>
              <p className="text-xs text-gray-500 uppercase tracking-widest font-display">Manage Autonomous User</p>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col justify-center space-y-6">
             <div className="bg-black/30 p-6 border border-white/10 rounded relative group">
                <div className="absolute top-0 left-0 w-1 h-full bg-ipl-live group-hover:bg-ipl-gold transition-colors"></div>
                <h3 className="text-sm font-display text-white mb-2 tracking-widest flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-ipl-gold" />
                  RUN PREDICTION ALOGIRTHM
                </h3>
                <p className="text-xs text-gray-400 mb-4 font-mono leading-relaxed">
                  Manually trigger the background prediction job for today's matches. (The scheduler automatically does this at 12 AM UTC daily).
                </p>
                <button
                  onClick={() => {
                    triggerAI(undefined, {
                      onSuccess: () => toast.success('Prediction algorithm running in background'),
                      onError: () => toast.error('Failed to trigger predictions')
                    });
                  }}
                  disabled={isTriggerAIPending}
                  className="w-full py-3 bg-ipl-live text-white font-display text-xs tracking-[0.2em] uppercase transition-all hover:bg-red-600 disabled:opacity-50"
                >
                  {isTriggerAIPending ? 'RUNNING...' : 'TRIGGER PREDICTIONS NOW'}
                </button>
             </div>
          </div>
        </section>

        {/* Campaign Management */}
        <section className="glass-panel p-6 border-t-2 border-t-ipl-gold shadow-[0_10px_30px_rgba(244,196,48,0.1)] flex flex-col mt-8 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-ipl-gold/10 rounded-lg">
                <ShieldCheck className="w-6 h-6 text-ipl-gold" />
              </div>
              <div>
                <h2 className="text-xl font-display text-white">Campaign Builder</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-display">Create custom questions</p>
              </div>
            </div>
            <a href="/admin/campaigns" className="px-5 py-2.5 bg-white text-black text-xs font-display uppercase tracking-widest hover:bg-gray-200 transition-colors">
              Manage Campaigns
            </a>
          </div>
        </section>
      </div>

      {/* User Management Section */}
      <section className="mt-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <UserScoreManager />
      </section>
    </div>
  );
}

function UserScoreManager() {
  const { data: users, isLoading } = useAllUsers();
  const { mutate: updateBasePoints, isPending } = useUpdateBasePoints();
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});
  const [localPowerups, setLocalPowerups] = useState<Record<string, number>>({});

  const handleUpdate = (userId: string) => {
    const basePoints = localPoints[userId];
    const basePowerups = localPowerups[userId];
    if (basePoints === undefined && basePowerups === undefined) return;
    const user = users?.find(u => u.id === userId);
    updateBasePoints({
      userId,
      basePoints: basePoints ?? user?.base_points ?? 0,
      basePowerups: basePowerups ?? user?.base_powerups ?? 10
    });
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

      <div className="overflow-x-auto w-full custom-scrollbar pb-2">
        <table className="w-full text-left min-w-[650px] whitespace-nowrap">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 uppercase font-display text-[10px] tracking-widest text-gray-500">
              <th className="p-4 font-normal">Active Player</th>
              <th className="p-4 font-normal text-center">Base Score</th>
              <th className="p-4 font-normal text-center">Base Powerups</th>
              <th className="p-4 font-normal text-right">Adjust Settings</th>
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
                <td className="p-4 text-center">
                  <div className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded font-mono text-blue-400 text-lg">
                    {user.base_powerups !== undefined ? user.base_powerups : 10}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end items-center gap-3">
                    <div className="flex gap-2">
                      <div className="relative group/input">
                        <input
                          type="number"
                          placeholder={user.base_points.toString()}
                          className="w-16 bg-ipl-navy border-2 border-white/10 p-2 text-center text-white focus:border-ipl-gold focus:outline-none transition-all font-mono text-xs"
                          value={localPoints[user.id] ?? user.base_points}
                          onChange={(e) => setLocalPoints({ ...localPoints, [user.id]: parseInt(e.target.value) || 0 })}
                        />
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity whitespace-nowrap bg-black text-[8px] px-2 py-0.5 rounded border border-white/10">SCORE</div>
                      </div>
                      <div className="relative group/input">
                        <input
                          type="number"
                          placeholder={(user.base_powerups !== undefined ? user.base_powerups : 10).toString()}
                          className="w-16 bg-ipl-navy border-2 border-white/10 p-2 text-center text-white focus:border-blue-400 focus:outline-none transition-all font-mono text-xs"
                          value={localPowerups[user.id] ?? (user.base_powerups !== undefined ? user.base_powerups : 10)}
                          onChange={(e) => setLocalPowerups({ ...localPowerups, [user.id]: parseInt(e.target.value) || 0 })}
                        />
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/input:opacity-100 transition-opacity whitespace-nowrap bg-black text-[8px] px-2 py-0.5 rounded border border-white/10">POWERUPS</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUpdate(user.id)}
                      disabled={isPending}
                      className="h-10 px-4 bg-white text-ipl-navy text-[10px] font-bold uppercase tracking-widest hover:bg-ipl-gold hover:scale-105 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {isPending ? 'Sync...' : 'Save'}
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
