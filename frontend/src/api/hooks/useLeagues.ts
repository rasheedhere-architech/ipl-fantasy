import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface LeagueParticipant {
  id: string;
  name: string;
  avatar_url: string;
  joined_at: string;
  remaining_powerups: number;
  is_league_admin: boolean;
}

export interface League {
  id: string;
  name: string;
  tournament_id: string;
  is_admin: boolean;
  join_code: string | null;
  starting_powerups: number;
  participants: LeagueParticipant[];
}

export interface LeagueListItem {
  id: string;
  name: string;
  tournament_id: string;
  is_admin: boolean;
  join_code: string | null;
  created_at: string;
}

export function useMyLeagues() {
  return useQuery({
    queryKey: ['leagues', 'mine'],
    queryFn: async () => {
      const response = await apiClient.get<LeagueListItem[]>('/leagues');
      return response.data;
    },
  });
}

export function useLeagueDetails(leagueId: string) {
  return useQuery({
    queryKey: ['leagues', leagueId],
    queryFn: async () => {
      const response = await apiClient.get<League>(`/leagues/${leagueId}`);
      return response.data;
    },
    enabled: !!leagueId,
  });
}

export function useCreateLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; tournament_id: string; starting_powerups?: number }) => {
      const response = await apiClient.post('/leagues', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues', 'mine'] });
    },
  });
}

export function useJoinLeague() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (joinCode: string) => {
      const response = await apiClient.post('/leagues/join', { join_code: joinCode });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues', 'mine'] });
    },
  });
}

export function useKickMember(leagueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.delete(`/leagues/${leagueId}/members/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues', leagueId] });
    },
  });
}

export function useRefreshJoinCode(leagueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/leagues/${leagueId}/refresh_code`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['leagues', 'mine'] });
    },
  });
}

export function useToggleLeagueAdmin(leagueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string, isAdmin: boolean }) => {
      const response = await apiClient.put(`/leagues/${leagueId}/members/${userId}/admin`, { is_admin: isAdmin });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leagues', leagueId] });
    },
  });
}
