import React from 'react';
import { useEvents, type SystemEvent } from '../api/hooks/useEvents';
import { useNavigate } from 'react-router-dom';

const timeAgo = (date: string | Date) => {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const SocialFeed: React.FC = () => {
  const { data: events, isLoading } = useEvents(15);
  const navigate = useNavigate();

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'prediction_submitted':
        return '🎯';
      case 'match_scored':
        return '📊';
      case 'league_joined':
        return '🤝';
      case 'login':
        return '👋';
      default:
        return '📢';
    }
  };

  const handleEventClick = (event: SystemEvent) => {
    if (event.match_id) {
      navigate(`/match/${event.match_id}`);
    }
  };

  const renderTime = (timestamp: string) => {
    try {
      return timeAgo(timestamp);
    } catch (e) {
      return 'just now';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white/5 rounded-xl border border-white/10" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="p-8 text-center text-white/40 italic">
        No recent activity found.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2 overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
      {events.map((event) => (
        <div
          key={event.id}
          onClick={() => handleEventClick(event)}
          className={`
            group flex gap-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer
            ${event.match_id ? 'hover:bg-white/10 hover:scale-[1.02]' : 'hover:bg-white/5'}
            bg-white/5 border-white/10 hover:border-ipl-gold/30
          `}
        >
          <div className="relative shrink-0">
            {event.user_avatar ? (
              <img
                src={event.user_avatar}
                alt={event.username}
                className="w-10 h-10 rounded-full border border-white/20 shadow-lg"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-ipl-navy to-ipl-gold/20 flex items-center justify-center border border-white/20">
                <span className="text-sm font-bold text-ipl-gold">
                  {event.username.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1e1e1e] border border-white/10 flex items-center justify-center text-[10px] shadow-md group-hover:scale-110 transition-transform">
              {getEventIcon(event.event_type)}
            </div>
          </div>

          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white/90 text-sm truncate">
                {event.username}
              </span>
              <span className="text-[10px] text-white/40 whitespace-nowrap">
                {renderTime(event.timestamp)}
              </span>
            </div>
            <p className="text-xs text-white/70 leading-snug break-words">
              {event.message}
            </p>
          </div>

          {event.match_id && (
            <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-6 h-6 rounded-full bg-ipl-gold/10 flex items-center justify-center text-ipl-gold">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SocialFeed;
