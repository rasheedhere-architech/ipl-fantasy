import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Lock, Hash, Type, ToggleLeft, ChevronDown, ListChecks, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign, useSubmitCampaignResponse, useCampaignResponses, type CampaignQuestion, type ScoringRules } from '../api/hooks/useCampaigns';
import { useAuthStore } from '../store/auth';
import { CampaignCountdown } from '../components/CampaignCountdown';

// ── Scoring hint ──────────────────────────────────────────────────────────────

function ScoringHint({ rules, type }: { rules: ScoringRules; type: CampaignQuestion['question_type'] }) {
  const parts: string[] = [];
  const formatPts = (pts: number) => pts > 0 ? `+${pts}` : `${pts}`;

  if (type === 'multiple_choice' && rules.multiple_choice_tiers) {
    const tiers = Object.entries(rules.multiple_choice_tiers)
      .filter(([_, pts]) => pts !== 0)
      .sort((a, b) => parseInt(b[0]) - parseInt(a[0]));

    if (tiers.length > 0) {
      parts.push(tiers.map(([count, pts]) => `${formatPts(pts)} (${count} correct)`).join(' · '));
    }
  } else {
    if (rules.exact_match_points !== 0) parts.push(`${formatPts(rules.exact_match_points)} exact`);
    if (type === 'free_number' && rules.within_range_points !== 0)
      parts.push(`${formatPts(rules.within_range_points)} within ±5`);
  }

  if (rules.wrong_answer_points !== 0) {
    parts.push(`${formatPts(rules.wrong_answer_points)} ${type === 'multiple_choice' ? 'base' : 'wrong'}`);
  }

  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-display uppercase tracking-widest mt-1.5 bg-white/5 py-1 px-2 rounded-sm border border-white/5 w-fit">
      <Info className="w-3 h-3 text-ipl-gold" />
      {parts.join(' | ')}
    </div>
  );
}

// ── Question inputs ───────────────────────────────────────────────────────────

