import re

with open('frontend/src/pages/MatchPage.tsx', 'r') as f:
    content = f.read()

# 1. Change max-w-4xl to max-w-7xl (or w-full)
content = content.replace('max-w-4xl mx-auto', 'max-w-[1600px] mx-auto w-full px-2 md:px-6')

# 2. Update the label generation to not shorten the string
old_label_logic = """                                        // We can extract a short label from the question text or source
                                        let label = '';
                                        if (q?.source_name) {
                                          label = q.source_name.split(' ')[0] + ':';
                                        } else if (q?.question_text) {
                                          label = q.question_text.length > 12 ? q.question_text.substring(0, 12) + '...' : q.question_text;
                                        }"""

new_label_logic = """                                        let label = q?.question_text || '';
                                        if (q?.source_name && q.source_name !== 'IPL Global') {
                                          label = `${q.source_name}: ${label}`;
                                        }"""

content = content.replace(old_label_logic, new_label_logic)

# 3. Update the JSX for the answers to remove truncation
old_answer_jsx = """                                          <div key={k} title={q?.question_text || 'League Question'} className={`flex items-center bg-white/5 border border-white/10 rounded px-1.5 py-0.5 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                            {label && (
                                              <span className="text-[7px] text-gray-400 mr-1 font-bold uppercase truncate max-w-[50px]">
                                                {label}
                                              </span>
                                            )}
                                            <span className={`${isDesktop ? 'md:text-[9px]' : 'text-[8px]'} text-white font-mono font-bold truncate max-w-[80px]`} style={valStyle}>
                                              {displayVal}
                                            </span>
                                          </div>"""

new_answer_jsx = """                                          <div key={k} className={`flex items-center bg-white/5 border border-white/10 rounded px-2 py-1 leading-none ${isDesktop ? 'md:bg-black/40' : ''}`}>
                                            {label && (
                                              <span className="text-[8px] text-gray-400 mr-1.5 font-bold uppercase whitespace-normal break-words max-w-[150px]">
                                                {label}
                                              </span>
                                            )}
                                            <span className={`${isDesktop ? 'md:text-[10px]' : 'text-[9px]'} text-white font-mono font-bold whitespace-nowrap`} style={valStyle}>
                                              {displayVal}
                                            </span>
                                          </div>"""

content = content.replace(old_answer_jsx, new_answer_jsx)

with open('frontend/src/pages/MatchPage.tsx', 'w') as f:
    f.write(content)

