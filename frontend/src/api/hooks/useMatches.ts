import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface Match {
  id: string;
  team1: string;
  team2: string;
  venue: string;
  tossTime: string;
  status: 'upcoming' | 'live' | 'completed';
}

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const response = await apiClient.get<Match[]>('/matches');
      return response.data.map(match => ({
        ...match,
        tossTime: (match as any).toss_time
      })) as Match[];
    },
  });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ['matches', id],
    queryFn: async () => {
      const response = await apiClient.get(`/matches/${id}`);
      const data = response.data;
      if (data.match) {
        data.match.tossTime = data.match.toss_time;
      }
      return data;
    },
    enabled: !!id,
  });
}

export function useSubmitPrediction(matchId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      // Flattened structure: no longer wrapping in { answers: ... }
      const response = await apiClient.post(`/matches/${matchId}/predictions`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions', matchId] });
      queryClient.invalidateQueries({ queryKey: ['predictions', 'mine', matchId] });
    },
  });
}

export function useMyPredictions(matchId: string) {
  return useQuery({
    queryKey: ['predictions', 'mine', matchId],
    queryFn: async () => {
      const response = await apiClient.get(`/matches/${matchId}/predictions/mine`);
      return response.data;
    },
    enabled: !!matchId,
  });
}

export function useAllMatchPredictions(matchId: string) {
  return useQuery({
    queryKey: ['predictions', 'all', matchId],
    queryFn: async () => {
      const response = await apiClient.get(`/matches/${matchId}/predictions/all`);
      return response.data;
    },
    enabled: !!matchId,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await apiClient.get(`/leaderboard`);
      return response.data;
    },
  });
}
