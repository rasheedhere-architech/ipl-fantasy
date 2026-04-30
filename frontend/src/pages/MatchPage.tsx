import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useMatch, useSubmitPrediction, useMyPredictions, useAllMatchPredictions } from '../api/hooks/useMatches';
import { useUpdateMatchResults, useTriggerAIPredictions } from '../api/hooks/useAdmin';
import { Trophy, Target, CheckCircle2, Edit2, Check, X, Sparkles, Settings, AlertTriangle, ShieldAlert, Bot, MapPin } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';
import { getTeamColor, getTeamShortName } from '../utils/teamColors';

export default function MatchPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hasAutoPredicted, setHasAutoPredicted] = useState(false);
  const [showAutoPredictConfirm, setShowAutoPredictConfirm] = useState(false);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();

  const { data, isLoading, error } = useMatch(id || '');
  const { mutate: submitPrediction, isPending } = useSubmitPrediction(id || '');
  const { data: myPredictions } = useMyPredictions(id || '');

  // Admin Scoring Processor State
  const { mutate: updateResults, isPending: isUpdatingResults } = useUpdateMatchResults();
  const { mutate: triggerAI, isPending: isTriggerAIPending } = useTriggerAIPredictions();
  // Admin Results State: Map of {question_id: answer_value}
  const [adminResults, setAdminResults] = useState<Record<string, any>>({});

  // Predictions are currently always open (start-lock disabled)
  const tossTime = data?.match?.tossTime ? new Date(data.match.tossTime) : null;
  const isLocked = tossTime ? (new Date() > new Date(tossTime.getTime() - 30 * 60000)) : false;

  const { data: leagueSections } = useAllMatchPredictions(id || '');

  const match = data?.match;
  const questions = data?.questions || [];

  // Pre-fill existing predictions and admin results
  useEffect(() => {
    if (myPredictions && Object.keys(myPredictions).length > 0 && questions.length > 0) {
      // Build the form values: use_powerup stays top-level, everything else goes into extra_answers
      const formValues: Record<string, any> = {
        use_powerup: myPredictions.use_powerup || 'No',
        extra_answers: {}
      };

      Object.entries(myPredictions).forEach(([key, val]) => {
        if (key === 'use_powerup' || key === 'is_auto_predicted') return;

        // Answers are now keyed by question_id (UUID or league prefix)
        // No more system_key mapping needed here.
        formValues.extra_answers[key] = val;
      });

      reset(formValues);
      setHasAutoPredicted(!!myPredictions.is_auto_predicted);
    }
  }, [myPredictions, questions, reset]);


  useEffect(() => {
    if (data?.match?.results) {
      setAdminResults(data.match.results);
    }
  }, [data]);


  const winnerQId = useMemo(() => {
    if (!match) return null;
    const teamSet = new Set([match.team1, match.team2]);
    return questions.find((q: any) =>
      q.options && q.options.length === 2 && q.options.every((opt: string) => teamSet.has(opt))
    )?.key || null;
  }, [questions, match]);

  const getSortedPredictions = (predictions: any[]) => {
    if (!predictions || !match) return [];
    return [...predictions].sort((a, b) => {
      if (match.status === 'completed') {
        const pointsA = a.points_awarded ?? -999;
        const pointsB = b.points_awarded ?? -999;
        if (pointsA !== pointsB) return pointsB - pointsA;
      }

      const getScore = (p: any) => {
        const w = winnerQId ? p.answers?.[winnerQId] : null;
        if (w === match.team1) return 1;
        if (w === match.team2) return 2;
        return 3;
      };
      const scoreDiff = getScore(a) - getScore(b);
      if (scoreDiff !== 0) return scoreDiff;

      return (a.user?.name || '').localeCompare(b.user?.name || '');
    });
  };

  const powerupsUsed = data?.powerups_used || 0;
  const totalPowerups = data?.total_powerups ?? 10;
  const powerupsLeft = totalPowerups - powerupsUsed;
  const hasPredicted = myPredictions && Object.keys(myPredictions).length > 0;

  const matchNumber = match?.id?.split('-')?.pop() || '0';


  const groupedQuestions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    questions.forEach((q: any) => {
      const source = q.source_name || 'IPL Global';
      if (!groups[source]) groups[source] = [];
      groups[source].push(q);
    });
    return groups;
  }, [questions]);

  const questionMap = useMemo(() => {
    const map: Record<string, any> = {};
    questions.forEach((q: any) => {
      map[q.key] = q;
    });
    return map;
  }, [questions]);

  if (isLoading) return <div className="text-white text-center font-display tracking-widest mt-20 animate-pulse">LOADING MATCH...</div>;
  if (error || !data || !match) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCH</div>;

  const renderQuestion = (q: any) => {
    // All prediction answers go through extra_answers keyed by q.key (question_id or league key)
    // Only use_powerup stays as a top-level field
    const registerName = `extra_answers.${q.key}`;
    const error = (errors.extra_answers as any)?.[q.key];

    if (q.key === 'use_powerup') return null;

    const options = q.options || [];
    const isBinary = options.length === 2 && (q.answer_type === 'dropdown' || q.answer_type === 'multiple_choice' || (q.answer_type === 'text' && q.options));

    if (isBinary) {
      const isMatchWinner = q.key === winnerQId;
      return (
        <div key={q.key} className={`space-y-4 ${isMatchWinner ? 'col-span-full' : ''}`}>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
              {q.question_text}
              {error && <span className="ml-2 text-red-500 text-[10px] animate-pulse">(! Required)</span>}
            </label>
            {q.source_name && q.source_name !== 'IPL Global' && (
              <span className="text-[8px] bg-ipl-gold/10 text-ipl-gold px-1.5 py-0.5 rounded border border-ipl-gold/20 font-bold uppercase tracking-tighter">
                {q.source_name} League
              </span>
            )}
          </div>
          <div className={`grid grid-cols-2 gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
            {options.map((opt: string) => (
              <label key={opt} className="cursor-pointer">
                <input type="radio" value={opt} {...register(registerName, { required: true })} className="peer sr-only" disabled={isLocked} />
                <div
                  className={`team-select-button p-4 border-2 text-center font-display transition-all peer-checked:text-white ${isMatchWinner ? 'text-xl' : 'text-sm'}`}
                  style={{
                    '--team-color': getTeamColor(opt),
                    borderColor: error ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                    color: error ? 'rgba(239, 68, 68, 0.5)' : 'rgba(156, 163, 175, 1)'
                  } as any}
                >
                  {opt}
                </div>
              </label>
            ))}
          </div>
          <style>{`
            .team-select-button { transition: all 0.3s ease; }
            input:checked + .team-select-button {
              background-color: var(--team-color) !important;
              border-color: var(--team-color) !important;
              box-shadow: 0 0 20px var(--team-color) !important;
            }
          `}</style>
        </div>
      );
    }

    const isFullWidth = q.answer_type === 'free_text' || q.answer_type === 'player_name' || q.answer_type === 'text' || q.answer_type === 'free_text';

    return (
      <div key={q.key} className={`space-y-2 ${isFullWidth ? 'col-span-full' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
            {q.question_text}
            {error && <span className="ml-2 text-red-500 text-[10px] animate-pulse">(! Required)</span>}
          </label>
          {q.source_name && q.source_name !== 'IPL Global' && (
            <span className="text-[8px] bg-ipl-gold/10 text-ipl-gold px-1.5 py-0.5 rounded border border-ipl-gold/20 font-bold uppercase tracking-tighter">
              {q.source_name} League
            </span>
          )}
        </div>

        {q.answer_type === 'dropdown' || (q.answer_type === 'text' && q.options) ? (
          <select
            {...register(registerName, { required: true })}
            disabled={isLocked}
            className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all appearance-none disabled:opacity-50 ${error ? 'border-red-500/50' : 'border-white/20'}`}
          >
            <option value="">Select Option</option>
            {q.options?.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : q.answer_type === 'multiple_choice' ? (
          <div className={`grid grid-cols-2 gap-3 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
            {q.options?.map((opt: string) => (
              <label key={opt} className="cursor-pointer">
                <input type="radio" value={opt} {...register(registerName, { required: true })} className="peer sr-only" disabled={isLocked} />
                <div className={`p-3 border-2 text-center font-display text-xs transition-all peer-checked:bg-ipl-gold peer-checked:text-black peer-checked:border-ipl-gold border-white/20 text-gray-400`}>
                  {opt}
                </div>
              </label>
            ))}
          </div>
        ) : (
          <input
            {...register(registerName, { required: true, valueAsNumber: q.answer_type === 'number' || q.answer_type === 'free_number' })}
            type={q.answer_type === 'number' || q.answer_type === 'free_number' ? 'number' : 'text'}
            disabled={isLocked}
            placeholder={q.answer_type === 'number' || q.answer_type === 'free_number' ? '0' : 'Type your answer'}
            className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 ${error ? 'border-red-500/50' : 'border-white/20'}`}
          />
        )}
      </div>
    );
  };


  const onSubmit = (formData: any) => {
    if (isLocked) return;
    submitPrediction(formData, {
      onSuccess: () => {
        toast.success('Prediction Locked!');
      },
      onError: (err: any) => {
        if (err.response?.data?.detail === 'powerup_limit_reached') {
          toast.error(`Boost Limit Reached! Max ${totalPowerups} allowed.`);
        } else {
          toast.error('Submission failed. Try again.');
        }
      }
    });
  };

  const handleAdminUpdate = async (predId: string) => {
    try {
      await apiClient.put(`/admin/predictions/${predId}`,
        { player_of_the_match: editValue }
      );
      setEditingId(null);
      toast.success('Prediction updated successfully');
      window.location.reload(); // Refresh to show new data
    } catch (err) {
      toast.error('Failed to update prediction');
    }
  };

  const handleAutoPredict = async () => {
    if (isLocked || hasPredicted || hasAutoPredicted) return;

    setHasAutoPredicted(true);

    try {
      const { data: predictedData } = await apiClient.post(`/matches/${id || match.id}/autopredict`);

      Object.entries(predictedData).forEach(([qId, val]) => {
        if (qId === 'use_powerup') {
          setValue('use_powerup', val, { shouldValidate: true, shouldDirty: true });
          return;
        }
        // Auto-predict response now uses question IDs directly
        setValue(`extra_answers.${qId}`, val, { shouldValidate: true, shouldDirty: true });
      });


      // Invalidate so hasPredicted flips to true from server
      queryClient.invalidateQueries({ queryKey: ['predictions', 'mine', id || match.id] });

      toast.success('AI has locked in your prediction!');
    } catch (err: any) {
      if (err.response?.data?.detail === 'Prediction already exists for this match') {
        toast.error('You already have a prediction for this match.');
      } else {
        toast.error('Failed to auto predict.');
      }
      setHasAutoPredicted(false);
    }
  };

  const handleAdminResultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    updateResults({
      matchId: id,
      answers: adminResults
    }, {
      onSuccess: () => {
        toast.success('Match results submitted and scoring triggered!');
        queryClient.invalidateQueries({ queryKey: ['matches', id] });
      },
      onError: () => {
        toast.error('Failed to update match results. Please try again.');
      }
    });
  };


  return (
    <div className="space-y-8 max-w-[1600px] mx-auto w-full px-2 md:px-6 pb-20">
      <div className="glass-panel p-8 text-center border-b-[4px] border-ipl-gold relative overflow-hidden">
        <div className={`absolute top-0 right-0 ${isLocked ? 'bg-ipl-live' : 'bg-ipl-gold'} text-ipl-navy font-display text-xs tracking-widest px-3 py-1 font-bold`}>
          {isLocked ? 'PREDICTIONS CLOSED' : 'PREDICTIONS OPEN'}
        </div>
        <div className="absolute top-0 left-0 bg-white/10 text-white font-display text-[10px] tracking-widest px-3 py-1 uppercase">
          Powerups Remaining: {powerupsLeft}/{totalPowerups}
        </div>
        <p className="text-gray-400 mt-6 font-display uppercase tracking-[0.3em] font-bold text-xs ring-offset-2">
          Match {matchNumber}
        </p>
        <h1 className="text-3xl md:text-5xl text-white font-display mt-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-0">
          <span className="leading-tight" style={{ color: getTeamColor(match.team1) }}>{match.team1}</span>
          <span className="text-gray-600 mx-4 text-xl md:text-3xl">VS</span>
          <span className="leading-tight" style={{ color: getTeamColor(match.team2) }}>{match.team2}</span>
        </h1>
        <p className="text-gray-400 mt-8 font-display uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 opacity-60">
          <MapPin className="w-3.5 h-3.5 text-ipl-gold" />
          {match.venue}
        </p>
      </div>

      {match.status === 'completed' && (
        <div className="glass-panel p-8 border-t-4 border-t-ipl-gold shadow-[0_20px_50px_rgba(244,196,48,0.1)] animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-ipl-gold/10 rounded-lg">
              <Trophy className="w-6 h-6 text-ipl-gold" />
            </div>
            <h2 className="text-2xl font-display text-white italic tracking-tighter">OFFICIAL MATCH RESULTS</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              className="bg-white/5 p-6 border relative overflow-hidden group transition-all"
              style={{
                borderColor: match?.results?.[winnerQId] ? `${getTeamColor(match.results[winnerQId])}40` : 'rgba(255,255,255,0.1)',
                boxShadow: match?.results?.[winnerQId] ? `0 0 20px ${getTeamColor(match.results[winnerQId])}15` : 'none'
              }}
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">Official Winner</label>
              <div
                className="text-3xl font-display tracking-widest uppercase"
                style={{
                  color: match?.results?.[winnerQId] ? getTeamColor(match.results[winnerQId]) : 'white',
                  textShadow: match?.results?.[winnerQId] ? `0 0 20px ${getTeamColor(match.results[winnerQId])}60` : 'none'
                }}
              >
                {match?.results?.[winnerQId] || 'TBD'}
              </div>
            </div>

            {Object.keys(match?.results || {}).filter(k => k !== winnerQId).map(k => {
              const q = questions.find((q: any) => q.key === k);
              let label = q?.question_text || 'Result';
              if (label.length > 25) label = label.substring(0, 25) + '...';

              const val = match.results[k];
              const isTeamMatch = getTeamColor(val) !== '#666666';
              const valStyle = isTeamMatch ? { color: getTeamColor(val) } : { color: 'white' };

              return (
                <div key={k} className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group flex flex-col justify-center items-center">
                  <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Target className="w-24 h-24 text-ipl-gold" />
                  </div>
                  <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-2 text-center">{label}</label>
                  <div className="text-2xl font-display tracking-wide uppercase text-center" style={valStyle}>
                    {val}
                  </div>
                </div>
              );
            })}
          </div>

          {(match.reported_by_name) && (
            <div className="mt-8 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] font-display uppercase tracking-widest text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-ipl-gold rounded-full"></div>
                MATCH OFFICIAL RESULTS
              </div>
              <div className="flex items-center gap-2">
                Reported by <span className="text-ipl-gold font-bold">{match.reported_by_name}</span>
                {match.report_method && (
                  <span className="text-[8px] bg-white/5 px-1.5 py-0.5 rounded border border-white/10 lowercase opacity-60">
                    via {match.report_method}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}



      {!isLocked && (
        <div className="glass-panel p-8">
          <div className="flex justify-between items-center mb-8 border-b-2 border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-display text-white">YOUR PREDICTIONS</h2>
              {hasPredicted && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full animate-pulse">
                  <div className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"></div>
                  <span className="text-[10px] font-display text-green-500 uppercase tracking-tighter">Predictions Saved</span>
                </div>
              )}
            </div>
            {!currentUser?.is_guest && (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setShowAutoPredictConfirm(true)}
                  disabled={isLocked || hasPredicted || hasAutoPredicted}
                  className={`group flex items-center gap-1.5 text-[10px] sm:text-xs font-display uppercase tracking-widest px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-bold transition-all ${isLocked || hasPredicted || hasAutoPredicted
                    ? 'bg-gray-500 text-gray-300 opacity-40 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#004BA0] to-[#7B2FF7] text-white hover:shadow-[0_0_18px_rgba(123,47,247,0.6)] hover:scale-105'
                    }`}
                >
                  <Sparkles className="w-3 h-3 opacity-90 group-hover:animate-spin" />
                  AI Auto Predict
                </button>
                <div className="text-xs font-display text-ipl-gold uppercase tracking-widest bg-ipl-gold/10 px-3 py-1 rounded-full border border-ipl-gold/20 whitespace-nowrap">
                  {powerupsLeft} POWERUPS LEFT
                </div>
              </div>
            )}
          </div>

          {currentUser?.is_guest ? (
            <div className="py-12 px-6 text-center bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="inline-flex items-center justify-center p-4 bg-ipl-gold/10 rounded-full mb-6">
                <Sparkles className="w-8 h-8 text-ipl-gold animate-pulse" />
              </div>
              <h3 className="text-2xl font-display text-white mb-3">GUEST ACCESS</h3>
              <p className="text-gray-400 font-display text-sm tracking-wide max-w-md mx-auto leading-relaxed">
                You are currently viewing the system as a <span className="text-ipl-gold font-bold">GUEST</span>.
                You can see match details, community trends, and the leaderboard, but you cannot submit predictions.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4">
                <p className="text-[10px] text-gray-500 font-display uppercase tracking-[0.2em]">Contact an admin to join the league</p>
                <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
              {Object.entries(groupedQuestions).map(([source, groupQuestions]) => (
                <div key={source} className="space-y-6 pt-8 first:pt-0 border-t border-white/5 first:border-t-0">
                  <div className="flex items-center gap-3 border-l-4 border-ipl-gold pl-4 mb-4">
                    <h3 className="text-lg font-display text-white tracking-widest uppercase italic">
                      {source === 'IPL Global' ? (
                        <>IPL Global <span className="text-ipl-gold not-italic">Questions</span></>
                      ) : (
                        <><span className="text-ipl-gold not-italic">League:</span> {source}</>
                      )}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {groupQuestions.map(q => renderQuestion(q))}
                  </div>
                </div>
              ))}

              <div className="space-y-4 pt-8 border-t border-white/10">
                <div className="flex justify-between items-end">
                  <label className={`block font-display tracking-wide uppercase text-sm ${errors.use_powerup ? 'text-red-500' : 'text-gray-300'}`}>
                    Use 2x Powerup for this match? {errors.use_powerup && <span className="ml-2 text-[10px] animate-pulse">(! Selection Required)</span>}
                  </label>
                  <span className="text-[10px] text-gray-500 font-display uppercase">Season Limit: {totalPowerups}</span>
                </div>
                <div className={`flex gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
                  <label className={`flex-1 cursor-pointer ${(powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes') ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                    <input type="radio" value="Yes" {...register('use_powerup', { required: true })} className="peer sr-only" disabled={isLocked || (powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes')} />
                    <div className={`p-3 border-2 text-center font-display transition-all peer-checked:bg-ipl-gold peer-checked:text-black peer-checked:border-ipl-gold ${errors.use_powerup ? 'border-red-500/50 text-red-500/50' : 'border-white/20 text-gray-400'}`}>
                      YES (Use Powerup)
                    </div>
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <input type="radio" value="No" {...register('use_powerup', { required: true })} className="peer sr-only" disabled={isLocked} />
                    <div className={`p-3 border-2 text-center font-display transition-all peer-checked:bg-white/20 peer-checked:text-white peer-checked:border-white/40 ${errors.use_powerup ? 'border-red-500/50 text-red-500/50' : 'border-white/20 text-gray-400'}`}>
                      NO
                    </div>
                  </label>
                </div>
                {powerupsLeft <= 0 && myPredictions?.use_powerup !== 'Yes' && !isLocked && (
                  <p className="text-ipl-live text-[10px] font-display uppercase text-center mt-2 animate-pulse">Powerup Limit Reached!</p>
                )}
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  disabled={isPending || isLocked}
                  className="w-full bg-white text-ipl-navy hover:bg-gray-200 font-display uppercase tracking-widest py-4 transition-all disabled:bg-white/10 disabled:text-white/40 disabled:border-white/10"
                >
                  {isLocked ? 'LOCK PERIOD CLOSED' : (isPending ? 'LOCKING...' : (hasPredicted ? 'Update Lock' : 'Submit Lock'))}
                </button>
                {isLocked && (
                  <p className="text-gray-500 text-[10px] font-display uppercase mt-3 text-center">Prediction window ended 30m before the match start.</p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      <div className="space-y-12">
        {!leagueSections || leagueSections.length === 0 ? (
          <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
              NO PREDICTIONS FOUND FOR THIS MATCH
            </div>
          </div>
        ) : (
          leagueSections.map((section: any) => {
            const allPredictions = section.predictions;
            const sortedPredictions = getSortedPredictions(allPredictions);
            return (
              <div key={section.league.id} className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-8 border-b-2 border-white/5 pb-4">
                  <h2 className="text-2xl font-display text-white italic tracking-tighter">
                    {section.league.name === 'IPL Global' ? (
                      <>MATCH {matchNumber} <span className="text-ipl-gold">REVEAL</span></>
                    ) : (
                      <>{section.league.name} <span className="text-ipl-gold">| COMMUNITY REVEAL</span></>
                    )}
                  </h2>
                  {isLocked ? (
                    <span className="bg-ipl-live/20 text-ipl-live text-[10px] px-2 py-1 rounded font-display animate-pulse uppercase tracking-tighter">Live Guesses</span>
                  ) : (
                    <span className="bg-ipl-gold/20 text-ipl-gold text-[10px] px-2 py-1 rounded font-display uppercase tracking-tighter">Guesses Hidden</span>
                  )}
                </div>

                {!allPredictions || allPredictions.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
                    NO PREDICTIONS FOUND FOR THIS LEAGUE
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 md:gap-6">
                    {/* Stats Header */}
                    <div className="flex justify-center items-center gap-6 md:gap-8 bg-white/5 rounded-lg md:rounded-xl p-3 md:p-4 border border-white/10">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-display uppercase tracking-widest leading-none mb-1">{getTeamShortName(match.team1)}</span>
                        <span className="text-xl md:text-3xl font-display leading-none drop-shadow-md" style={{ color: getTeamColor(match.team1) }}>
                          {allPredictions.filter((p: any) => winnerQId && p.answers[winnerQId] === match.team1).length}
                        </span>
                      </div>
                      <div className="h-6 md:h-10 w-[1px] md:w-[2px] bg-white/20 rounded-full" />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] md:text-[10px] text-gray-400 font-display uppercase tracking-widest leading-none mb-1">{getTeamShortName(match.team2)}</span>
                        <span className="text-xl md:text-3xl font-display leading-none drop-shadow-md" style={{ color: getTeamColor(match.team2) }}>
                          {allPredictions.filter((p: any) => winnerQId && p.answers[winnerQId] === match.team2).length}
                        </span>
                      </div>
                    </div>

                    {/* Helper Function */}
                    {(() => {
                      const renderPredictionCard = (pred: any, idx: number, isDesktop = false) => {
                        const isMyRow = pred.user?.id === currentUser?.id;
                        const winnerAns = winnerQId ? pred.answers[winnerQId] : '🔒';
                        const teamWinnerShort = winnerAns === '🔒' ? '🔒' : getTeamShortName(winnerAns);

                        return (
                          <div key={idx} className={`flex items-center justify-between rounded-lg border transition-all ${isDesktop ? 'md:p-3.5 md:gap-4' : 'p-2 gap-2'} ${isMyRow ? 'bg-ipl-gold/10 border-ipl-gold/50 shadow-[0_0_15px_rgba(244,196,48,0.15)]' : 'bg-white/5 border-white/10'}`}>
                            <div className="flex items-center gap-2 md:gap-3">
                              <div className="relative shrink-0">
                                <img src={pred.user.avatar_url || 'https://via.placeholder.com/32'} className={`${isDesktop ? 'md:w-9 md:h-9' : 'w-7 h-7'} rounded-full border object-cover ${isMyRow ? 'border-ipl-gold' : 'border-white/10'}`} alt={pred.user.name} />
                                {isMyRow && (
                                  <div className={`absolute -top-1 -right-1 bg-ipl-gold rounded-full border border-ipl-navy flex items-center justify-center ${isDesktop ? 'md:w-3.5 md:h-3.5' : 'w-2.5 h-2.5'}`}>
                                    <Check className={`${isDesktop ? 'md:w-2 md:h-2' : 'w-1.5 h-1.5'} text-black`} />
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <span className={`${isDesktop ? 'md:text-[13px] md:font-black' : 'text-xs font-bold'} tracking-tight leading-none ${isMyRow ? 'text-ipl-gold' : 'text-white'}`}>
                                    {pred.user.name}
                                  </span>
                                  {match.status === 'completed' && pred.points_awarded !== undefined && pred.points_awarded !== null && (
                                    <div className="group-score relative">
                                      <span className={`px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold font-mono cursor-help transition-all group-hover-score:bg-white/20 ${pred.points_awarded > 0 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : pred.points_awarded < 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-white/10 text-gray-400 border border-white/20'}`}>
                                        {pred.points_awarded > 0 ? '+' : ''}{pred.points_awarded} PTS
                                      </span>

                                      {/* Breakdown Tooltip */}
                                      {pred.points_breakdown?.rules && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-[#0f172a] border border-white/10 rounded-lg shadow-2xl p-3 opacity-0 group-hover-score:opacity-100 pointer-events-none transition-all z-50">
                                          <div className="space-y-1.5">
                                            {/* Boostable Core Rules */}
                                            {pred.points_breakdown.rules.filter((r: any) => !['More Sixes', 'More Fours'].includes(r.category)).map((rule: any, ri: number) => (
                                              <div key={ri} className="flex justify-between items-center text-[8px] uppercase tracking-wider">
                                                <span className="text-gray-500 truncate mr-2">{rule.category}</span>
                                                <span className={rule.points > 0 ? 'text-green-400' : rule.points < 0 ? 'text-red-400' : 'text-gray-400'}>
                                                  {rule.points > 0 ? '+' : ''}{rule.points}
                                                </span>
                                              </div>
                                            ))}

                                            {/* Multiplier Indicator */}
                                            {pred.points_breakdown.powerup?.used && (
                                              <div className="py-1 my-1 border-y border-white/5 flex justify-between items-center text-[8px] uppercase tracking-widest font-bold text-ipl-gold">
                                                <span className="flex items-center gap-1">⚡ 2X Booster Applied</span>
                                                <span className="bg-ipl-gold text-black px-1 rounded-sm">x2</span>
                                              </div>
                                            )}
                                          </div>
                                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0f172a] border-r border-b border-white/10 rotate-45" />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {pred.is_auto_predicted && (
                                    <Sparkles className={`${isDesktop ? 'md:w-3 md:h-3' : 'w-2 h-2'} text-[#7B2FF7]`} />
                                  )}
                                </div>
                                <div className={`${isDesktop ? 'md:flex md:items-center md:gap-2 md:mt-2' : 'flex items-center gap-1.5 mt-1'} leading-none`}>
                                  {(!winnerQId || pred.answers[winnerQId] === '🔒') ? (
                                    <span className="text-[8px] text-gray-500 font-mono tracking-tight opacity-60 italic">🔒 HIDDEN</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {Object.keys(pred.answers || {}).filter(k => ![winnerQId, 'use_powerup'].includes(k)).map(k => {
                                        const q = questionMap?.[k];
                                        let label = q?.question_text || '';
                                        if (q?.source_name && q.source_name !== 'IPL Global') {
                                          label = `${q.source_name}: ${label}`;
                                        }

                                        // Color code if it matches a team name
                                        const isTeamMatch = getTeamColor(pred.answers[k]) !== '#666666';
                                        const valStyle = isTeamMatch ? { color: getTeamColor(pred.answers[k]) } : {};
                                        const displayVal = isTeamMatch ? getTeamShortName(pred.answers[k]) : pred.answers[k];

                                        return (
                                          <div key={k} className={`flex items-center bg-white/5 border border-white/10 rounded px-2 py-1 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                            {label && (
                                              <span className="text-[8px] text-gray-400 mr-1.5 font-bold uppercase whitespace-normal break-words max-w-[150px]">
                                                {label}
                                              </span>
                                            )}
                                            <span className={`${isDesktop ? 'md:text-[10px]' : 'text-[9px]'} text-white font-mono font-bold whitespace-nowrap`} style={valStyle}>
                                              {displayVal}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1.5 md:gap-2">
                                {pred.answers.use_powerup === 'Yes' && (
                                  <div className={`flex items-center bg-ipl-live/10 border border-ipl-live/20 rounded leading-none ${isDesktop ? 'md:px-1.5 md:py-1' : 'px-1 py-0.5'}`}>
                                    <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} font-bold text-ipl-live tracking-tighter uppercase`}>⚡ 2X Booster</span>
                                  </div>
                                )}
                                <span
                                  className={`font-bold rounded leading-none uppercase tracking-widest border ${isDesktop ? 'md:text-[10px] md:px-2 md:py-1' : 'text-[9px] px-1.5 py-0.5'} ${winnerAns === '🔒' ? 'bg-white/5 border-white/10 text-gray-500' : ''}`}
                                  style={winnerAns !== '🔒' ? {
                                    backgroundColor: `${getTeamColor(winnerAns)}15`,
                                    borderColor: `${getTeamColor(winnerAns)}40`,
                                    color: getTeamColor(winnerAns)
                                  } : {}}
                                >
                                  {isDesktop && winnerAns !== '🔒' ? getTeamShortName(winnerAns) : teamWinnerShort}
                                </span>
                              </div>

                              <div className="flex items-center justify-end">
                                {editingId === pred.prediction_id ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <input
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="bg-black/60 border border-white/20 text-white p-0.5 text-[8px] md:text-[10px] w-16 md:w-24 focus:border-ipl-gold focus:outline-none font-mono"
                                      autoFocus
                                    />
                                    <button onClick={() => handleAdminUpdate(pred.prediction_id)} className="text-green-500 hover:bg-white/10 rounded p-0.5">
                                      <Check className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="text-red-500 hover:bg-white/10 rounded p-0.5">
                                      <X className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {/* Edit block removed since we are now fully dynamic. We can still let admins edit, but they might need to go to Admin panel for specific questions. */
                                      currentUser?.is_admin && pred.prediction_id && (
                                        <button
                                          onClick={() => {
                                            // As a fallback, we could edit the first free_text answer if we want, but since it's dynamic, we might just edit the prediction's 'extra_answers' directly from the Admin panel instead.
                                            console.log("Admin edit requested for", pred.prediction_id);
                                          }}
                                          className="text-gray-600 hover:text-ipl-gold transition-colors ml-1.5"
                                          title="Edit prediction (Go to Admin Panel)"
                                        >
                                          <Edit2 className={`${isDesktop ? 'md:w-3.5 md:h-3.5' : 'w-2.5 h-2.5'}`} />
                                        </button>
                                      )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          {/* MOBILE ONLY: Compact Cards */}
                          <div className="grid grid-cols-1 md:hidden gap-1.5">
                            {sortedPredictions.map((pred: any, idx: number) => renderPredictionCard(pred, idx, false))}
                          </div>

                          {/* DESKTOP ONLY: Side-by-Side Teams */}
                          <div className="hidden md:grid md:grid-cols-2 gap-6 mt-2">
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 mb-2 px-1">
                                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: getTeamColor(match.team1) }} />
                                <span className="text-xs font-display uppercase tracking-widest text-white font-black">
                                  {match.team1} SUPPORTERS
                                </span>
                              </div>
                              <div className="space-y-2">
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team1).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team1).length === 0 && (
                                  <div className="p-8 border border-dashed border-white/10 rounded-lg text-center text-[10px] text-gray-600 uppercase">No supporters yet</div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div className="flex items-center gap-3 mb-2 px-1">
                                <div className="w-2 h-6 rounded-full" style={{ backgroundColor: getTeamColor(match.team2) }} />
                                <span className="text-xs font-display uppercase tracking-widest text-white font-black">
                                  {match.team2} SUPPORTERS
                                </span>
                              </div>
                              <div className="space-y-2">
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team2).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                                {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] === match.team2).length === 0 && (
                                  <div className="p-8 border border-dashed border-white/10 rounded-lg text-center text-[10px] text-gray-600 uppercase">No supporters yet</div>
                                )}
                              </div>
                            </div>
                            {sortedPredictions.some(p => winnerQId && p.answers[winnerQId] !== match.team1 && p.answers[winnerQId] !== match.team2) && (
                              <div className="col-span-2 mt-8 space-y-4">
                                <div className="flex items-center gap-2 mb-2 px-1 justify-center border-t border-white/5 pt-8">
                                  <span className="text-[11px] font-display uppercase tracking-widest text-gray-600 font-bold">
                                    OTHER PREDICTIONS
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  {sortedPredictions.filter(p => winnerQId && p.answers[winnerQId] !== match.team1 && p.answers[winnerQId] !== match.team2).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ADMIN ZONE */}
      {currentUser?.is_admin && (
        <div className="mt-16 space-y-8 relative">
          {/* Admin Zone Header */}
          <div className="flex items-center gap-4 mb-4 opacity-70">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
            <div className="flex items-center gap-2 text-red-500 font-display tracking-widest text-[10px] uppercase">
              <ShieldAlert className="w-3 h-3" />
              Admin Access Zone
            </div>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
          </div>

          {/* Admin Match Result Processor Section */}
          <section className="glass-panel p-8 border-t-4 border-t-ipl-gold shadow-[0_20px_50px_rgba(244,196,48,0.1)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-ipl-gold/10 rounded-lg">
                <Settings className="w-6 h-6 text-ipl-gold" />
              </div>
              <h2 className="text-xl font-display text-white italic tracking-tighter">MATCH RESULT PROCESSOR</h2>
            </div>

            <div className="bg-ipl-gold/5 border border-ipl-gold/20 p-4 mb-8">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-ipl-gold shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-400 font-display uppercase tracking-wider leading-relaxed">
                  Caution: Triggering the scoring engine calculates points for ALL users immediately. Ensure facts are correct against official BCCI match data.
                </p>
              </div>
            </div>

            <form onSubmit={handleAdminResultSubmit} className="space-y-8">
              {match.status === 'completed' && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 flex gap-3 items-center mb-6">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-[10px] text-red-500 font-display uppercase tracking-widest leading-relaxed">
                    Override Mode: Updating facts will RE-CALCULATE scores for all users immediately.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {questions.filter((q: any) =>
                  q.source_name === 'IPL Global' &&
                  !q.question_text.toLowerCase().includes('booster') &&
                  !q.question_text.toLowerCase().includes('powerup')
                ).map((q: any) => (
                  <div key={q.question_id} className="space-y-4">
                    <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em]">
                      {q.question_text}
                    </label>

                    {q.options ? (
                      <div className={`grid ${q.options.length > 2 ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                        {q.options.map((opt: string) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setAdminResults({ ...adminResults, [q.question_id]: opt })}
                            className={`p-3 border-2 font-display text-[9px] tracking-widest transition-all ${adminResults[q.question_id] === opt ? 'border-ipl-gold bg-ipl-gold text-black' : 'border-white/10 text-gray-500 hover:border-white/20'}`}
                          >
                            {opt.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <input
                        type={q.answer_type === 'free_number' ? 'number' : 'text'}
                        value={adminResults[q.question_id] || ''}
                        onChange={(e) => setAdminResults({ ...adminResults, [q.question_id]: e.target.value })}
                        placeholder={q.answer_type === 'free_number' ? 'ENTER VALUE' : 'ENTER TEXT'}
                        className="w-full bg-black/40 border-2 border-white/10 p-3 text-white focus:outline-none focus:border-ipl-gold transition-all font-display text-[10px] tracking-widest uppercase"
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isUpdatingResults || Object.keys(adminResults).length === 0}
                className="w-full bg-ipl-gold text-black font-display py-4 uppercase tracking-[0.3em] font-black hover:bg-white hover:scale-[1.01] transition-all disabled:opacity-20"
              >
                {isUpdatingResults ? 'EXECUTING LOGIC...' : 'TRIGGER SCORING ENGINE'}
              </button>
            </form>
          </section>

          {/* AI Assassin Engine Section */}
          <section className="glass-panel p-8 border-t-4 border-t-[#7B2FF7] shadow-[0_20px_50px_rgba(123,47,247,0.1)]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-[#7B2FF7]/10 rounded-lg">
                <Bot className="w-6 h-6 text-[#7B2FF7]" />
              </div>
              <h2 className="text-xl font-display text-white italic tracking-tighter">AI ASSASSIN ENGINE</h2>
            </div>

            <p className="text-gray-400 text-[10px] font-display tracking-widest uppercase leading-relaxed mb-6">
              Manually trigger the AI Assassin to evaluate upcoming matches within the next 24 hours and lock in predictions.
            </p>

            <button
              type="button"
              onClick={() => {
                triggerAI(undefined, {
                  onSuccess: () => {
                    toast.success('AI prediction job triggered!');
                    // Give it a second to run the script then invalidate
                    setTimeout(() => queryClient.invalidateQueries({ queryKey: ['predictions', 'all', id || match.id] }), 1500);
                  },
                  onError: () => toast.error('Failed to trigger AI')
                });
              }}
              disabled={isTriggerAIPending}
              className="w-full bg-gradient-to-r from-[#004BA0] to-[#7B2FF7] text-white font-display py-4 uppercase tracking-[0.3em] font-black hover:shadow-[0_0_20px_rgba(123,47,247,0.4)] disabled:opacity-50 disabled:grayscale transition-all"
            >
              {isTriggerAIPending ? 'EXECUTING NEURAL NET...' : 'TRIGGER AI ASSASSIN NOW'}
            </button>
          </section>
        </div>
      )}

      {/* AI Auto Predict Confirmation Modal */}
      {showAutoPredictConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowAutoPredictConfirm(false)}
          />
          {/* Dialog */}
          <div className="relative glass-panel border border-[#7B2FF7]/40 shadow-[0_0_40px_rgba(123,47,247,0.3)] p-8 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            {/* Top accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#004BA0] to-[#7B2FF7]" />

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="p-3 rounded-full bg-[#7B2FF7]/15 border border-[#7B2FF7]/30">
                <Sparkles className="w-6 h-6 text-[#7B2FF7]" />
              </div>
            </div>

            {/* Text */}
            <h3 className="text-white font-display text-lg tracking-tight text-center mb-2">
              Use AI Auto Predict?
            </h3>
            <p className="text-gray-400 text-xs font-display text-center leading-relaxed">
              Are you sure you want to continue?<br />
              <span className="text-[#F4C430] font-semibold">AI will populate the values for you. You can still modify them manually.</span>
            </p>

            {/* Buttons */}
            <div className="flex gap-3 mt-7">
              <button
                onClick={() => setShowAutoPredictConfirm(false)}
                className="flex-1 py-2.5 border border-white/20 text-gray-300 font-display text-xs uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                No
              </button>
              <button
                onClick={() => {
                  setShowAutoPredictConfirm(false);
                  handleAutoPredict();
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-[#004BA0] to-[#7B2FF7] text-white font-display text-xs uppercase tracking-widest hover:shadow-[0_0_15px_rgba(123,47,247,0.5)] transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3 h-3" />
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
