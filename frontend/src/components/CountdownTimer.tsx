import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string; // ISO string
}

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!targetDate) {
      setTimeLeft('TBD');
      return;
    }

    const lockDate = new Date(targetDate);
    if (isNaN(lockDate.getTime())) {
      setTimeLeft('TBD');
      return;
    }

    const lockTime = lockDate.getTime() - 30 * 60 * 1000;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = lockTime - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeft('LOCKED');
        setIsLocked(true);
        setUrgent(false);
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setUrgent(distance < 60 * 60 * 1000); // Less than 1 hour -> urgent
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className={`flex items-center gap-2 font-display tracking-widest text-sm
      ${isLocked ? 'text-ipl-live' : urgent ? 'text-ipl-live animate-pulse' : 'text-ipl-gold'}`}
    >
      <Clock className="w-4 h-4" />
      {isLocked ? 'PREDICTIONS LOCKED' : `LOCKS IN: ${timeLeft}`}
    </div>
  );
}
