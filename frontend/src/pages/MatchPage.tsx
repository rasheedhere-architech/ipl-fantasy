import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMatchV2, useSubmitPrediction, useMyPredictions, useAllMatchPredictions } from '../api/hooks/useMatches';
import { Trophy, Award, Target, CheckCircle2, Edit2, Check, X } from 'lucide-react';
import { useAuthStore } from '../store/auth';
import { apiClient } from '../api/client';
import toast from 'react-hot-toast';

export default function MatchPage() {
  const { id } = useParams();
  const { user: currentUser } = useAuthStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const { data, isLoading, error } = useMatchV2(id || '');
  const { mutate: submitPrediction, isPending } = useSubmitPrediction(id || '');
  const { data: myPredictions } = useMyPredictions(id || '');

  // Predictions are currently always open (toss-lock disabled)
  const tossTime = data?.match ? (data.match.tossTime ? new Date(data.match.tossTime) : new Date(data.match.toss_time)) : null;
  const isLocked = tossTime ? (new Date() > new Date(tossTime.getTime() - 30 * 60000)) : false;

  const { data: allPredictions } = useAllMatchPredictions(id || '');

  // Pre-fill existing predictions
  useEffect(() => {
    if (myPredictions && Object.keys(myPredictions).length > 0) {
      const initialValues: any = { ...myPredictions.answers };
      initialValues.use_powerup = myPredictions.use_powerup || 'No';
      reset(initialValues);
    }
  }, [myPredictions, reset]);

  if (isLoading) return <div className="text-white text-center font-display tracking-widest mt-20 animate-pulse">LOADING MATCH...</div>;
  if (error || !data || !data.match) return <div className="text-ipl-live text-center font-display tracking-widest mt-20">FAILED TO LOAD MATCH</div>;

  const match = data.match;
  const questions = data.questions || [];
  const powerupsUsed = data.powerups_used || 0;
  const totalPowerups = data.total_powerups ?? 10;
  const powerupsLeft = totalPowerups - powerupsUsed;
  const hasPredicted = myPredictions && Object.keys(myPredictions).length > 0;

  const matchNoMatch = match.id.match(/ipl-\d{4}-(\d+)/);
  const matchNumber = matchNoMatch ? matchNoMatch[1] : null;



  const onSubmit = (formData: any) => {
    if (isLocked) return;
    
    // Bundle all dynamic answers into an `answers` payload as expected by V2 router
    const use_powerup = formData.use_powerup;
    const answers = { ...formData };
    delete answers.use_powerup;

    submitPrediction({ answers, use_powerup }, {
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
        <h1 className="text-5xl text-white font-display mt-4">
          <span className="text-[#004BA0]">{match.team1}</span>
          <span className="text-gray-600 mx-4 text-3xl">VS</span>
          <span className="text-[#F4C430]">{match.team2}</span>
        </h1>
        <p className="text-gray-400 mt-4 font-display uppercase tracking-widest">{match.venue}</p>
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
            <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <CheckCircle2 className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">Official Winner</label>
              <div className="text-3xl font-display text-white tracking-widest uppercase">{match.winner}</div>
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
        </div>
      )}

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
          <div className="text-xs font-display text-ipl-gold uppercase tracking-widest bg-ipl-gold/10 px-3 py-1 rounded-full border border-ipl-gold/20">
            {powerupsLeft} POWERUPS LEFT
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {questions.map((q: any) => (
            <div key={q.id} className="space-y-4 pt-4">
              <label className="block text-gray-300 font-display tracking-wide uppercase text-sm">
                {q.question}
              </label>
              
              {q.type === 'number' && (
                <input
                  {...register(q.id, { required: true })}
                  type="number"
                  placeholder="0"
                  disabled={isLocked}
                  className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 ${errors[q.id] ? 'border-red-500/50' : 'border-white/20'}`}
                />
              )}

              {(q.type === 'single_answer' || q.type === 'text') && (
                <input
                  {...register(q.id, { required: true })}
                  type="text"
                  placeholder="Enter Answer"
                  disabled={isLocked}
                  className={`w-full bg-ipl-navy border-2 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 ${errors[q.id] ? 'border-red-500/50' : 'border-white/20'}`}
                />
              )}

              {(q.type === 'dropdown' || q.type === 'selection') && (
                <select
                  {...register(q.id, { required: true })}
                  disabled={isLocked}
                  className={`w-full bg-black/40 border-2 p-4 text-white focus:outline-none focus:border-ipl-gold transition-all disabled:opacity-50 appearance-none ${errors[q.id] ? 'border-red-500/50' : 'border-white/20'}`}
                >
                  <option value="">-- Select Option --</option>
                  {q.options?.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
              
              {q.type === 'multi_answers' && (
                 <div className={`grid grid-cols-2 gap-4 ${isLocked ? 'pointer-events-none opacity-80' : ''}`}>
                  {q.options?.map((opt: string) => (
                    <label key={opt} className="cursor-pointer">
                      <input type="checkbox" value={opt} {...register(q.id)} className="peer sr-only" disabled={isLocked} />
                      <div className={`p-4 border-2 text-center font-display transition-all peer-checked:bg-ipl-gold peer-checked:border-ipl-gold peer-checked:text-black ${errors[q.id] ? 'border-red-500/50 text-red-500/50' : 'border-white/20 text-gray-400'}`}>
                        {opt}
                      </div>
                    </label>
                  ))}
                 </div>
              )}
            </div>
          ))}

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
      </div>
      <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-3 mb-8 border-b-2 border-white/5 pb-4">
          <h2 className="text-2xl font-display text-white italic tracking-tighter">COMMUNITY REVEAL</h2>
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
          <div className="overflow-x-auto w-full custom-scrollbar pb-2">
            <table className="w-full text-left border-collapse min-w-[600px] whitespace-nowrap">
              <thead>
                <tr className="text-ipl-gold font-display text-[11px] uppercase tracking-widest border-b border-white/10">
                  <th className="py-4 font-normal">Expert</th>
                  <th className="py-4 font-normal text-center">Winner</th>
                  <th className="py-4 font-normal text-center">PP Scores</th>
                  <th className="py-4 font-normal">Player of Match</th>
                  <th className="py-4 font-normal text-right">Power up</th>
                </tr>
              </thead>
              <tbody className="text-white font-display">
                {allPredictions.map((pred: any, idx: number) => (
                  <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                    <td className="py-4 flex items-center gap-3">
                      <img src={pred.user.avatar_url || 'https://via.placeholder.com/32'} className="w-8 h-8 rounded-full border border-white/10 group-hover:border-ipl-gold transition-colors" alt={pred.user.name} />
                      <span className="text-sm font-bold tracking-tight">{pred.user.name}</span>
                    </td>
                    <td className="py-4 text-center">
                      <span className={`px-2 py-1 text-[10px] uppercase font-bold ${pred.answers.match_winner === match.team1 ? 'bg-[#004BA0]/20 text-[#004BA0]' : (pred.answers.match_winner === '🔒' ? 'bg-white/5 text-gray-500' : 'bg-ipl-gold/20 text-ipl-gold')}`}>
                        {pred.answers.match_winner}
                      </span>
                    </td>
                    <td className={`py-4 text-center text-[11px] font-mono opacity-90 ${pred.answers.team1_powerplay === '🔒' ? 'text-gray-600' : 'text-gray-300'}`}>
                      {pred.answers.team1_powerplay === '🔒' ? (
                        <span className="opacity-40">🔒</span>
                      ) : (
                        <div className="flex flex-col items-center leading-tight">
                          <span className="flex gap-2">
                            <span className="text-gray-500">{match.team1.split(' ').map((w: string) => w[0]).join('').toUpperCase()}:</span>
                            <span className="text-white font-bold">{pred.answers.team1_powerplay}</span>
                          </span>
                          <span className="flex gap-2">
                            <span className="text-gray-500">{match.team2.split(' ').map((w: string) => w[0]).join('').toUpperCase()}:</span>
                            <span className="text-white font-bold">{pred.answers.team2_powerplay}</span>
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-sm opacity-80 uppercase italic text-gray-400">
                      {editingId === pred.prediction_id ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="bg-black/40 border border-white/20 text-white p-1 text-[10px] w-24 focus:border-ipl-gold focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => handleAdminUpdate(pred.prediction_id)} className="text-green-500 hover:text-green-400 p-1">
                            <Check className="w-3 h-3" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-red-500 hover:text-red-400 p-1">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {pred.answers.player_of_the_match}
                          {currentUser?.is_admin && pred.prediction_id && (
                            <button
                              onClick={() => {
                                setEditingId(pred.prediction_id);
                                setEditValue(pred.answers.player_of_the_match);
                              }}
                              className="text-gray-600 hover:text-ipl-gold opacity-0 group-hover:opacity-100 transition-all p-1"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-right">
                      {pred.answers.use_powerup === 'Yes' ? (
                        <div className="inline-flex items-center gap-1 text-ipl-live">
                          <span className="text-lg">⚡</span>
                          <span className="text-[10px] font-bold">2X</span>
                        </div>
                      ) : (
                        <span className="text-gray-600 text-[10px]">{pred.answers.use_powerup === 'No' ? '—' : '🔒'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
