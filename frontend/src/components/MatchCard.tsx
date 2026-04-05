import { Link } from 'react-router-dom';
import CountdownTimer from './CountdownTimer';
import { MapPin } from 'lucide-react';

interface MatchCardProps {
  id: string;
  team1: string;
  team2: string;
  venue: string;
  tossTime: string;
  status: 'upcoming' | 'live' | 'completed';
}

const teamColors: Record<string, string> = {
  MI: '#004BA0',
  CSK: '#F4C430',
  RCB: '#CC0000',
  KKR: '#552583',
  DC: '#0078BC',
  RR: '#E91E8C',
  PBKS: '#AA0000',
  SRH: '#FF6600',
  GT: '#1B6CA8',
  LSG: '#00ADEF',
};

export default function MatchCard({ id, team1, team2, venue, tossTime, status }: MatchCardProps) {
  const t1Color = teamColors[team1] || '#ffffff';
  const t2Color = teamColors[team2] || '#ffffff';

  return (
    <div className="glass-panel neon-border p-6 relative flex flex-col justify-between group overflow-hidden">
      {status === 'live' && (
        <div className="absolute top-0 right-0 bg-ipl-live text-white font-display text-xs tracking-widest px-3 py-1 shadow-[0_0_10px_#E84040] animate-pulse">
          LIVE
        </div>
      )}
      
      <div className="flex justify-between items-center mb-8 relative z-10 w-full">
        <div className="flex flex-col items-center flex-1">
          <span className="text-4xl font-display transition-transform group-hover:scale-110" style={{ color: t1Color, textShadow: `0 0 15px ${t1Color}80` }}>
            {team1}
          </span>
        </div>
        
        <div className="text-gray-600 font-display text-xl mx-4 italic">VS</div>
        
        <div className="flex flex-col items-center flex-1">
          <span className="text-4xl font-display transition-transform group-hover:scale-110" style={{ color: t2Color, textShadow: `0 0 15px ${t2Color}80` }}>
            {team2}
          </span>
        </div>
      </div>
      
      <div className="mb-6 space-y-2 relative z-10">
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-white/50" />
          {venue}
        </p>
        {status !== 'completed' && <CountdownTimer targetDate={tossTime} />}
      </div>
      
      <Link
        to={`/match/${id}`}
        className="w-full text-center bg-white/5 hover:bg-white hover:text-black text-white font-display uppercase tracking-widest py-3 border border-white/20 transition-all z-10 relative"
      >
        {status === 'upcoming' ? 'Predict Now' : 'View Match'}
      </Link>
    </div>
  );
}
