import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface SystemEvent {
  id: string;
  event_type: string;
  timestamp: string;
  user_id: string | null;
  username: string;
  user_avatar: string | null;
  league_id: string | null;
  match_id: string | null;
  message: string;
  payload: any;
}

export function useEvents(limit = 20) {
  return useQuery<SystemEvent[]>({
    queryKey: ['system-events', limit],
    queryFn: async () => {
      const response = await apiClient.get('/events', {
        params: { limit },
      });
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
