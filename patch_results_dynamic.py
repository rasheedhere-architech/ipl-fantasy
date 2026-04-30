import re

with open('frontend/src/pages/MatchPage.tsx', 'r') as f:
    content = f.read()

# 1. Remove team1Short and team2Short declarations in renderPredictionCard
old_team_shorts = """                const teamWinnerShort = winnerAns === '🔒' ? '🔒' : getTeamShortName(winnerAns);
                const team1Short = getTeamShortName(match.team1);
                const team2Short = getTeamShortName(match.team2);"""

new_team_shorts = """                const teamWinnerShort = winnerAns === '🔒' ? '🔒' : getTeamShortName(winnerAns);"""
content = content.replace(old_team_shorts, new_team_shorts)


# 2. Replace the static results block with a dynamic map over match.results
# The static block starts at line 377:
# <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
#   <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
#     <Target className="w-24 h-24 text-ipl-gold" />
# ... up to the end of foursQId block.

# Let's define the old block to be replaced
old_results_block = """            <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Target className="w-24 h-24 text-ipl-gold" />
              </div>
              <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4 font-normal">Power Play Scores</label>
              <div className="flex items-center gap-4">
                <div className="bg-white/5 p-4 border border-white/10">
                  <label className="block text-[10px] font-display text-gray-500 uppercase tracking-widest mb-1">{match.team1}</label>
                  <div className="text-3xl font-display text-white">{match?.results?.[pp1QId] ?? '-'}</div>
                </div>
                <div className="bg-white/5 p-4 border border-white/10">
                  <label className="block text-[10px] font-display text-gray-500 uppercase tracking-widest mb-1">{match.team2}</label>
                  <div className="text-3xl font-display text-white">{match?.results?.[pp2QId] ?? '-'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Award className="w-24 h-24 text-ipl-gold" />
              </div>
              <div className="bg-white/5 p-6 border border-white/10 text-center">
                <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-2">Player of the Match</label>
                <div className="text-2xl font-display text-white tracking-wide uppercase">{match?.results?.[potmQId] || 'TBD'}</div>
              </div>
            </div>

            {sixesQId && match.results[sixesQId] && (
              <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
                <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">More Sixes</label>
                <div className="text-2xl font-display text-white tracking-wide uppercase" style={{ color: getTeamColor(match.results[sixesQId]) }}>{match.results[sixesQId]}</div>
              </div>
            )}

            {foursQId && match.results[foursQId] && (
              <div className="bg-white/5 p-6 border border-white/10 relative overflow-hidden group">
                <label className="block text-[10px] font-display text-ipl-gold uppercase tracking-[0.2em] mb-4">More Fours</label>
                <div className="text-2xl font-display text-white tracking-wide uppercase" style={{ color: getTeamColor(match.results[foursQId]) }}>{match.results[foursQId]}</div>
              </div>
            )}"""

new_results_block = """            {Object.keys(match?.results || {}).filter(k => k !== winnerQId).map(k => {
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
            })}"""

content = content.replace(old_results_block, new_results_block)

with open('frontend/src/pages/MatchPage.tsx', 'w') as f:
    f.write(content)
