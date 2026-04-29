import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface CampaignMatchResult {
  campaign_id: string;
  match_id: string;
  correct_answers: Record<string, any>;
}

export function useCampaignMatchResult(campaignId: string, matchId: string) {
  return useQuery({
    queryKey: ['campaign-results', campaignId, matchId],
    queryFn: async () => {
      const response = await apiClient.get<CampaignMatchResult>(`/campaign-results/${campaignId}/${matchId}`);
      return response.data;
    },
    enabled: !!campaignId && !!matchId,
  });
}

export function useUpdateCampaignMatchResult() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, matchId, correct_answers }: { campaignId: string; matchId: string; correct_answers: Record<string, any> }) => {
      const response = await apiClient.put(`/campaign-results/${campaignId}/${matchId}`, { correct_answers });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-results', variables.campaignId, variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}
