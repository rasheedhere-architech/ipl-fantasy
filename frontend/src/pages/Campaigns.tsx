import { useNavigate } from 'react-router-dom';
import { Megaphone, CheckCircle, Lock, Calendar, Trophy, Star, Hash } from 'lucide-react';
import { useCampaigns, type Campaign } from '../api/hooks/useCampaigns';
import { CampaignCountdown } from '../components/CampaignCountdown';

function StatusBadge({ status }: { status: Campaign['status'] }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-widest text-ipl-live">
        <span className="w-1.5 h-1.5 rounded-full bg-ipl-live animate-pulse" />
        Live
      </span>
    );
  }
  if (status === 'closed') {
    return (
      <span className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-widest text-gray-500">
        <Lock className="w-3 h-3" />
        Closed
      </span>
    );
  }
  return null;
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const hasResponded = !!campaign.my_response;
  const isClosed = campaign.status === 'closed';

  return (
    <button
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      className={`glass-panel p-6 text-left w-full border-2 transition-all duration-500 group relative overflow-hidden flex flex-col h-full ${hasResponded && !isClosed
        ? 'border-green-500/30 hover:border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.05)]'
        : 'border-white/5 hover:border-white/20'
        }`}
    >
      {/* Top Section: Icon & Badges */}
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 bg-ipl-gold/10 rounded-lg group-hover:bg-ipl-gold/20 transition-colors">
          {campaign.type === 'match' ? <Trophy className="w-5 h-5 text-ipl-gold" /> : <Star className="w-5 h-5 text-ipl-gold" />}
        </div>

        <div className="flex flex-col items-end gap-2">
          {hasResponded && !isClosed && (
            <span className="bg-green-500 text-white font-display text-[10px] tracking-widest px-3 py-1 flex items-center gap-1.5 shadow-lg -mr-6 -mt-6">
              <CheckCircle className="w-3 h-3" />
              SUBMITTED
            </span>
          )}
          <div className={`${hasResponded && !isClosed ? 'mt-1' : ''}`}>
            <StatusBadge status={campaign.status} />
          </div>
        </div>
      </div>

      {/* Middle Section: Title & Info */}
      <div className="flex-1">
        <span className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2 inline-block">
          {campaign.type}
        </span>

        <h3 className="text-white font-display text-xl mb-1.5 group-hover:text-ipl-gold transition-colors leading-tight">
          {campaign.title}
        </h3>

        {campaign.description && (
          <p className="text-gray-500 text-xs mb-4 line-clamp-2 leading-relaxed">{campaign.description}</p>
        )}
      </div>

      {/* Bottom Section: Meta Data */}
      <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
        {campaign.ends_at && campaign.status === 'active' && (
          <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-display uppercase tracking-widest bg-white/[0.03] px-2.5 py-1.5 rounded border border-white/5">
            <div className="flex items-center">
              <CampaignCountdown endsAt={campaign.ends_at} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-gray-500 font-display uppercase tracking-widest">
          <span className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 opacity-40 text-ipl-gold" />
            {campaign.questions.length} question{campaign.questions.length !== 1 ? 's' : ''}
          </span>
          {hasResponded && isClosed && campaign.my_response?.total_points != null && (
            <span className="text-ipl-gold font-bold">{campaign.my_response.total_points} pts</span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function Campaigns() {
  const { data: campaigns, isLoading, error } = useCampaigns();

  if (isLoading) {
    return (
      <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">
        LOADING CAMPAIGNS...
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-ipl-live text-center font-display tracking-widest mt-20">
        FAILED TO LOAD CAMPAIGNS
      </div>
    );
  }

  const now = new Date().getTime();
  const active = campaigns?.filter(c => {
    if (c.status !== 'active') return false;
    if (c.ends_at && new Date(c.ends_at).getTime() < now) return false;
    return true;
  }) ?? [];

  return (
    <div className="space-y-12 max-w-5xl mx-auto pb-20">
      <header>
        <h1 className="text-3xl font-display text-white border-b-2 border-white/10 pb-4 flex items-center gap-3">
          <Megaphone className="w-7 h-7 text-ipl-gold" />
          CAMPAIGNS
        </h1>
        <p className="text-gray-500 text-xs font-display uppercase tracking-[0.2em] mt-2">
          Predict, answer, earn points
        </p>
      </header>

      {/* Active */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 border-l-4 border-ipl-live pl-4">
          <div className="w-2 h-2 rounded-full bg-ipl-live animate-pulse" />
          <h2 className="text-xl font-display text-white tracking-widest uppercase">Active</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {active.length === 0 ? (
            <div className="glass-panel p-8 text-center border-dashed border-2 border-white/5 opacity-50 col-span-full">
              <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">
                No active campaigns right now
              </p>
            </div>
          ) : (
            active.map(c => <CampaignCard key={c.id} campaign={c} />)
          )}
        </div>
      </section>
    </div>
  );
}
