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
    mutationFn: async ({ userId, basePoints }: { userId: string; basePoints: number }) => {
      const response = await apiClient.put(`/admin/users/${userId}/base-points`, { base_points: basePoints });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
