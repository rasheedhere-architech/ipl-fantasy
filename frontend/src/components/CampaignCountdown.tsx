import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function CampaignCountdown({ endsAt, showIcon = true, hidePrefix = false }: { endsAt: string, showIcon?: boolean, hidePrefix?: boolean }) {
  const [timeLeft, setTimeLeft] = useState('');
  
  useEffect(() => {
    const endMs = new Date(endsAt).getTime();
    
    const tick = () => {
      const distance = endMs - new Date().getTime();
      if (distance <= 0) {
        setTimeLeft('CLOSED');
        return false;
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((distance % (1000 * 60)) / 1000);
      
      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      parts.push(`${mins}m`);
      parts.push(`${secs}s`);
      setTimeLeft(parts.join(' '));
      return true;
    };

    if (tick()) {
      const interval = setInterval(() => {
        if (!tick()) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [endsAt]);

  if (!timeLeft) return null;
  
  const isUrgent = !timeLeft.includes('d') && !timeLeft.includes('h');
  const color = timeLeft === 'CLOSED' ? 'text-gray-500' : isUrgent ? 'text-ipl-live animate-pulse' : 'text-ipl-gold';

  return (
    <span className={`inline-flex items-center gap-1.5 ${color} font-display ml-1`}>
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      {timeLeft !== 'CLOSED' ? `${hidePrefix ? '' : 'CLOSES IN '}${timeLeft}` : 'CLOSED'}
    </span>
  );
}
