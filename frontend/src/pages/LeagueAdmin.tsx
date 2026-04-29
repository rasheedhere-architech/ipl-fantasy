import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Shield, ChevronRight,
  Search, Filter, UserMinus, Crown,
  Save
} from 'lucide-react';
import { useLeagueDetails, useKickMember } from '../api/hooks/useLeagues';
import { useAdminCampaigns } from '../api/hooks/useCampaigns';
import { useCampaignMatchResult, useUpdateCampaignMatchResult } from '../api/hooks/useCampaignResults';
import { useMatches } from '../api/hooks/useMatches';
import toast from 'react-hot-toast';

export default function LeagueAdmin() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { data: league, isLoading: isLeagueLoading } = useLeagueDetails(leagueId!);
  const [activeTab, setActiveTab] = useState<'members' | 'grading' | 'settings'>('members');

  if (isLeagueLoading) return <div className="p-20 text-center animate-pulse font-display text-gray-500 uppercase tracking-widest">Initialising Command...</div>;
  if (!league) return <div className="p-20 text-center font-display text-ipl-live uppercase tracking-widest">League Not Found</div>;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      <header className="flex justify-between items-end border-b-2 border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3 text-gray-500 font-display text-[10px] uppercase tracking-widest mb-2">
            <Link to="/leagues" className="hover:text-white transition-colors">My Leagues</Link>
            <ChevronRight className="w-3 h-3" />
            <Link to={`/leagues/${leagueId}`} className="hover:text-white transition-colors">{league.name}</Link>
          </div>
          <h1 className="text-4xl font-display text-white flex items-center gap-4 italic tracking-tighter">
            <Shield className="w-10 h-10 text-ipl-gold shadow-[0_0_20px_rgba(244,196,48,0.2)]" />
            League Management
          </h1>
        </div>
        <div className="flex gap-2">
          {['members', 'grading', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-2.5 font-display text-[10px] uppercase tracking-widest transition-all border-b-2 ${activeTab === tab
                  ? 'text-ipl-gold border-ipl-gold bg-ipl-gold/5'
                  : 'text-gray-500 border-transparent hover:text-white hover:bg-white/5'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'members' && <MemberManagement league={league} />}
      {activeTab === 'grading' && <CampaignGrading leagueId={leagueId!} />}
      {activeTab === 'settings' && <div className="glass-panel p-12 text-center opacity-30 font-display uppercase tracking-widest italic">League configuration coming soon</div>}
    </div>
  );
}

