import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, GripVertical, ChevronDown, Save,
  Play, Lock, FileEdit, BarChart2, Users, Copy, Star, Trophy
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useAdminCampaigns, useAdminCampaign, useCreateCampaign, useUpdateCampaign,
  useDeleteCampaign, useAdminCampaignResponses,
  type CampaignQuestion, type QuestionCreate, type CampaignStatus, type CampaignType, type ScoringRules
} from '../api/hooks/useCampaigns';
import { apiClient } from '../api/client';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';

// ── Helpers ───────────────────────────────────────────────────────────────────

const needsOptions = (t: CampaignQuestion['question_type']) =>
  ['toggle', 'multiple_choice', 'dropdown'].includes(t);

function emptyQuestion(order: number): QuestionCreate {
  return {
    question_text: '',
    question_type: 'toggle',
    options: ['', ''],
    correct_answer: null,
    scoring_rules: { exact_match_points: 10, wrong_answer_points: -5, within_range_points: 5 },
    order_index: order,
    is_mandatory: false,
  };
}

const QUESTION_TYPES: { value: CampaignQuestion['question_type']; label: string }[] = [
  { value: 'toggle', label: 'Toggle Switch (2 options)' },
  { value: 'multiple_choice', label: 'Multiple Choice (select many)' },
  { value: 'dropdown', label: 'Dropdown (select one)' },
  { value: 'free_text', label: 'Free Text (letters only)' },
  { value: 'free_number', label: 'Number Input' },
];

// ── Question editor ───────────────────────────────────────────────────────────

