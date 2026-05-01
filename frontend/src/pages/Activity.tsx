import React from 'react';
import SocialFeed from '../components/SocialFeed';
import { Activity as ActivityIcon } from 'lucide-react';

const Activity: React.FC = () => {
  return (
    <div className="w-full max-w-full min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold text-ipl-gold flex items-center gap-3">
            <ActivityIcon className="w-8 h-8" />
            PLATFORM ACTIVITY
          </h1>
          <p className="text-white/60">
            Stay updated with predictions, league joins, and match results from across the tournament.
          </p>
        </div>

        <div className="bg-ipl-surface/50 backdrop-blur-xl rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-white/5 bg-white/5">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Recent Events
              <span className="text-xs font-normal text-white/40 bg-white/5 px-2 py-1 rounded-full border border-white/10">
                Live
              </span>
            </h2>
          </div>
          <div className="p-4">
            <SocialFeed />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-2">Visibility Info</h3>
            <ul className="text-sm text-white/60 space-y-2">
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-ipl-gold" />
                You see your own activity across all matches.
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-ipl-gold" />
                You see activity from users who share a league with you.
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-ipl-gold" />
                Global match results and platform updates are public.
              </li>
            </ul>
          </div>
          
          <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-2">Privacy & Roles</h3>
            <p className="text-sm text-white/60">
              League admins have oversight of activity within their specific leagues. Global admins can view all platform telemetry for auditing and support purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Activity;
