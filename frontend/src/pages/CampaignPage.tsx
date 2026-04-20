import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Lock, Hash, Type, ToggleLeft, ChevronDown, ListChecks, Info, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCampaign, useSubmitCampaignResponse, type CampaignQuestion, type ScoringRules } from '../api/hooks/useCampaigns';
import { useAuthStore } from '../store/auth';

// ── Scoring hint ──────────────────────────────────────────────────────────────

function ScoringHint({ rules, type }: { rules: ScoringRules; type: CampaignQuestion['question_type'] }) {
  const parts: string[] = [];
  if (rules.exact_match_points !== 0) parts.push(`+${rules.exact_match_points} exact`);
  if (type === 'free_number' && rules.within_range_points !== 0)
    parts.push(`+${rules.within_range_points} within ±5`);
  if (rules.wrong_answer_points !== 0) parts.push(`${rules.wrong_answer_points} wrong`);
  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-display uppercase tracking-widest mt-1.5">
      <Info className="w-3 h-3" />
      {parts.join(' · ')}
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
  const toggle = (opt: string) => {
    const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2 mt-3">
      {(q.options ?? []).map(opt => (
        <button
          key={opt}
          type="button"
          disabled={disabled}
          onClick={() => toggle(opt)}
          className={`text-left px-4 py-3 border-2 font-display text-sm transition-all
            ${selected.includes(opt)
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
  return (
    <div className={`text-sm font-display font-bold ${color}`}>
      {points > 0 ? '+' : ''}{points} pts
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
  const { mutate: submit, isPending } = useSubmitCampaignResponse(id!);

  const [answers, setAnswers] = useState<Record<string, any>>({});

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
  const isClosed = campaign.status === 'closed';
  const isActive = campaign.status === 'active';
  const disabled = isSubmitted || isClosed || !isActive || !!user?.is_guest;

  const getAnswer = (qId: string) => {
    if (isSubmitted && campaign.my_response) {
      return campaign.my_response.answers[qId]?.answer_value;
    }
    return answers[qId];
  };

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
    const missing = payload.filter(a => a.answer_value === null || a.answer_value === '' || (Array.isArray(a.answer_value) && a.answer_value.length === 0));
    if (missing.length > 0) {
      toast.error(`Please answer all ${missing.length} remaining question(s)`);
      return;
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
              <p className="text-white font-display text-sm uppercase tracking-widest">Response submitted</p>
              {isClosed && campaign.my_response?.total_points != null && (
                <p className="text-gray-400 text-xs mt-0.5">
                  Total score: <span className="text-ipl-gold font-bold">{campaign.my_response.total_points} pts</span>
                </p>
              )}
              {!isClosed && (
                <p className="text-gray-500 text-xs mt-0.5">Scoring will be revealed when the campaign closes</p>
              )}
            </div>
          </div>
        )}

        {(campaign.starts_at || campaign.ends_at) && (
          <div className="mt-4 flex items-center gap-2 text-gray-500 text-xs font-display uppercase tracking-widest">
            <Calendar className="w-3.5 h-3.5" />
            {campaign.starts_at && <span>Opens {new Date(campaign.starts_at).toLocaleString()}</span>}
            {campaign.starts_at && campaign.ends_at && <span>·</span>}
            {campaign.ends_at && <span>Closes {new Date(campaign.ends_at).toLocaleString()}</span>}
          </div>
        )}

        {user?.is_guest && isActive && (
          <div className="mt-4 glass-panel border-l-4 border-l-gray-600 p-4">
            <p className="text-gray-400 font-display text-xs uppercase tracking-widest">Guests cannot submit responses</p>
          </div>
        )}
      </header>

      {/* Questions */}
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

        {isActive && !isSubmitted && !user?.is_guest && (
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-4 bg-ipl-gold text-black font-display text-sm uppercase tracking-widest hover:bg-ipl-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Submitting…' : 'Submit Responses'}
          </button>
        )}
      </form>
    </div>
  );
}
