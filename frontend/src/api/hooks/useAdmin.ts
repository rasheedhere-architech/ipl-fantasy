import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface AllowlistEntry {
  email: string;
  is_guest: boolean;
  added_at: string;
  id?: number;
}

export function useAllowlist() {
  return useQuery({
    queryKey: ['admin', 'allowlist'],
    queryFn: async () => {
      const response = await apiClient.get<AllowlistEntry[]>('/admin/allowlist');
      return response.data;
    },
  });
}

export function useAddAllowlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ emails, isGuest }: { emails: string[]; isGuest: boolean }) => {
      const response = await apiClient.post('/admin/allowlist', { emails, is_guest: isGuest });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'allowlist'] });
    },
  });
}

export function useDeleteAllowlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await apiClient.delete(`/admin/allowlist/${encodeURIComponent(email)}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'allowlist'] });
    },
  });
}

export function useUpdateMatchResults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, answers }: { matchId: string; answers: any }) => {
      const response = await apiClient.put(`/admin/matches/${matchId}/results`, { answers });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
export function useAllUsers() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>('/admin/users');
      return response.data;
    },
  });
}

export function useUpdateBasePoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, basePoints, basePowerups, isTelegramAdmin, telegramUsername }: { userId: string; basePoints: number; basePowerups: number; isTelegramAdmin: boolean; telegramUsername?: string }) => {
      const response = await apiClient.put(`/admin/users/${userId}/base-points`, { 
        base_points: basePoints, 
        base_powerups: basePowerups,
        is_telegram_admin: isTelegramAdmin,
        telegram_username: telegramUsername
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useTriggerAIPredictions() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/admin/trigger-ai-predictions');
      return response.data;
    },
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>('/tournaments');
      return response.data;
    },
  });
}

export function useAllLeagues() {
  return useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: async () => {
      // Assuming we'll add this endpoint or reuse existing one for admin
      const response = await apiClient.get<any[]>('/leagues'); 
      return response.data;
    },
  });
}

export function useTournamentLeagues(tournamentId: string) {
  return useQuery({
    queryKey: ['tournaments', tournamentId, 'leagues'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>(`/tournaments/${tournamentId}/leagues`);
      return response.data;
    },
    enabled: !!tournamentId
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; name: string; starts_at?: string; ends_at?: string }) => {
      const response = await apiClient.post('/tournaments', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });
}

export function useCreateMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; team1: string; team2: string; venue: string; start_time: string; tournament_id: string }) => {
      const response = await apiClient.post('/matches', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useAddLeagueMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leagueId, userId }: { leagueId: string; userId: string }) => {
      const response = await apiClient.post(`/leagues/${leagueId}/members`, { user_id: userId });
      return response.data;
    },
    onSuccess: (_, { leagueId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leagues'] });
      queryClient.invalidateQueries({ queryKey: ['leagues', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

export function useBulkImportMatches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tournamentId, file }: { tournamentId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post(`/tournaments/${tournamentId}/bulk-import-matches`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
