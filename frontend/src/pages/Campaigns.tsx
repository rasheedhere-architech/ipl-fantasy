import { useNavigate } from 'react-router-dom';
import { Megaphone, CheckCircle, Clock, Lock, Calendar, Trophy, Star } from 'lucide-react';
import { useCampaigns, type Campaign } from '../api/hooks/useCampaigns';

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
      className="glass-panel p-6 text-left w-full border-t-2 border-t-white/10 hover:border-t-ipl-gold transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="p-2 bg-ipl-gold/10 rounded-lg group-hover:bg-ipl-gold/20 transition-colors">
          {campaign.type === 'match' ? <Trophy className="w-5 h-5 text-ipl-gold" /> : <Star className="w-5 h-5 text-ipl-gold" />}
        </div>
        <StatusBadge status={campaign.status} />
      </div>
      <span className="text-[10px] font-display uppercase tracking-widest text-gray-500 mb-2 inline-block">
        {campaign.type}
      </span>

      <h3 className="text-white font-display text-lg mb-1 group-hover:text-ipl-gold transition-colors">
        {campaign.title}
      </h3>
      {campaign.description && (
        <p className="text-gray-500 text-xs mb-2 line-clamp-2">{campaign.description}</p>
      )}
      {campaign.ends_at && campaign.status === 'active' && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-600 font-display uppercase tracking-widest mb-3">
          <Calendar className="w-3 h-3" />
          Closes {new Date(campaign.ends_at).toLocaleDateString()}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-600 font-display uppercase tracking-widest">
        <span>{campaign.questions.length} question{campaign.questions.length !== 1 ? 's' : ''}</span>
        {hasResponded ? (
          <span className="flex items-center gap-1.5 text-ipl-gold">
            <CheckCircle className="w-3.5 h-3.5" />
            {isClosed && campaign.my_response?.total_points != null
              ? `${campaign.my_response.total_points} pts`
              : 'Submitted'}
          </span>
        ) : (
          !isClosed && (
            <span className="flex items-center gap-1.5 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Pending
            </span>
          )
        )}
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

  const active = campaigns?.filter(c => c.status === 'active') ?? [];
  const closed = campaigns?.filter(c => c.status === 'closed') ?? [];

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

      {/* Closed */}
      {closed.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3 border-l-4 border-white/20 pl-4">
            <h2 className="text-xl font-display text-gray-400 tracking-widest uppercase">Past Campaigns</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {closed.map(c => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        </section>
      )}
    </div>
  );
}
