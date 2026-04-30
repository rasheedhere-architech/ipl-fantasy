import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface Match {
  id: string;
  team1: string;
  team2: string;
  venue: string;
  tossTime: string;       // ISO string, used for lock calculation
  start_time: string;     // raw datetime from backend
  status: 'upcoming' | 'live' | 'completed';
  winner?: string;
  team1_powerplay_score?: number;
  team2_powerplay_score?: number;
  player_of_the_match?: string;
  reported_by_name?: string;
  reported_by_email?: string;
  report_method?: string;
}

export function useMyPredictionStatus() {
  return useQuery({
    queryKey: ['predictions', 'mine', 'status'],
    queryFn: async () => {
      const response = await apiClient.get<string[]>('/matches/my/prediction-status');
      return response.data;
    },
  });
}

export function useMatches(tournamentId?: string) {
  return useQuery({
    queryKey: ['matches', tournamentId],
    queryFn: async () => {
      const response = await apiClient.get<Match[]>('/matches', {
        params: { tournament_id: tournamentId }
      });
      return response.data;
    },
  });
}

export function useMatch(id: string) {
  return useQuery({
    queryKey: ['matches', id],
    queryFn: async () => {
      const response = await apiClient.get(`/matches/${id}`);
      return response.data;
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
      queryClient.invalidateQueries({ queryKey: ['predictions', 'mine', 'status'] });
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

export function useLeaderboard(leagueId?: string) {
  return useQuery({
    queryKey: ['leaderboard', leagueId],
    queryFn: async () => {
      let url = '/leaderboard';
      if (leagueId) {
        if (leagueId.endsWith('-global')) {
          const tournamentId = leagueId.replace('-global', '');
          url = `/tournaments/${tournamentId}/leaderboard`;
        } else {
          url = `/leaderboard?league_id=${leagueId}`;
        }
      }
      const response = await apiClient.get(url);
      return response.data;
    },
  });
}

export function useMyLeagues() {
  return useQuery({
    queryKey: ['my-leagues'],
    queryFn: async () => {
      const response = await apiClient.get('/leaderboard/my-leagues');
      return response.data;
    },
  });
}

export function useAnalysis() {
  return useQuery({
    queryKey: ['analysis'],
    queryFn: async () => {
      const response = await apiClient.get(`/leaderboard/analysis`);
      return response.data;
    },
  });
}

export function useMatchPodiums() {
  return useQuery({
    queryKey: ['match-podiums'],
    queryFn: async () => {
      const response = await apiClient.get(`/leaderboard/match-podiums`);
      return response.data;
    },
  });
}