function QuestionEditor({
  q, idx, onChange, onRemove, locked = false,
}: {
  q: QuestionCreate; idx: number;
  onChange: (q: QuestionCreate) => void; onRemove: () => void;
  locked?: boolean;
}) {
  const has_options = needsOptions(q.question_type);

  const setType = (type: QuestionCreate['question_type']) => {
    const defaultOptions =
      type === 'toggle' ? ['', ''] :
      type === 'multiple_choice' ? ['', '', ''] :
      type === 'dropdown' ? ['', ''] : null;
    onChange({ ...q, question_type: type, options: defaultOptions, correct_answer: null });
  };

  const setOption = (i: number, val: string) => {
    const opts = [...(q.options ?? [])]; opts[i] = val;
    onChange({ ...q, options: opts });
  };

  const addOption = () => onChange({ ...q, options: [...(q.options ?? []), ''] });
  const removeOption = (i: number) =>
    onChange({ ...q, options: (q.options ?? []).filter((_, j) => j !== i) });

  const setScoring = (field: keyof ScoringRules, val: string) =>
    onChange({ ...q, scoring_rules: { ...q.scoring_rules, [field]: parseInt(val) || 0 } });

  const setCorrect = (val: any) => onChange({ ...q, correct_answer: val });

  return (
    <div className={`glass-panel p-5 space-y-4 ${locked ? 'border-t-2 border-t-ipl-gold/60 bg-ipl-gold/[0.03]' : 'border-t-2 border-t-white/10'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-gray-500">
          <GripVertical className="w-4 h-4" />
          <span className="font-display text-xs uppercase tracking-widest">Q{idx + 1}</span>
          {locked && (
            <span className="flex items-center gap-1 text-ipl-gold text-[10px] font-display uppercase tracking-widest border border-ipl-gold/40 px-1.5 py-0.5 ml-1">
              <Lock className="w-2.5 h-2.5" />
              Mandatory
            </span>
          )}
        </div>
        {!locked && (
          <button type="button" onClick={onRemove} className="text-gray-600 hover:text-ipl-live transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
      <input
        type="text"
        value={q.question_text}
        onChange={e => onChange({ ...q, question_text: e.target.value })}
        placeholder="Question text…"
        className="w-full bg-black/40 border-2 border-white/10 py-2.5 px-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all disabled:cursor-not-allowed"
      />

      <div className="relative">
        <select
          value={q.question_type}
          onChange={e => setType(e.target.value as QuestionCreate['question_type'])}
          className="w-full bg-black/40 border-2 border-white/10 py-2.5 pl-4 pr-10 text-white font-display text-sm appearance-none focus:outline-none focus:border-ipl-gold transition-all"
        >
          {QUESTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {has_options && (
        <div className="space-y-2">
          <p className="text-gray-500 text-[10px] font-display uppercase tracking-widest">Options</p>
          {(q.options ?? []).map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={opt}
                onChange={e => setOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="flex-1 bg-black/40 border-2 border-white/10 py-2 px-3 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-white/30 transition-all"
              />
              {q.question_type !== 'toggle' && (q.options ?? []).length > 2 && (
                <button type="button" onClick={() => removeOption(i)}
                  className="text-gray-600 hover:text-ipl-live transition-colors px-2">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          {q.question_type !== 'toggle' && (
            <button type="button" onClick={addOption}
              className="text-gray-500 hover:text-white font-display text-xs uppercase tracking-widest flex items-center gap-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Add option
            </button>
          )}
        </div>
      )}

      {/* Correct answer */}
      <div className="space-y-1.5">
        <p className="text-gray-500 text-[10px] font-display uppercase tracking-widest">Correct Answer</p>
        {(q.question_type === 'toggle' || q.question_type === 'dropdown') && (
          <div className="relative">
            <select value={q.correct_answer ?? ''} onChange={e => setCorrect(e.target.value || null)}
              className="w-full bg-black/40 border-2 border-white/10 py-2.5 pl-4 pr-10 text-white font-display text-sm appearance-none focus:outline-none focus:border-ipl-gold transition-all">
              <option value="">— Not set —</option>
              {(q.options ?? []).filter(Boolean).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        )}
        {q.question_type === 'multiple_choice' && (
          <div className="flex flex-wrap gap-2">
            {(q.options ?? []).filter(Boolean).map(opt => {
              const selected: string[] = Array.isArray(q.correct_answer) ? q.correct_answer : [];
              const on = selected.includes(opt);
              return (
                <button key={opt} type="button"
                  onClick={() => { const next = on ? selected.filter(s => s !== opt) : [...selected, opt]; setCorrect(next.length ? next : null); }}
                  className={`px-3 py-1.5 border font-display text-xs transition-all ${on ? 'border-ipl-gold text-ipl-gold bg-ipl-gold/10' : 'border-white/10 text-gray-500 hover:border-white/30'}`}>
                  {opt}
                </button>
              );
            })}
          </div>
        )}
        {q.question_type === 'free_text' && (
          <input type="text" value={q.correct_answer ?? ''} onChange={e => setCorrect(e.target.value || null)}
            placeholder="Exact answer (letters + spaces)…"
            className="w-full bg-black/40 border-2 border-white/10 py-2.5 px-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all" />
        )}
        {q.question_type === 'free_number' && (
          <input type="number" value={q.correct_answer ?? ''} onChange={e => setCorrect(e.target.value === '' ? null : parseFloat(e.target.value))}
            placeholder="Correct number…"
            className="w-full bg-black/40 border-2 border-white/10 py-2.5 px-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all" />
        )}
      </div>

      {/* Scoring */}
      <div className="space-y-2">
        <p className="text-gray-500 text-[10px] font-display uppercase tracking-widest">Scoring</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-gray-600 text-[10px] font-display uppercase tracking-widest block mb-1">Exact match pts</label>
            <input type="number" value={q.scoring_rules.exact_match_points} onChange={e => setScoring('exact_match_points', e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 py-2 px-3 text-white font-display text-sm focus:outline-none focus:border-ipl-gold transition-all" />
          </div>
          <div>
            <label className="text-gray-600 text-[10px] font-display uppercase tracking-widest block mb-1">Wrong answer pts</label>
            <input type="number" value={q.scoring_rules.wrong_answer_points} onChange={e => setScoring('wrong_answer_points', e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 py-2 px-3 text-white font-display text-sm focus:outline-none focus:border-ipl-gold transition-all" />
          </div>
          {q.question_type === 'free_number' && (
            <div>
              <label className="text-gray-600 text-[10px] font-display uppercase tracking-widest block mb-1">Within ±5 pts</label>
              <input type="number" value={q.scoring_rules.within_range_points} onChange={e => setScoring('within_range_points', e.target.value)}
                className="w-full bg-black/40 border-2 border-white/10 py-2 px-3 text-white font-display text-sm focus:outline-none focus:border-ipl-gold transition-all" />
            </div>
          )}
        </div>
      </div>
      </fieldset>
    </div>
  );
}

// ── Campaign form ─────────────────────────────────────────────────────────────

export function CampaignForm({ campaignId }: { campaignId?: string }) {
  const navigate = useNavigate();
  const isEdit = !!campaignId;
  const { data: existing, isLoading } = useAdminCampaign(campaignId ?? '');
  const { mutate: create, isPending: isCreating } = useCreateCampaign();
  const { mutate: update, isPending: isUpdating } = useUpdateCampaign(campaignId ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CampaignType>('general');
  const [isMaster, setIsMaster] = useState(false);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [penalty, setPenalty] = useState(0);
  const [questions, setQuestions] = useState<QuestionCreate[]>([emptyQuestion(0)]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description ?? '');
      setType(existing.type);
      setIsMaster(existing.is_master);
      setStartsAt(existing.starts_at ? existing.starts_at.slice(0, 16) : '');
      setEndsAt(existing.ends_at ? existing.ends_at.slice(0, 16) : '');
      setPenalty(existing.non_participation_penalty ?? 0);
      setQuestions(existing.questions.map(q => ({
        id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        correct_answer: q.correct_answer,
        scoring_rules: q.scoring_rules,
        order_index: q.order_index,
        is_mandatory: q.is_mandatory,
      })));
    }
  }, [existing]);

  if (isEdit && isLoading) {
    return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING...</div>;
  }

  const addQuestion = () => setQuestions(qs => [...qs, emptyQuestion(qs.length)]);
  const updateQuestion = (i: number, q: QuestionCreate) => setQuestions(qs => qs.map((x, j) => j === i ? q : x));
  const removeQuestion = (i: number) => setQuestions(qs => qs.filter((_, j) => j !== i));

  const handleSave = () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (questions.length === 0) { toast.error('Add at least one question'); return; }
    if (questions.some(q => !q.question_text.trim())) { toast.error('All questions need text'); return; }
    for (const q of questions) {
      if (needsOptions(q.question_type)) {
        const filled = (q.options ?? []).filter(Boolean);
        if (filled.length < 2) { toast.error(`Fill in all options for "${q.question_text || 'a question'}"`); return; }
      }
    }
    const orderedQs = questions.map((q, i) => ({ ...q, order_index: i }));
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      type,
      is_master: type === 'match' ? isMaster : false,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      non_participation_penalty: penalty,
      questions: orderedQs,
    };

    if (isEdit) {
      update(payload, {
        onSuccess: () => { toast.success('Campaign updated'); navigate('/admin/campaigns'); },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Update failed'),
      });
    } else {
      create(payload, {
        onSuccess: () => { toast.success('Campaign created'); navigate('/admin/campaigns'); },
        onError: (err: any) => toast.error(err?.response?.data?.detail ?? 'Create failed'),
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 space-y-8">
      <header>
        <button onClick={() => navigate('/admin/campaigns')}
          className="flex items-center gap-2 text-gray-500 hover:text-white font-display text-xs uppercase tracking-widest transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-display text-white border-b-2 border-white/10 pb-4">
          {isEdit ? 'Edit Campaign' : 'New Campaign'}
        </h1>
      </header>

      <div className="glass-panel p-6 space-y-4 border-t-2 border-t-ipl-gold">
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Campaign title…"
          className="w-full bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-lg placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all" />
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)…" rows={2}
          className="w-full bg-black/40 border-2 border-white/10 py-3 px-4 text-white font-display text-sm placeholder:text-gray-600 focus:outline-none focus:border-ipl-gold transition-all resize-none" />

        <div>
          <label className="text-gray-500 text-[10px] font-display uppercase tracking-widest block mb-1.5">Campaign Type</label>
          <div className="grid grid-cols-2 gap-2">
            {(['match', 'general'] as CampaignType[]).map(t => (
              <button key={t} type="button"
                onClick={() => { setType(t); if (t !== 'match') setIsMaster(false); }}
                className={`py-2.5 px-4 border-2 font-display text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${type === t ? 'border-ipl-gold text-ipl-gold bg-ipl-gold/10' : 'border-white/10 text-gray-500 hover:border-white/30'}`}>
                {t === 'match' ? <Trophy className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
                {t}
              </button>
            ))}
          </div>
        </div>

        {type === 'match' && (
          <label className="flex items-start gap-3 cursor-pointer group">
            <input type="checkbox" checked={isMaster} onChange={e => setIsMaster(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-ipl-gold cursor-pointer" />
            <span>
              <span className="text-white font-display text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-ipl-gold" />
                Master template
              </span>
              <span className="block text-gray-500 text-[10px] font-display mt-0.5">Questions become mandatory in every clone. Master campaigns can't be activated — clone them per match.</span>
            </span>
          </label>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-500 text-[10px] font-display uppercase tracking-widest block mb-1.5">Starts at (optional)</label>
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 py-2.5 px-4 text-white font-display text-sm focus:outline-none focus:border-ipl-gold transition-all [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-gray-500 text-[10px] font-display uppercase tracking-widest block mb-1.5">Ends at (optional)</label>
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 py-2.5 px-4 text-white font-display text-sm focus:outline-none focus:border-ipl-gold transition-all [color-scheme:dark]" />
          </div>
        </div>
        <div>
          <label className="text-gray-500 text-[10px] font-display uppercase tracking-widest block mb-1.5">Non-participation penalty (pts)</label>
          <input type="number" value={penalty} onChange={e => setPenalty(parseInt(e.target.value) || 0)}
            placeholder="0"
            className="w-full bg-black/40 border-2 border-white/10 py-2.5 px-4 text-white font-display text-sm focus:outline-none focus:border-ipl-gold transition-all" />
          <p className="text-gray-600 text-[10px] font-display mt-1">Applied to users who don't respond when scoring is triggered. Use a negative number for a penalty.</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-gray-400 font-display text-xs uppercase tracking-widest">Questions ({questions.length})</p>
          <button type="button" onClick={addQuestion}
            className="flex items-center gap-1.5 text-ipl-gold hover:text-ipl-gold/80 font-display text-xs uppercase tracking-widest transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add question
          </button>
        </div>
        {questions.map((q, i) => (
          <QuestionEditor key={q.id ?? i} q={q} idx={i} onChange={v => updateQuestion(i, v)} onRemove={() => removeQuestion(i)}
            locked={!!q.is_mandatory && !isMaster} />
        ))}
      </section>

      <button type="button" onClick={handleSave} disabled={isCreating || isUpdating}
        className="w-full py-4 bg-ipl-gold text-black font-display text-sm uppercase tracking-widest hover:bg-ipl-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        {isCreating || isUpdating ? 'Saving…' : 'Save Campaign'}
      </button>
    </div>
  );
}

// ── Responses panel ───────────────────────────────────────────────────────────

function ResponsesPanel({ campaignId }: { campaignId: string }) {
  const { data: responses, isLoading } = useAdminCampaignResponses(campaignId);
  if (isLoading) return <div className="px-5 pb-5 text-gray-500 font-display text-xs animate-pulse">Loading responses...</div>;
  if (!responses?.length) return <div className="px-5 pb-5 text-gray-500 font-display text-xs uppercase tracking-widest">No responses yet</div>;
  return (
    <div className="border-t border-white/5 px-5 pb-5">
      <p className="text-gray-500 font-display text-[10px] uppercase tracking-widest py-3">
        {responses.length} response{responses.length !== 1 ? 's' : ''}
      </p>
      <div className="space-y-1">
        {responses.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between py-2 border-b border-white/5 text-xs font-display">
            <span className="text-gray-400">{r.user_id.slice(0, 8)}…</span>
            <span className={`font-bold ${r.total_points == null ? 'text-gray-500' : r.total_points >= 0 ? 'text-ipl-gold' : 'text-ipl-live'}`}>
              {r.total_points == null ? 'Not scored' : `${r.total_points} pts`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Campaign list ─────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<CampaignStatus, string> = {
  draft: 'text-gray-500 border-gray-600',
  active: 'text-ipl-live border-ipl-live',
  closed: 'text-gray-500 border-gray-600',
};

export function AdminCampaignList() {
  const navigate = useNavigate();
  const { data: campaigns, isLoading, refetch } = useAdminCampaigns();
  const { mutate: deleteCampaign } = useDeleteCampaign();
  const [expandedResponses, setExpandedResponses] = useState<string | null>(null);

  const changeStatus = async (id: string, status: CampaignStatus) => {
    try {
      await apiClient.put(`/campaigns/${id}/status`, { status });
      toast.success(`Campaign set to ${status}`);
      refetch();
    } catch {
      toast.error('Status update failed');
    }
  };

  const triggerScore = async (id: string) => {
    try {
      await apiClient.post(`/campaigns/${id}/score`);
      toast.success('Scoring triggered');
    } catch {
      toast.error('Scoring failed');
    }
  };

  const cloneCampaign = async (id: string) => {
    try {
      await apiClient.post(`/campaigns/${id}/clone`);
      toast.success('Campaign cloned as draft');
      refetch();
    } catch {
      toast.error('Clone failed');
    }
  };

  if (isLoading) return <div className="text-white text-center font-display tracking-widest animate-pulse mt-20">LOADING...</div>;

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-8">
      <header className="flex items-end justify-between border-b-2 border-white/10 pb-4">
        <div>
          <h2 className="text-2xl font-display text-white">Campaign Builder</h2>
          <p className="text-gray-400 mt-1 uppercase text-xs tracking-[0.2em]">Manage campaigns</p>
        </div>
        <button onClick={() => navigate('/admin/campaigns/new')}
          className="flex items-center gap-2 px-5 py-2.5 bg-ipl-gold text-black font-display text-xs uppercase tracking-widest hover:bg-ipl-gold/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Campaign
        </button>
      </header>

      {(!campaigns || campaigns.length === 0) && (
        <div className="glass-panel p-12 text-center border-dashed border-2 border-white/5 opacity-50">
          <p className="text-gray-500 font-display text-xs uppercase tracking-[0.2em]">No campaigns yet. Create one.</p>
        </div>
      )}

      <div className="space-y-4">
        {campaigns?.map(c => (
          <div key={c.id} className="glass-panel border-t-2 border-t-white/10">
            <div className="p-5 flex items-center gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-display uppercase tracking-widest border px-2 py-0.5 ${STATUS_COLOR[c.status]}`}>
                    {c.status}
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] font-display uppercase tracking-widest border px-2 py-0.5 ${c.type === 'match' ? 'text-ipl-live border-ipl-live/40' : 'text-gray-400 border-white/10'}`}>
                    {c.type === 'match' ? <Trophy className="w-2.5 h-2.5" /> : <Star className="w-2.5 h-2.5" />}
                    {c.type}
                  </span>
                  {c.is_master && (
                    <span className="flex items-center gap-1 text-[10px] font-display uppercase tracking-widest border px-2 py-0.5 text-ipl-gold border-ipl-gold/40">
                      <Star className="w-2.5 h-2.5" />
                      Master
                    </span>
                  )}
                  <h3 className="text-white font-display truncate">{c.title}</h3>
                </div>
                {c.description && <p className="text-gray-500 text-xs truncate">{c.description}</p>}
                <p className="text-gray-600 text-[10px] font-display uppercase tracking-widest mt-1">
                  {c.questions.length} question{c.questions.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => navigate(`/admin/campaigns/${c.id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-gray-400 hover:border-white/30 hover:text-white font-display text-[10px] uppercase tracking-widest transition-all">
                  <FileEdit className="w-3.5 h-3.5" />
                  Edit
                </button>

                <button onClick={() => cloneCampaign(c.id)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-gray-400 hover:border-white/30 hover:text-white font-display text-[10px] uppercase tracking-widest transition-all"
                  title="Clone questions as a new draft campaign (e.g. reuse for next match)">
                  <Copy className="w-3.5 h-3.5" />
                  Clone
                </button>

                {c.status === 'draft' && !c.is_master && (
                  <button onClick={() => changeStatus(c.id, 'active')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-ipl-live/40 text-ipl-live hover:border-ipl-live font-display text-[10px] uppercase tracking-widest transition-all">
                    <Play className="w-3.5 h-3.5" />
                    Activate
                  </button>
                )}
                {c.status === 'active' && (
                  <button onClick={() => changeStatus(c.id, 'closed')}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-600 text-gray-400 hover:border-gray-400 font-display text-[10px] uppercase tracking-widest transition-all">
                    <Lock className="w-3.5 h-3.5" />
                    Close
                  </button>
                )}
                {c.status === 'closed' && (
                  <button onClick={() => triggerScore(c.id)}
                    className="flex items-center gap-1.5 px-3 py-2 border border-ipl-gold/40 text-ipl-gold hover:border-ipl-gold font-display text-[10px] uppercase tracking-widest transition-all">
                    <BarChart2 className="w-3.5 h-3.5" />
                    Score
                  </button>
                )}

                <button
                  onClick={() => setExpandedResponses(expandedResponses === c.id ? null : c.id)}
                  className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-gray-400 hover:border-white/30 hover:text-white font-display text-[10px] uppercase tracking-widest transition-all">
                  <Users className="w-3.5 h-3.5" />
                  Responses
                </button>

                <button
                  onClick={() => {
                    if (!confirm('Delete this campaign? This cannot be undone.')) return;
                    deleteCampaign(c.id, {
                      onSuccess: () => toast.success('Campaign deleted'),
                      onError: () => toast.error('Delete failed'),
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 border border-white/10 text-gray-600 hover:border-ipl-live hover:text-ipl-live font-display text-[10px] uppercase tracking-widest transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {expandedResponses === c.id && <ResponsesPanel campaignId={c.id} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Route-level entry (admin guard) ───────────────────────────────────────────

export default function CampaignBuilderRoute() {
  const { user } = useAuthStore();
  if (!user?.is_admin) return <Navigate to="/matchcenter" replace />;
  return <AdminCampaignList />;
}

export function CampaignBuilderNewRoute() {
  const { user } = useAuthStore();
  if (!user?.is_admin) return <Navigate to="/matchcenter" replace />;
  return <CampaignForm />;
}

export function CampaignBuilderEditRoute() {
  const { user } = useAuthStore();
  const { id } = useParams<{ id: string }>();
  if (!user?.is_admin) return <Navigate to="/matchcenter" replace />;
  return <CampaignForm campaignId={id} />;
}
