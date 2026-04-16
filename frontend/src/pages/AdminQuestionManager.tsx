import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save, Download, HelpCircle } from 'lucide-react';
import { useMatchesV2 } from '../api/hooks/useMatches';
import { useUpdateMatchQuestionsV2, useSaveTemplateV2, useTemplatesV2, useUpdateMatchResultsV2 } from '../api/hooks/useAdmin';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';

export default function AdminQuestionManager() {
  const { user } = useAuthStore();
  const { data: matches } = useMatchesV2();
  const { data: templates } = useTemplatesV2();
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isDefaultTemplate, setIsDefaultTemplate] = useState(false);
  
  const [questions, setQuestions] = useState<any[]>([]);
  const { mutate: updateQuestions, isPending: isUpdatingQuestions } = useUpdateMatchQuestionsV2();
  const { mutate: saveTemplate, isPending: isSavingTemplate } = useSaveTemplateV2();

  const selectedMatch = matches?.find(m => m.id === selectedMatchId);

  // For answers when match completes
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const { mutate: updateResults, isPending: isUpdatingResults } = useUpdateMatchResultsV2();

  // Auto-load template logic could go here,
  // but we leave it explicit so admin knows exactly what's going on.

  useEffect(() => {
    if (selectedMatch) {
      if (selectedMatch.questions_json && selectedMatch.questions_json.length > 0) {
        setQuestions(selectedMatch.questions_json);
      } else {
        // Load default template if no questions
        const defaultTemplate = templates?.find(t => t.is_default);
        if (defaultTemplate) {
           setQuestions(defaultTemplate.questions_json);
        } else {
           setQuestions([]);
        }
      }
      setAnswers(selectedMatch.answers_json || {});
    }
  }, [selectedMatchId, matches, templates]);

  if (!user?.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  const addQuestion = () => {
    const newId = `q_${Date.now()}`;
    setQuestions([...questions, { id: newId, type: 'dropdown', question: '', points: 10, negative_points: -5, options: '' }]);
  };

  const updateQuestion = (index: number, key: string, value: any) => {
    const newQ = [...questions];
    newQ[index] = { ...newQ[index], [key]: value };
    setQuestions(newQ);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const formatQuestionsForSave = () => {
    return questions.map(q => {
      const qd = { ...q };
      if (typeof qd.options === 'string' && qd.options) {
        qd.options = qd.options.split(',').map((o: string) => o.trim()).filter(Boolean);
      }
      return qd;
    });
  };

  const handleSaveToMatch = () => {
    if (!selectedMatchId) return;
    updateQuestions({ matchId: selectedMatchId, questions: formatQuestionsForSave() }, {
      onSuccess: () => toast.success('Match Questions updated successfully!'),
      onError: () => toast.error('Failed to update match questions')
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName) {
      toast.error('Please enter a template name');
      return;
    }
    saveTemplate({ name: templateName, is_default: isDefaultTemplate, questions: formatQuestionsForSave() }, {
      onSuccess: () => {
         toast.success('Template saved globally!');
         setTemplateName('');
         setIsDefaultTemplate(false);
      },
      onError: () => toast.error('Failed to save template')
    });
  };

  const loadTemplate = (templateArr: any[]) => {
    setQuestions(templateArr);
    toast.success('Template loaded into editor');
  };
  
  const handleSaveAnswers = () => {
    if (!selectedMatchId) return;
    updateResults({ matchId: selectedMatchId, answers }, {
      onSuccess: () => toast.success('Answers saved! Match scored!'),
      onError: () => toast.error('Failed to save answers')
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 relative">
      <header className="flex justify-between items-end border-b-2 border-white/10 pb-4">
        <div>
          <h1 className="text-3xl font-display text-purple-400 flex items-center gap-3">
            <HelpCircle className="w-8 h-8" />
            Question Definitions
          </h1>
          <p className="text-gray-400 mt-1 uppercase text-xs tracking-[0.2em]">Build match templates and scoring logic</p>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-1 space-y-6">
          {/* Match Selection Area */}
          <div className="glass-panel p-6 border-t-2 border-t-purple-500">
             <h2 className="text-lg font-display text-white mb-4 uppercase tracking-widest">Target Match</h2>
             <select
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-xs font-display uppercase tracking-widest appearance-none"
             >
              <option value="">— Working Independently —</option>
              {matches?.map(m => (
                <option key={m.id} value={m.id}>
                  {m.status === 'completed' ? '🏁 ' : (m.status === 'live' ? '🔴 ' : '⏳ ')}
                  {m.team1} v {m.team2}
                </option>
              ))}
            </select>
            {selectedMatchId && (
              <button
                onClick={handleSaveToMatch}
                disabled={isUpdatingQuestions || questions.length === 0}
                className="mt-4 w-full bg-purple-500 text-white py-3 font-display uppercase tracking-widest hover:bg-purple-400 disabled:opacity-50"
              >
                {isUpdatingQuestions ? 'Saving...' : 'Deploy to Select Match'}
              </button>
            )}
            
            {selectedMatchId && selectedMatch?.status !== 'upcoming' && (
               <div className="mt-6 border-t border-white/10 pt-4">
                 <h3 className="text-green-400 font-display uppercase tracking-widest mb-3 text-xs">
                   Enter Official Answers
                 </h3>
                 <div className="space-y-3">
                   {questions.map((q) => (
                      <div key={q.id}>
                         <label className="text-[10px] text-gray-500 font-display uppercase">{q.question}</label>
                         <input
                           type={q.type === 'number' ? 'number' : 'text'}
                           className="w-full bg-black/40 border border-white/10 p-2 text-white text-xs"
                           value={answers[q.id] || ''}
                           onChange={(e) => setAnswers({...answers, [q.id]: e.target.value})}
                         />
                      </div>
                   ))}
                 </div>
                 <button
                   onClick={handleSaveAnswers}
                   disabled={isUpdatingResults}
                   className="mt-4 w-full bg-green-500/20 border border-green-500 text-green-400 py-3 font-display text-xs uppercase tracking-widest hover:bg-green-500 hover:text-white"
                 >
                   Run Match Scoring
                 </button>
               </div>
            )}
          </div>

          {/* Global Templates Setup */}
          <div className="glass-panel p-6 border-t-2 border-t-blue-500">
             <h2 className="text-lg font-display text-white mb-4 uppercase tracking-widest">Library</h2>
             <div className="space-y-2 mb-6 max-h-[200px] overflow-y-auto custom-scrollbar">
               {templates?.map((t: any) => (
                  <button 
                     key={t.id} 
                     onClick={() => loadTemplate(t.questions_json)}
                     className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex items-center justify-between"
                  >
                     <div>
                        <p className="text-white font-display text-sm tracking-wide">{t.name}</p>
                        <p className="text-[10px] text-gray-500">{t.questions_json.length} QUESTIONS</p>
                     </div>
                     {t.is_default && <span className="bg-blue-500/20 text-blue-400 text-[9px] px-2 py-1 font-display tracking-widest rounded">DEFAULT</span>}
                  </button>
               ))}
               {(!templates || templates.length === 0) && <p className="text-gray-500 text-xs italic">No templates saved yet</p>}
             </div>

             <div className="border-t border-white/10 pt-6 space-y-3">
                <input 
                  className="w-full bg-black/40 border border-white/10 p-3 text-white text-sm" 
                  placeholder="New Template Name"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isDefaultTemplate} onChange={e => setIsDefaultTemplate(e.target.checked)} className="form-checkbox"/>
                  <span className="text-xs text-gray-400 uppercase tracking-widest">Set As Global Default</span>
                </label>
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSavingTemplate}
                  className="w-full flex items-center justify-center gap-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 py-3 uppercase tracking-widest font-bold hover:bg-blue-500 hover:text-white transition-all"
                >
                  <Save className="w-4 h-4"/> {isSavingTemplate ? 'Saving...' : 'Save As Template'}
                </button>
             </div>
          </div>
        </section>

        {/* Question Array Builder */}
        <section className="lg:col-span-2 glass-panel p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-display uppercase tracking-widest text-white">
               Question Configurator
            </h3>
            <button onClick={addQuestion} className="bg-white/10 text-white hover:bg-white hover:text-black px-4 py-2 flex items-center gap-2 text-xs transition-colors font-display uppercase tracking-widest">
              <Plus className="w-4 h-4" /> Add Output
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 border border-white/10 bg-black/20 group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-8 h-[2px] bg-purple-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 
                <div className="md:col-span-3">
                  <label className="text-[9px] font-display text-gray-500 uppercase tracking-widest">System ID</label>
                  <input className="w-full bg-transparent border-b border-white/20 p-2 text-white text-xs focus:outline-none focus:border-purple-500" value={q.id} onChange={e => updateQuestion(idx, 'id', e.target.value)} />
                </div>
                <div className="md:col-span-5">
                  <label className="text-[9px] font-display text-gray-500 uppercase tracking-widest">Question Prompt</label>
                  <input className="w-full bg-transparent border-b border-white/20 p-2 text-white text-xs focus:outline-none focus:border-purple-500" value={q.question} onChange={e => updateQuestion(idx, 'question', e.target.value)} />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[9px] font-display text-gray-500 uppercase tracking-widest">Input Type</label>
                  <select className="w-full bg-transparent border-b border-white/20 p-2 text-gray-300 text-xs focus:outline-none focus:border-purple-500" value={q.type} onChange={e => updateQuestion(idx, 'type', e.target.value)}>
                    <option value="dropdown">Dropdown</option>
                    <option value="selection">Selection Config</option>
                    <option value="number">Number Rating</option>
                    <option value="multi_answers">Multiple Answers</option>
                    <option value="single_answer">Single Term Input</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-[9px] font-display text-green-500 uppercase tracking-widest">✅ Correct Pts</label>
                  <input type="number" className="w-full bg-white/5 border border-white/5 p-2 text-green-400 text-xs focus:outline-none" value={q.points} onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value) || 0)} />
                </div>
                 <div className="md:col-span-2">
                  <label className="text-[9px] font-display text-red-500 uppercase tracking-widest">❌ Incorrect Pts</label>
                  <input type="number" className="w-full bg-white/5 border border-white/5 p-2 text-red-400 text-xs focus:outline-none" value={q.negative_points} onChange={e => updateQuestion(idx, 'negative_points', parseInt(e.target.value) || 0)} />
                </div>
                
                {(q.type === 'dropdown' || q.type === 'selection' || q.type === 'multi_answers') && (
                  <div className="md:col-span-7">
                    <label className="text-[9px] font-display text-blue-400 uppercase tracking-widest">Selection Options (comma sep)</label>
                    <input className="w-full bg-blue-500/5 border border-blue-500/20 p-2 text-white text-xs focus:outline-none focus:border-blue-400" value={Array.isArray(q.options) ? q.options.join(', ') : q.options} onChange={e => updateQuestion(idx, 'options', e.target.value)} placeholder="E.g. Yes, No, Maybe" />
                  </div>
                )}
                
                <button 
                   onClick={() => removeQuestion(idx)} 
                   className="absolute top-3 right-3 text-white/30 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {questions.length === 0 && (
               <div className="mt-10 text-center">
                 <p className="text-gray-500 font-display uppercase tracking-widest text-xs">Canvas is empty.</p>
                 <p className="text-gray-600 mt-2 text-[10px]">Add a question or load a template from the library.</p>
               </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
