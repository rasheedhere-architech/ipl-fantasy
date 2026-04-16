import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface AllowlistEntry {
  email: string;
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
    mutationFn: async (emails: string[]) => {
      const response = await apiClient.post('/admin/allowlist', { emails });
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

export function useTemplatesV2() {
  return useQuery({
    queryKey: ['templates_v2'],
    queryFn: async () => {
      const response = await apiClient.get<any[]>('/admin/v2/templates');
      return response.data;
    },
  });
}

export function useSaveTemplateV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; is_default: boolean; questions: any[] }) => {
      const response = await apiClient.post('/admin/v2/templates', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates_v2'] });
    },
  });
}

export function useUpdateMatchQuestionsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, questions }: { matchId: string; questions: any }) => {
      const response = await apiClient.put(`/admin/v2/matches/${matchId}/questions`, { questions });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches_v2'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useUpdateMatchResultsV2() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, answers }: { matchId: string; answers: any }) => {
      const response = await apiClient.put(`/admin/v2/matches/${matchId}/results`, { answers });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches_v2'] });
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
    mutationFn: async ({ userId, basePoints, basePowerups }: { userId: string; basePoints: number; basePowerups: number }) => {
      const response = await apiClient.put(`/admin/users/${userId}/base-points`, { base_points: basePoints, base_powerups: basePowerups });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