function ToggleInput({ q, value, onChange, disabled }: { q: CampaignQuestion; value: any; onChange: (v: any) => void; disabled: boolean }) {
  const [a, b] = q.options ?? ['Option A', 'Option B'];
  return (
    <div className="flex gap-3 mt-3">
      {[a, b].map(opt => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt)}
          className={`flex-1 py-3 font-display text-sm uppercase tracking-widest border-2 transition-all
            ${value === opt
              ? 'border-ipl-gold bg-ipl-gold/10 text-ipl-gold'
              : 'border-white/10 text-gray-400 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultipleChoiceInput({ q, value, onChange, disabled }: { q: CampaignQuestion; value: any; onChange: (v: any) => void; disabled: boolean }) {
  const selected: string[] = Array.isArray(value) ? value : [];
  const maxSel = q.scoring_rules?.max_selections;

  const toggle = (opt: string) => {
    const isSelected = selected.includes(opt);
    if (!isSelected && maxSel && selected.length >= maxSel) {
      toast.error(`You can only select exactly ${maxSel} options`);
      return;
    }
    const next = isSelected ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2 mt-3">
      {(q.options ?? []).map(opt => {
        const isSelected = selected.includes(opt);
        const isMaxedOut = !isSelected && maxSel && selected.length >= maxSel;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled || !!isMaxedOut}
            onClick={() => toggle(opt)}
            className={`text-left px-4 py-3 border-2 font-display text-sm transition-all
              ${isSelected
                ? 'border-ipl-gold bg-ipl-gold/10 text-ipl-gold'
                : 'border-white/10 text-gray-400 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function DropdownInput({ q, value, onChange, disabled }: { q: CampaignQuestion; value: any; onChange: (v: any) => void; disabled: boolean }) {
  return (
    <div className="relative mt-3">
      <select
        disabled={disabled}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
        className="w-full bg-black/40 border-2 border-white/10 py-3 pl-4 pr-10 text-white font-display text-sm appearance-none focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Select an option…</option>
        {(q.options ?? []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    </div>
  );
}

function FreeTextInput({ value, onChange, disabled }: { value: any; onChange: (v: any) => void; disabled: boolean }) {
  const [err, setErr] = useState('');
  const handle = (v: string) => {
    if (v && !/^[a-zA-Z ]*$/.test(v)) {
      setErr('Only letters and spaces allowed');
      return;
    }
    setErr('');
    onChange(v);
  };
  return (
    <div className="mt-3">
      <input
        type="text"
        disabled={disabled}
        value={value ?? ''}
        onChange={e => handle(e.target.value)}
        placeholder="Type your answer…"
        className="w-full bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {err && <p className="text-ipl-live text-xs mt-1 font-display">{err}</p>}
    </div>
  );
}

function FreeNumberInput({ value, onChange, disabled }: { value: any; onChange: (v: any) => void; disabled: boolean }) {
  return (
    <div className="mt-3">
      <input
        type="number"
        disabled={disabled}
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder="Enter a number…"
        className="w-full bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}

const QUESTION_ICONS: Record<CampaignQuestion['question_type'], React.ReactNode> = {
  toggle: <ToggleLeft className="w-4 h-4" />,
  multiple_choice: <ListChecks className="w-4 h-4" />,
  dropdown: <ChevronDown className="w-4 h-4" />,
  free_text: <Type className="w-4 h-4" />,
  free_number: <Hash className="w-4 h-4" />,
};

// ── Result view (after scoring) ───────────────────────────────────────────────

function ResultBadge({ points, correct }: { points: number | null | undefined; correct: any }) {
  if (points == null) return null;
  const color = points > 0 ? 'text-green-400' : points < 0 ? 'text-ipl-live' : 'text-gray-500';
  const prefix = points > 0 ? '+' : '';
  return (
    <div className={`text-sm font-display font-bold ${color}`}>
      {prefix}{points}
      {correct != null && (
        <span className="text-gray-500 font-normal text-xs ml-2">
          (correct: {Array.isArray(correct) ? correct.join(', ') : String(correct)})
        </span>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: campaign, isLoading, error } = useCampaign(id!);
  const { mutate: submit, isPending: isSubmitting } = useSubmitCampaignResponse(id!);

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'response' | 'predictions'>('response');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'player' | 'question'>('player');

  const isClosedCampaign = campaign?.status === 'closed' || (campaign?.ends_at ? new Date(campaign.ends_at) <= new Date() : false);
  const { data: responses, isLoading: isLoadingResponses } = useCampaignResponses(id!, isClosedCampaign);

  useEffect(() => {
    if (campaign?.my_response) {
      const initial: Record<string, any> = {};
      Object.entries(campaign.my_response.answers).forEach(([qId, ans]) => {
        initial[qId] = ans.answer_value;
      });
      setAnswers(initial);
    }
  }, [campaign]);

  if (isLoading) {
    return (
      <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">
        LOADING CAMPAIGN...
      </div>
    );
  }
  if (error || !campaign) {
    return (
      <div className="text-ipl-live text-center font-display tracking-widest mt-20">
        CAMPAIGN NOT FOUND
      </div>
    );
  }

  const isSubmitted = !!campaign.my_response;
  const isClosed = campaign.status === 'closed' || (campaign.ends_at ? new Date(campaign.ends_at) <= new Date() : false);
  const isActive = campaign.status === 'active' && !isClosed;
  const disabled = isClosed || !!user?.is_guest;

  const getAnswer = (qId: string) => answers[qId];

  const setAnswer = (qId: string, val: any) => {
    if (disabled) return;
    setAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = campaign.questions.map(q => ({
      question_id: q.id,
      answer_value: answers[q.id] ?? null,
    }));

    // Check if anything is entirely unanswered
    const missing = payload.filter(a => a.answer_value === null || a.answer_value === '' || (Array.isArray(a.answer_value) && a.answer_value.length === 0));
    if (missing.length > 0) {
      toast.error(`Please answer all ${missing.length} remaining question(s)`);
      return;
    }

    // Check multiple choice constraints
    for (const q of campaign.questions) {
      if (q.question_type === 'multiple_choice' && q.scoring_rules.max_selections) {
        const userAns = answers[q.id] || [];
        if (userAns.length !== q.scoring_rules.max_selections) {
          toast.error(`"${q.question_text}" requires exactly ${q.scoring_rules.max_selections} selections.`);
          return;
        }
      }
    }

    submit(payload, {
      onSuccess: () => toast.success('Response submitted!'),
      onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Submission failed'),
    });
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      {/* Header */}
      <header>
        <button
          onClick={() => navigate('/campaigns')}
          className="flex items-center gap-2 text-gray-500 hover:text-white font-display text-xs uppercase tracking-widest transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Campaigns
        </button>

        <div className="flex items-start justify-between gap-4 border-b-2 border-white/10 pb-4">
          <div>
            <span className="text-[10px] font-display uppercase tracking-widest text-gray-500 block mb-1">
              {campaign.type} campaign
            </span>
            <h1 className="text-2xl font-display text-white">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-gray-400 text-sm mt-1">{campaign.description}</p>
            )}
          </div>
          {isClosed ? (
            <span className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-widest text-gray-500 pt-1 shrink-0">
              <Lock className="w-3 h-3" />
              Closed
            </span>
          ) : isActive ? (
            <span className="flex items-center gap-1.5 text-[10px] font-display uppercase tracking-widest text-ipl-live pt-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-ipl-live animate-pulse" />
              Active
            </span>
          ) : null}
        </div>

        {isSubmitted && (
          <div className="mt-4 glass-panel border-l-4 border-l-ipl-gold p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-ipl-gold shrink-0" />
            <div>
              <p className="text-white font-display text-sm uppercase tracking-widest">Response {isClosed ? 'submitted' : 'recorded'}</p>
              {isClosed && campaign.my_response?.total_points != null && (
                <p className="text-gray-400 text-xs mt-0.5">
                  Total score: <span className="text-ipl-gold font-bold">{campaign.my_response.total_points} pts</span>
                </p>
              )}
              {!isClosed && isActive && (
                <p className="text-gray-500 text-xs mt-0.5">You can update your answers until the campaign closes</p>
              )}
            </div>
          </div>
        )}

        {(campaign.starts_at || campaign.ends_at) && (
          <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs font-display uppercase tracking-widest flex-wrap">

            {campaign.ends_at && (
              <span className="flex items-center flex-wrap">
                <CampaignCountdown endsAt={campaign.ends_at} />
              </span>
            )}
          </div>
        )}

        {user?.is_guest && isActive && (
          <div className="mt-4 glass-panel border-l-4 border-l-gray-600 p-4">
            <p className="text-gray-400 font-display text-xs uppercase tracking-widest">Guests cannot submit responses</p>
          </div>
        )}

        {isClosed && (
          <div className="flex bg-white/5 p-1 rounded-lg border border-white/10 shrink-0 w-fit mt-6">
            <button
              type="button"
              onClick={() => setActiveTab('response')}
              className={`px-6 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 font-display tracking-widest ${
                activeTab === 'response'
                  ? 'bg-ipl-gold text-black shadow-lg scale-105'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Your Response
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('predictions')}
              className={`px-6 py-2 rounded-md text-[10px] font-bold uppercase transition-all duration-300 font-display tracking-widest ${
                activeTab === 'predictions'
                  ? 'bg-ipl-gold text-black shadow-lg scale-105'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Reveal / Predictions ({responses?.length ?? 0})
            </button>
          </div>
        )}
      </header>

      {/* Content */}
      {activeTab === 'predictions' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-l-4 border-ipl-gold pl-4 py-1 gap-4 flex-wrap">
            <h2 className="text-xl font-display text-white tracking-widest uppercase">Community Predictions</h2>

            <div className="flex bg-white/5 p-1 rounded border border-white/10 shrink-0 text-[10px] font-display uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setViewMode('player')}
                className={`px-3 py-1.5 rounded transition-all ${
                  viewMode === 'player' ? 'bg-white/10 text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                By Player
              </button>
              <button
                type="button"
                onClick={() => setViewMode('question')}
                className={`px-3 py-1.5 rounded transition-all ${
                  viewMode === 'question' ? 'bg-white/10 text-white font-bold' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                By Question
              </button>
            </div>
          </div>

          {isLoadingResponses ? (
            <div className="text-center py-12 text-gray-500 animate-pulse font-display text-sm tracking-widest uppercase">
              Loading predictions...
            </div>
          ) : !responses || responses.length === 0 ? (
            <div className="glass-panel p-8 text-center border-dashed border-2 border-white/5 opacity-50">
              <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">
                No predictions submitted yet
              </p>
            </div>
          ) : viewMode === 'question' ? (
            <div className="space-y-6">
              {campaign.questions.map((q, qIdx) => {
                return (
                  <div key={q.id} className="glass-panel p-6 border-t-2 border-t-white/10 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 text-[10px] font-display uppercase tracking-widest mb-1">
                        {QUESTION_ICONS[q.question_type]}
                        <span>Question {qIdx + 1} · {q.question_type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-white font-display text-base">{q.question_text}</p>

                      {q.correct_answer !== null && q.correct_answer !== undefined && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded text-xs text-green-400 font-display">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Correct Answer: <strong className="font-bold">{String(q.correct_answer)}</strong></span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/5 pt-4 space-y-2">
                      <h4 className="text-[10px] text-gray-500 font-display uppercase tracking-wider mb-2">Player Predictions</h4>
                      <div className="grid gap-2 md:grid-cols-2">
                        {responses.map(resp => {
                          const userAnsObj = resp.answers.find(a => a.question_id === q.id);
                          const userAnsVal = userAnsObj?.answer_value;
                          const ptsAwarded = userAnsObj?.points_awarded;

                          return (
                            <div key={resp.id} className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-6 h-6 rounded-full border border-white/10 overflow-hidden shrink-0">
                                  <img
                                    src={resp.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resp.user_name}`}
                                    alt=""
                                  />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-xs font-display text-gray-300 block truncate leading-tight">
                                    {resp.user_name}
                                  </span>
                                  <span className="text-[11px] text-white font-display font-medium truncate block mt-0.5">
                                    {userAnsVal != null
                                      ? Array.isArray(userAnsVal)
                                        ? userAnsVal.join(', ')
                                        : String(userAnsVal)
                                      : <span className="text-gray-500 italic">No prediction</span>}
                                  </span>
                                </div>
                              </div>

                              <div className="shrink-0 pl-2">
                                <ResultBadge points={ptsAwarded} correct={q.correct_answer} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {responses.map((resp, idx) => {
                const isExpanded = expandedUser === resp.user_id;
                const userRank = idx + 1;
                return (
                  <div
                    key={resp.id}
                    className={`bg-white/5 border border-white/10 overflow-hidden transition-all duration-300 rounded ${
                      isExpanded ? 'border-ipl-gold/50 bg-ipl-gold/5' : 'hover:border-white/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedUser(isExpanded ? null : resp.user_id)}
                      className="w-full text-left p-4 flex items-center justify-between group/row"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-gray-500 w-6 text-center">#{userRank}</span>
                        <div className="w-8 h-8 rounded-full border border-white/10 overflow-hidden">
                          <img
                            src={resp.user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${resp.user_name}`}
                            alt=""
                          />
                        </div>
                        <span className="text-sm font-display text-gray-300 group-hover/row:text-white transition-colors">
                          {resp.user_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-base font-display text-ipl-gold">
                          {resp.total_points != null ? `${resp.total_points} pts` : '--'}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-400 rotate-180 transition-transform" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500 opacity-60 transition-transform" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="space-y-3 mt-3">
                          {campaign.questions.map((q, qIdx) => {
                            const userAnsObj = resp.answers.find(a => a.question_id === q.id);
                            const userAnsVal = userAnsObj?.answer_value;
                            const ptsAwarded = userAnsObj?.points_awarded;

                            return (
                              <div key={q.id} className="bg-white/5 p-3 rounded border border-white/5 space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-gray-500 font-display uppercase tracking-widest">
                                  <span>Question {qIdx + 1}</span>
                                  <ResultBadge points={ptsAwarded} correct={q.correct_answer} />
                                </div>
                                <p className="text-xs text-gray-300 font-display font-medium">
                                  {q.question_text}
                                </p>
                                <div className="text-xs text-white mt-1">
                                  <span className="text-gray-500 font-mono text-[10px] uppercase mr-1">Predicted:</span>
                                  <span className="font-display">
                                    {userAnsVal != null
                                      ? Array.isArray(userAnsVal)
                                        ? userAnsVal.join(', ')
                                        : String(userAnsVal)
                                      : 'No prediction'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {campaign.questions.map((q, idx) => {
            const myAnswer = getAnswer(q.id);
            const myPoints = isSubmitted && campaign.my_response
              ? campaign.my_response.answers[q.id]?.points_awarded
              : undefined;

            return (
              <div key={q.id} className="glass-panel p-6 border-t-2 border-t-white/10">
                <div className="flex items-center gap-2 text-gray-500 text-[10px] font-display uppercase tracking-widest mb-2">
                  {QUESTION_ICONS[q.question_type]}
                  <span>Question {idx + 1} · {q.question_type.replace('_', ' ')}</span>
                </div>

                <p className="text-white font-display text-base">{q.question_text}</p>
                <ScoringHint rules={q.scoring_rules} type={q.question_type} />

                {q.question_type === 'toggle' && (
                  <ToggleInput q={q} value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
                )}
                {q.question_type === 'multiple_choice' && (
                  <MultipleChoiceInput q={q} value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
                )}
                {q.question_type === 'dropdown' && (
                  <DropdownInput q={q} value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
                )}
                {q.question_type === 'free_text' && (
                  <FreeTextInput value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
                )}
                {q.question_type === 'free_number' && (
                  <FreeNumberInput value={myAnswer} onChange={v => setAnswer(q.id, v)} disabled={disabled} />
                )}

                {isClosed && isSubmitted && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <ResultBadge points={myPoints} correct={q.correct_answer} />
                  </div>
                )}
              </div>
            );
          })}

          {isActive && !isClosed && !user?.is_guest && (
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-ipl-gold text-black font-display text-sm uppercase tracking-widest hover:bg-ipl-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,215,0,0.2)] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {isSubmitted ? 'Update Response' : 'Submit Response'}
                </>
              )}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
