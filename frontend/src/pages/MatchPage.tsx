import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useMatch, useSubmitPrediction, useMyPredictions, useAllMatchPredictions } from '../api/hooks/useMatches';
import { useUpdateMatchResults, useTriggerAIPredictions } from '../api/hooks/useAdmin';
import { Trophy, Award, Target, CheckCircle2, Edit2, Check, X, Sparkles, Settings, AlertTriangle, ShieldAlert, Bot, MapPin, Zap } from 'lucide-react';
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
  const [adminResults, setAdminResults] = useState({
    winner: '',
    team1_powerplay_score: 0,
    team2_powerplay_score: 0,
    player_of_the_match: ''
  });

  // Predictions are currently always open (toss-lock disabled)
  const tossTime = data?.match ? (data.match.tossTime ? new Date(data.match.tossTime) : new Date(data.match.toss_time)) : null;
  const isLocked = tossTime ? (new Date() > new Date(tossTime.getTime() - 30 * 60000)) : false;

  const { data: allPredictions } = useAllMatchPredictions(id || '');

  // Pre-fill existing predictions and admin results
  useEffect(() => {
    if (myPredictions && Object.keys(myPredictions).length > 0) {
      reset(myPredictions);
      setHasAutoPredicted(!!myPredictions.is_auto_predicted);
    }
  }, [myPredictions, reset]);

  useEffect(() => {
    if (data?.match) {
      setAdminResults({
        winner: data.match.winner || '',
        team1_powerplay_score: data.match.team1_powerplay_score || 0,
        team2_powerplay_score: data.match.team2_powerplay_score || 0,
        player_of_the_match: data.match.player_of_the_match || ''
      });
    }
  }, [data]);

  const match = data?.match;
  const sortedPredictions = useMemo(() => {
    if (!allPredictions || !match) return [];
    return [...allPredictions].sort((a, b) => {
      const getScore = (p: any) => {
        const w = p.answers?.match_winner;
        if (w === match.team1) return 1;
        if (w === match.team2) return 2;
        return 3;
      };
      const scoreDiff = getScore(a) - getScore(b);
      if (scoreDiff !== 0) return scoreDiff;
      const nameA = a.user?.name || '';
      const nameB = b.user?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [allPredictions, match]);

  if (isLoading) return <div className="text-white text-center font-display tracking-widest mt-20 animate-pulse">LOADING MATCH...</div>;
  if (error || !data || !match) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCH</div>;

  const questions = data.questions || [];
  const powerupsUsed = data.powerups_used || 0;
  const totalPowerups = data.total_powerups ?? 10;
  const powerupsLeft = totalPowerups - powerupsUsed;
  const hasPredicted = myPredictions && Object.keys(myPredictions).length > 0;

  const matchNoMatch = match.id.match(/ipl-\d{4}-(\d+)/);
  const matchNumber = matchNoMatch ? matchNoMatch[1] : null;

  // Find specific labels from the questions array
  const team1PPLabel = questions.find((q: any) => q.key === 'team1_powerplay')?.question_text || `${match.team1} Power Play Score`;
  const team2PPLabel = questions.find((q: any) => q.key === 'team2_powerplay')?.question_text || `${match.team2} Power Play Score`;


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

      setValue('match_winner', predictedData.match_winner, { shouldValidate: true, shouldDirty: true });
      setValue('team1_powerplay', predictedData.team1_powerplay, { shouldValidate: true, shouldDirty: true });
      setValue('team2_powerplay', predictedData.team2_powerplay, { shouldValidate: true, shouldDirty: true });
      setValue('player_of_the_match', predictedData.player_of_the_match, { shouldValidate: true, shouldDirty: true });

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
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
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
              style={{ borderColor: `${getTeamColor(match.winner)}40`, boxShadow: `0 0 20px ${getTeamColor(match.winner)}15` }}
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">Official Winner</label>
              <div
                className="text-3xl font-display tracking-widest uppercase"
                style={{ color: getTeamColor(match.winner), textShadow: `0 0 20px ${getTeamColor(match.winner)}60` }}
              >
                {match.winner}
              </div>
            </div>

            <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Target className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4 font-normal">Power Play Scores</label>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-400 font-display uppercase mb-1">{match.team1}</div>
                  <div className="text-3xl font-display text-white">{match.team1_powerplay_score}</div>
                </div>
                <div className="text-gray-600 text-2xl font-display mt-4">—</div>
                <div className="text-center">
                  <div className="text-xs text-gray-400 font-display uppercase mb-1">{match.team2}</div>
                  <div className="text-3xl font-display text-white">{match.team2_powerplay_score}</div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Award className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">Player of the Match</label>
              <div className="text-2xl font-display text-white tracking-wide uppercase">{match.player_of_the_match}</div>
            </div>
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
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">Match Winner</label>
                <div className={`grid grid-cols-2 gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
                  <label className="cursor-pointer">
                    <input type="radio" value={match.team1} {...register('match_winner', { required: true })} className="peer sr-only" disabled={isLocked} />
                    <div
                      className="team-select-button p-4 border-2 text-center font-display text-xl transition-all peer-checked:text-white"
                      style={{
                        '--team-color': getTeamColor(match.team1),
                        borderColor: errors.match_winner ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                        color: errors.match_winner ? 'rgba(239, 68, 68, 0.5)' : 'rgba(156, 163, 175, 1)'
                      } as any}
                    >
                      {match.team1}
                    </div>
                  </label>
                  <label className="cursor-pointer">
                    <input type="radio" value={match.team2} {...register('match_winner', { required: true })} className="peer sr-only" disabled={isLocked} />
                    <div
                      className="team-select-button p-4 border-2 text-center font-display text-xl transition-all peer-checked:text-white"
                      style={{
                        '--team-color': getTeamColor(match.team2),
                        borderColor: errors.match_winner ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.2)',
                        color: errors.match_winner ? 'rgba(239, 68, 68, 0.5)' : 'rgba(156, 163, 175, 1)'
                      } as any}
                    >
                      {match.team2}
                    </div>
                  </label>
                </div>
                <style>{`
                  .team-select-button {
                    transition: all 0.3s ease;
                  }
                  input:checked + .team-select-button {
                    background-color: var(--team-color) !important;
                    border-color: var(--team-color) !important;
                    box-shadow: 0 0 20px var(--team-color) !important;
                  }
                `}</style>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-6">
                <div className="space-y-2">
                  <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
                    {team1PPLabel}
                  </label>
                  <input
                    {...register('team1_powerplay', { required: true, valueAsNumber: true })}
                    type="number"
                    placeholder="0"
                    disabled={isLocked}
                    className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold focus:shadow-[0_0_10px_rgba(244,196,48,0.2)] transition-all disabled:opacity-50 ${errors.team1_powerplay ? 'border-red-500/50' : 'border-white/20'}`}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
                    {team2PPLabel}
                  </label>
                  <input
                    {...register('team2_powerplay', { required: true, valueAsNumber: true })}
                    type="number"
                    placeholder="0"
                    disabled={isLocked}
                    className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold focus:shadow-[0_0_10px_rgba(244,196,48,0.2)] transition-all disabled:opacity-50 ${errors.team2_powerplay ? 'border-red-500/50' : 'border-white/20'}`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">Player of the Match</label>
                <input
                  {...register('player_of_the_match', { required: true })}
                  type="text"
                  placeholder="Player Name"
                  disabled={isLocked}
                  className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold focus:shadow-[0_0_10px_rgba(244,196,48,0.2)] transition-all disabled:opacity-50 ${errors.player_of_the_match ? 'border-red-500/50' : 'border-white/20'}`}
                />
              </div>

              <div className="space-y-4 pt-4">
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
                  <p className="text-gray-500 text-[10px] font-display uppercase mt-3 text-center">Prediction window ended 30m before the match toss.</p>
                )}
              </div>
            </form>
          )}
        </div>
      )}
      <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-3 mb-8 border-b-2 border-white/5 pb-4">
          <h2 className="text-2xl font-display text-white italic tracking-tighter">
            MATCH {matchNumber} <span className="text-ipl-gold">REVEAL</span>
          </h2>
          {isLocked ? (
            <span className="bg-ipl-live/20 text-ipl-live text-[10px] px-2 py-1 rounded font-display animate-pulse uppercase tracking-tighter">Live Guesses</span>
          ) : (
            <span className="bg-ipl-gold/20 text-ipl-gold text-[10px] px-2 py-1 rounded font-display uppercase tracking-tighter">Guesses Hidden</span>
          )}
        </div>

        {!allPredictions || allPredictions.length === 0 ? (
          <div className="text-center py-10 text-gray-500 font-display tracking-widest text-[10px] uppercase">
            NO PREDICTIONS FOUND FOR THIS MATCH
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:gap-6">
            {/* Stats Header */}
            <div className="flex justify-center items-center gap-6 md:gap-8 bg-white/5 rounded-lg md:rounded-xl p-3 md:p-4 border border-white/10">
              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[10px] text-gray-400 font-display uppercase tracking-widest leading-none mb-1">{getTeamShortName(match.team1)}</span>
                <span className="text-xl md:text-3xl font-display leading-none drop-shadow-md" style={{ color: getTeamColor(match.team1) }}>
                  {allPredictions.filter((p: any) => p.answers.match_winner === match.team1).length}
                </span>
              </div>
              <div className="h-6 md:h-10 w-[1px] md:w-[2px] bg-white/20 rounded-full" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] md:text-[10px] text-gray-400 font-display uppercase tracking-widest leading-none mb-1">{getTeamShortName(match.team2)}</span>
                <span className="text-xl md:text-3xl font-display leading-none drop-shadow-md" style={{ color: getTeamColor(match.team2) }}>
                  {allPredictions.filter((p: any) => p.answers.match_winner === match.team2).length}
                </span>
              </div>
            </div>

            {/* Helper Function */}
            {(() => {
              const renderPredictionCard = (pred: any, idx: number, isDesktop = false) => {
                const isMyRow = pred.user?.id === currentUser?.id;
                const teamWinnerShort = pred.answers.match_winner === '🔒' ? '🔒' : getTeamShortName(pred.answers.match_winner);
                const team1Short = getTeamShortName(match.team1);
                const team2Short = getTeamShortName(match.team2);

                return (
                  <div key={idx} className={`flex items-center justify-between rounded-lg border transition-all ${isDesktop ? 'md:p-3.5 md:gap-4' : 'p-2 gap-2'} ${isMyRow ? 'bg-ipl-gold/10 border-ipl-gold/50 shadow-[0_0_15px_rgba(244,196,48,0.15)]' : 'bg-white/5 border-white/10'}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="relative">
                        <img src={pred.user.avatar_url || 'https://via.placeholder.com/32'} className={`${isDesktop ? 'md:w-9 md:h-9' : 'w-7 h-7'} rounded-full border ${isMyRow ? 'border-ipl-gold' : 'border-white/10'}`} alt={pred.user.name} />
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
                          {pred.is_auto_predicted && (
                            <Sparkles className={`${isDesktop ? 'md:w-3 md:h-3' : 'w-2 h-2'} text-[#7B2FF7]`} />
                          )}
                        </div>
                        <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} text-gray-400 font-mono tracking-tight flex items-center gap-1.5 mt-1 leading-none`}>
                          {pred.answers.team1_powerplay === '🔒' ? (
                            <span className="opacity-60">🔒 HIDDEN</span>
                          ) : (
                            <>
                              <span style={{ color: getTeamColor(match.team1) }}>{isDesktop ? match.team1 : team1Short}:<span className="text-white font-bold ml-1">{pred.answers.team1_powerplay}</span></span>
                              <span style={{ color: getTeamColor(match.team2) }}>{isDesktop ? match.team2 : team2Short}:<span className="text-white font-bold ml-1">{pred.answers.team2_powerplay}</span></span>
                            </>
                          )}
                        </span>
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
                          className={`font-bold rounded leading-none uppercase tracking-widest border ${isDesktop ? 'md:text-[10px] md:px-2 md:py-1' : 'text-[9px] px-1.5 py-0.5'} ${pred.answers.match_winner === '🔒' ? 'bg-white/5 border-white/10 text-gray-500' : ''}`}
                          style={pred.answers.match_winner !== '🔒' ? {
                            backgroundColor: `${getTeamColor(pred.answers.match_winner)}15`,
                            borderColor: `${getTeamColor(pred.answers.match_winner)}40`,
                            color: getTeamColor(pred.answers.match_winner)
                          } : {}}
                        >
                          {isDesktop && pred.answers.match_winner !== '🔒' ? getTeamShortName(pred.answers.match_winner) : teamWinnerShort}
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
                            {pred.answers.player_of_the_match !== '🔒' && (
                              <span className={`${isDesktop ? 'md:text-[9px] md:max-w-[150px]' : 'text-[7.5px] max-w-[80px]'} text-gray-500 uppercase tracking-widest truncate italic leading-none`}>
                                {pred.answers.player_of_the_match}
                              </span>
                            )}
                            {currentUser?.is_admin && pred.prediction_id && (
                              <button
                                onClick={() => {
                                  setEditingId(pred.prediction_id);
                                  setEditValue(pred.answers.player_of_the_match);
                                }}
                                className="text-gray-600 hover:text-ipl-gold transition-colors ml-1.5"
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
                        {sortedPredictions.filter(p => p.answers.match_winner === match.team1).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                        {sortedPredictions.filter(p => p.answers.match_winner === match.team1).length === 0 && (
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
                        {sortedPredictions.filter(p => p.answers.match_winner === match.team2).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
                        {sortedPredictions.filter(p => p.answers.match_winner === match.team2).length === 0 && (
                          <div className="p-8 border border-dashed border-white/10 rounded-lg text-center text-[10px] text-gray-600 uppercase">No supporters yet</div>
                        )}
                      </div>
                    </div>
                    {sortedPredictions.some(p => p.answers.match_winner !== match.team1 && p.answers.match_winner !== match.team2) && (
                      <div className="col-span-2 mt-8 space-y-4">
                        <div className="flex items-center gap-2 mb-2 px-1 justify-center border-t border-white/5 pt-8">
                          <span className="text-[11px] font-display uppercase tracking-widest text-gray-600 font-bold">
                            OTHER PREDICTIONS
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {sortedPredictions.filter(p => p.answers.match_winner !== match.team1 && p.answers.match_winner !== match.team2).map((pred: any, idx: number) => renderPredictionCard(pred, idx, true))}
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

            <form onSubmit={handleAdminResultSubmit} className="space-y-6">
              {match.status === 'completed' && (
                <div className="bg-red-500/10 border border-red-500/20 p-3 flex gap-3 items-center mb-6">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-[10px] text-red-500 font-display uppercase tracking-widest leading-relaxed">
                    Override Mode: Updating facts for a completed match will RE-CALCULATE scores for all users immediately. Proceed with caution.
                  </p>
                </div>
              )}
              <div className="space-y-4">
                <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em]">Match Winner</label>
                <div className="grid grid-cols-2 gap-4">
                  {[match.team1, match.team2].map(team => (
                    <button
                      key={team}
                      type="button"
                      onClick={() => setAdminResults({ ...adminResults, winner: team })}
                      className={`p-4 border-2 font-display text-sm tracking-widest transition-all ${adminResults.winner === team ? 'border-ipl-gold bg-ipl-gold text-black' : 'border-white/10 text-gray-500 hover:border-white/20'}`}
                    >
                      {team}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] truncate">{match.team1} PP Score</label>
                  <input
                    type="number"
                    value={adminResults.team1_powerplay_score}
                    onChange={(e) => setAdminResults({ ...adminResults, team1_powerplay_score: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border-2 border-white/10 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] truncate">{match.team2} PP Score</label>
                  <input
                    type="number"
                    value={adminResults.team2_powerplay_score}
                    onChange={(e) => setAdminResults({ ...adminResults, team2_powerplay_score: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border-2 border-white/10 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em]">Player of the Match</label>
                <input
                  type="text"
                  value={adminResults.player_of_the_match}
                  onChange={(e) => setAdminResults({ ...adminResults, player_of_the_match: e.target.value })}
                  placeholder="ENTER PLAYER NAME"
                  className="w-full bg-black/40 border-2 border-white/10 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all font-display text-sm tracking-widest uppercase placeholder:text-gray-700"
                />
              </div>

              <button
                type="submit"
                disabled={isUpdatingResults || !adminResults.winner}
                className="w-full bg-ipl-gold text-black font-display py-4 uppercase tracking-[0.3em] font-black hover:bg-white hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-20 disabled:grayscale"
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
