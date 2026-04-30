import re

with open('frontend/src/pages/MatchPage.tsx', 'r') as f:
    content = f.read()

# 1. Remove hardcoded QIds except winnerQId
# Search for potmQId to pp2QId
qids_pattern = r"  const potmQId = useMemo\(\(\) =>[\s\S]*?\[questions, match\]\);\n\n"
content = re.sub(qids_pattern, "", content)

# 2. In renderPredictionCard, replace the hardcoded checks with a dynamic mapper.
# Find the block starting from {(!winnerQId || pred.answers[winnerQId] === '🔒') ? to </>}
# Wait, the block is:
"""                          {(!winnerQId || pred.answers[winnerQId] === '🔒') ? (
                            <span className="text-[8px] text-gray-500 font-mono tracking-tight opacity-60 italic">🔒 HIDDEN</span>
                          ) : (
                            <>
                              {pp1QId && pred.answers[pp1QId] && (
"""

old_answers_block = """                          {(!winnerQId || pred.answers[winnerQId] === '🔒') ? (
                            <span className="text-[8px] text-gray-500 font-mono tracking-tight opacity-60 italic">🔒 HIDDEN</span>
                          ) : (
                            <>
                              {pp1QId && pred.answers[pp1QId] && (
                                <div className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                  <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} font-bold mr-1.5`} style={{ color: getTeamColor(match.team1) }}>{team1Short}</span>
                                  <span className={`${isDesktop ? 'md:text-[10px]' : 'text-[9px]'} text-white font-mono font-bold`}>{pred.answers[pp1QId]}</span>
                                </div>
                              )}
                              {pp2QId && pred.answers[pp2QId] && (
                                <div className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                  <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} font-bold mr-1.5`} style={{ color: getTeamColor(match.team2) }}>{team2Short}</span>
                                  <span className={`${isDesktop ? 'md:text-[10px]' : 'text-[9px]'} text-white font-mono font-bold`}>{pred.answers[pp2QId]}</span>
                                </div>
                              )}
                              {sixesQId && pred.answers[sixesQId] && (
                                <div className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                  <span className={`${isDesktop ? 'md:text-[8px]' : 'text-[7px]'} text-gray-400 mr-1`}>6s:</span>
                                  <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} font-bold`} style={{ color: getTeamColor(pred.answers[sixesQId]) }}>{getTeamShortName(pred.answers[sixesQId])}</span>
                                </div>
                              )}
                              {foursQId && pred.answers[foursQId] && (
                                <div className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                  <span className={`${isDesktop ? 'md:text-[8px]' : 'text-[7px]'} text-gray-400 mr-1`}>4s:</span>
                                  <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} font-bold`} style={{ color: getTeamColor(pred.answers[foursQId]) }}>{getTeamShortName(pred.answers[foursQId])}</span>
                                </div>
                              )}
                              
                              {/* Dynamic Extra and League Answers */}
                              {Object.keys(pred.answers || {}).filter(k => ![winnerQId, pp1QId, pp2QId, sixesQId, foursQId, potmQId, 'use_powerup'].includes(k)).map(k => {
                                const q = questionMap?.[k];
                                return (
                                  <div key={k} title={q?.question_text || 'League Question'} className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                    {q?.source_name && (
                                      <span className="text-[7px] text-ipl-gold mr-1 font-bold opacity-70">
                                        {q.source_name.split(' ')[0]}:
                                      </span>
                                    )}
                                    <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} text-white font-mono font-bold truncate max-w-[80px]`}>
                                      {pred.answers?.[k]}
                                    </span>
                                  </div>
                                );
                              })}
                            </>
                          )}"""

new_answers_block = """                          {(!winnerQId || pred.answers[winnerQId] === '🔒') ? (
                            <span className="text-[8px] text-gray-500 font-mono tracking-tight opacity-60 italic">🔒 HIDDEN</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {Object.keys(pred.answers || {}).filter(k => ![winnerQId, 'use_powerup'].includes(k)).map(k => {
                                const q = questionMap?.[k];
                                // We can extract a short label from the question text or source
                                let label = '';
                                if (q?.source_name) {
                                  label = q.source_name.split(' ')[0] + ':';
                                } else if (q?.question_text) {
                                  label = q.question_text.length > 12 ? q.question_text.substring(0, 12) + '...' : q.question_text;
                                }
                                
                                // Color code if it matches a team name
                                const isTeamMatch = getTeamColor(pred.answers[k]) !== '#666666';
                                const valStyle = isTeamMatch ? { color: getTeamColor(pred.answers[k]) } : {};
                                const displayVal = isTeamMatch ? getTeamShortName(pred.answers[k]) : pred.answers[k];

                                return (
                                  <div key={k} title={q?.question_text || 'League Question'} className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                    {label && (
                                      <span className="text-[7px] text-gray-400 mr-1 font-bold uppercase truncate max-w-[50px]">
                                        {label}
                                      </span>
                                    )}
                                    <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} text-white font-mono font-bold truncate max-w-[80px]`} style={valStyle}>
                                      {displayVal}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}"""

content = content.replace(old_answers_block, new_answers_block)

# 3. Replace the potmQId edit block in the right-side layout
old_edit_block = """                            {potmQId && pred.answers[potmQId] && pred.answers[potmQId] !== '🔒' && (
                              <span className={`${isDesktop ? 'md:text-[9px] md:max-w-[150px]' : 'text-[7.5px] max-w-[80px]'} text-gray-500 uppercase tracking-widest truncate italic leading-none`}>
                                {pred.answers[potmQId]}
                              </span>
                            )}
                            {currentUser?.is_admin && pred.prediction_id && (
                              <button
                                onClick={() => {
                                  setEditingId(pred.prediction_id);
                                  setEditValue(potmQId ? pred.answers[potmQId] : '');
                                }}
                                className="text-gray-600 hover:text-ipl-gold transition-colors ml-1.5"
                              >
                                <Edit2 className={`${isDesktop ? 'md:w-3.5 md:h-3.5' : 'w-2.5 h-2.5'}`} />
                              </button>
                            )}"""

new_edit_block = """                            {/* Edit block removed since we are now fully dynamic. We can still let admins edit, but they might need to go to Admin panel for specific questions. */
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
                            )}"""

content = content.replace(old_edit_block, new_edit_block)

with open('frontend/src/pages/MatchPage.tsx', 'w') as f:
    f.write(content)