function MemberManagement({ league }: { league: any }) {
  const { mutate: kickMember } = useKickMember(league.id);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredParticipants = league.participants.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleKick = (userId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name} from the league?`)) return;
    kickMember(userId, {
      onSuccess: () => toast.success(`${name} removed`),
      onError: () => toast.error('Action failed')
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/40 border-2 border-white/10 py-2.5 pl-10 pr-4 text-white font-display text-xs placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all"
          />
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <span className="block text-[10px] text-gray-500 uppercase tracking-widest">Active Roster</span>
            <span className="text-2xl font-display text-white">{league.participants.length} / 50</span>
          </div>
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/10 uppercase font-display text-[10px] tracking-widest text-gray-500">
              <th className="p-4 font-normal">Participant</th>
              <th className="p-4 font-normal">Joined On</th>
              <th className="p-4 font-normal text-center">Powerups</th>
              <th className="p-4 font-normal text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredParticipants.map((p: any) => (
              <tr key={p.id} className="group hover:bg-white/[0.02] transition-all">
                <td className="p-4">
                  <div className="flex items-center gap-4">
                    <img src={p.avatar_url} className="w-10 h-10 rounded-image border border-white/10" alt="" />
                    <div>
                      <span className="block text-white font-display text-sm group-hover:text-ipl-gold transition-colors">{p.name}</span>
                      {p.id === league.created_by && (
                        <span className="flex items-center gap-1 text-[8px] text-ipl-gold uppercase tracking-tighter">
                          <Crown className="w-2 h-2" /> League Owner
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-4 text-xs font-mono text-gray-400">
                  {new Date(p.joined_at).toLocaleDateString()}
                </td>
                <td className="p-4 text-center">
                  <span className="inline-block px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded font-mono text-blue-400">
                    {p.remaining_powerups}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {p.id !== league.created_by && (
                    <button
                      onClick={() => handleKick(p.id, p.name)}
                      className="p-2 text-gray-600 hover:text-ipl-live transition-all opacity-0 group-hover:opacity-100"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CampaignGrading({ leagueId }: { leagueId: string }) {
  const { data: allCampaigns } = useAdminCampaigns();
  const leagueCampaigns = allCampaigns?.filter(c => c.league_id === leagueId || c.is_master);
  const { data: matches } = useMatches();

  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedMatch, setSelectedMatch] = useState<string>('');

  const activeCampaign = leagueCampaigns?.find(c => c.id === selectedCampaign);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Select Campaign</label>
          <div className="relative">
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-sm appearance-none focus:outline-none focus:border-ipl-gold transition-all"
            >
              <option value="">Choose Campaign...</option>
              {leagueCampaigns?.map(c => (
                <option key={c.id} value={c.id}>{c.title} {c.is_master ? '(Global)' : ''}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 rotate-90 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] text-gray-500 font-display uppercase tracking-widest">Target Match</label>
          <div className="relative">
            <select
              value={selectedMatch}
              onChange={(e) => setSelectedMatch(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-sm appearance-none focus:outline-none focus:border-ipl-gold transition-all"
            >
              <option value="">Choose Match...</option>
              {matches?.map(m => (
                <option key={m.id} value={m.id}>{m.team1} vs {m.team2} (M{m.id.split('-').pop()})</option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      {activeCampaign && selectedMatch ? (
        <GradingInterface campaign={activeCampaign} matchId={selectedMatch} />
      ) : (
        <div className="glass-panel p-20 text-center border-dashed border-2 border-white/5 opacity-50 flex flex-col items-center gap-4">
          <div className="p-4 bg-white/5 rounded-full">
            <Filter className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">Select a campaign and match to begin grading</p>
        </div>
      )}
    </div>
  );
}

function GradingInterface({ campaign, matchId }: { campaign: any, matchId: string }) {
  const { data: results, isLoading } = useCampaignMatchResult(campaign.id, matchId);
  const { mutate: updateResults, isPending } = useUpdateCampaignMatchResult();
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, any>>({});

  React.useEffect(() => {
    if (results?.correct_answers) {
      setCorrectAnswers(results.correct_answers);
    } else {
      setCorrectAnswers({});
    }
  }, [results, campaign.id, matchId]);

  const handleSave = () => {
    updateResults({
      campaignId: campaign.id,
      matchId,
      correct_answers: correctAnswers
    }, {
      onSuccess: () => toast.success('Grading complete. Scores triggered.'),
      onError: () => toast.error('Failed to save results')
    });
  };

  if (isLoading) return <div className="text-center py-10 animate-pulse font-display text-gray-600 text-xs">Fetching existing keys...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xl font-display text-white italic">{campaign.title} Result Keys</h3>
          <p className="text-[10px] text-gray-500 uppercase font-display tracking-widest mt-1">Set the correct answers for this specific match</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-8 py-3 bg-ipl-gold text-black font-display text-xs uppercase tracking-[0.2em] hover:bg-white transition-all disabled:opacity-30 shadow-[0_0_20px_rgba(244,196,48,0.2)]"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Propagating...' : 'Release Scores'}
        </button>
      </div>

      <div className="grid gap-4">
        {campaign.questions.map((q: any) => (
          <div key={q.id} className="glass-panel p-6 border-l-2 border-white/10 hover:border-ipl-gold transition-all group">
            <div className="flex items-start justify-between gap-8">
              <div className="space-y-2 flex-1">
                <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-display">Question</span>
                <h4 className="text-white font-display text-lg">{q.question_text}</h4>
              </div>
              <div className="w-72 space-y-2">
                <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-display text-right">Correct Answer</span>
                <AnswerInput
                  question={q}
                  value={correctAnswers[q.id]}
                  onChange={(val) => setCorrectAnswers({ ...correctAnswers, [q.id]: val })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnswerInput({ question, value, onChange }: { question: any, value: any, onChange: (val: any) => void }) {
  if (['toggle', 'dropdown'].includes(question.question_type)) {
    return (
      <div className="relative">
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black/60 border border-white/10 py-2 px-3 text-white font-display text-xs appearance-none focus:border-ipl-gold outline-none"
        >
          <option value="">— Select —</option>
          {question.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600 rotate-90 pointer-events-none" />
      </div>
    );
  }

  if (question.question_type === 'multiple_choice') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap justify-end gap-1.5">
        {question.options.map((opt: string) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => {
                const next = on ? selected.filter(s => s !== opt) : [...selected, opt];
                onChange(next);
              }}
              className={`px-2 py-1 text-[9px] font-display uppercase tracking-widest border transition-all ${on ? 'border-ipl-gold text-ipl-gold bg-ipl-gold/10' : 'border-white/10 text-gray-500 hover:border-white/20'
                }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <input
      type={question.question_type === 'free_number' ? 'number' : 'text'}
      value={value ?? ''}
      onChange={(e) => onChange(question.question_type === 'free_number' ? parseFloat(e.target.value) : e.target.value)}
      placeholder="..."
      className="w-full bg-black/60 border border-white/10 py-2 px-3 text-white font-display text-xs text-right focus:border-ipl-gold outline-none"
    />
  );
}

