import re

with open('frontend/src/pages/MatchPage.tsx', 'r') as f:
    content = f.read()

# 1. Replace allPredictions variable name
content = content.replace("const { data: allPredictions } = useAllMatchPredictions(id || '');", "const { data: leagueSections } = useAllMatchPredictions(id || '');")

# 2. Update sortedPredictions to be a helper function
old_sorted_preds = """  const sortedPredictions = useMemo(() => {
    if (!allPredictions || !match) return [];
    return [...allPredictions].sort((a, b) => {
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
  }, [allPredictions, match, winnerQId]);"""

new_sorted_preds = """  const getSortedPredictions = (predictions: any[]) => {
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
  };"""

content = content.replace(old_sorted_preds, new_sorted_preds)

# 3. Restructure the JSX for the community reveal section
# We'll use regex to replace the community reveal block.
# Wait, this block starts at <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
# and ends right before {/* ADMIN ZONE */}
old_reveal_block = """      <div className="glass-panel p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
            {(() => {"""

new_reveal_block = """      <div className="space-y-12">
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
                    {(() => {"""

content = content.replace(old_reveal_block, new_reveal_block)

# 4. We also need to add closing tags for the leagueSections map loop at the end of the block.
old_end_block = """            })()}
          </div>
        )}
      </div>

      {/* ADMIN ZONE */}"""

new_end_block = """            })()}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ADMIN ZONE */}"""

content = content.replace(old_end_block, new_end_block)

with open('frontend/src/pages/MatchPage.tsx', 'w') as f:
    f.write(content)
