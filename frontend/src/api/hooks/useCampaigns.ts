import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export type QuestionType = 'toggle' | 'multiple_choice' | 'dropdown' | 'free_text' | 'free_number';
export type CampaignStatus = 'draft' | 'active' | 'closed';
export type CampaignType = 'match' | 'general';

export interface ScoringRules {
  exact_match_points: number;
  wrong_answer_points: number;
  within_range_points: number;
  max_selections?: number;
  multiple_choice_tiers?: Record<string, number>;
}

export interface CampaignQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer: any;
  scoring_rules: ScoringRules;
  order_index: number;
  is_mandatory: boolean;
}

export interface CampaignResponseSummary {
  id: string;
  total_points: number | null;
  submitted_at: string;
  answers: Record<string, { answer_value: any; points_awarded: number | null }>;
}

export interface Campaign {
  id: string;
  title: string;
  description: string | null;
  type: CampaignType;
  is_master: boolean;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  non_participation_penalty: number;
  created_at: string;
  updated_at: string;
  league_id: string | null;
  match_id: string | null;
  tournament_id: string | null;
  questions: CampaignQuestion[];
  my_response?: CampaignResponseSummary;
}

export interface QuestionCreate {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  correct_answer: any;
  scoring_rules: ScoringRules;
  order_index: number;
  is_mandatory: boolean;
}

export interface CampaignCreate {
  title: string;
  description?: string;
  type?: CampaignType;
  is_master?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  non_participation_penalty?: number;
  league_id?: string | null;
  match_id?: string | null;
  tournament_id?: string | null;
  questions: QuestionCreate[];
}

// ── User hooks ───────────────────────────────────────────────────────────────

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const response = await apiClient.get<Campaign[]>('/campaigns');
      return response.data;
    },
  });
}

export function useCampaign(campaignId: string) {
  return useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: async () => {
      const response = await apiClient.get<Campaign>(`/campaigns/${campaignId}`);
      return response.data;
    },
    enabled: !!campaignId,
  });
}

export function useSubmitCampaignResponse(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (answers: { question_id: string; answer_value: any }[]) => {
      const response = await apiClient.post(`/campaigns/${campaignId}/respond`, { answers });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

// ── Admin hooks ──────────────────────────────────────────────────────────────

export function useAdminCampaigns() {
  return useQuery({
    queryKey: ['admin', 'campaigns'],
    queryFn: async () => {
      const response = await apiClient.get<Campaign[]>('/campaigns/admin/all');
      return response.data;
    },
  });
}

export function useAdminCampaign(campaignId: string) {
  return useQuery({
    queryKey: ['admin', 'campaigns', campaignId],
    queryFn: async () => {
      const response = await apiClient.get<Campaign>(`/campaigns/admin/${campaignId}`);
      return response.data;
    },
    enabled: !!campaignId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CampaignCreate) => {
      const response = await apiClient.post('/campaigns', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaign(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CampaignCreate>) => {
      const response = await apiClient.put(`/campaigns/${campaignId}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useUpdateCampaignStatus(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: CampaignStatus) => {
      const response = await apiClient.put(`/campaigns/${campaignId}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await apiClient.delete(`/campaigns/${campaignId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
}

export function useTriggerCampaignScoring(campaignId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post(`/campaigns/${campaignId}/score`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns', campaignId] });
    },
  });
}

export function useAdminCampaignResponses(campaignId: string) {
  return useQuery({
    queryKey: ['admin', 'campaigns', campaignId, 'responses'],
    queryFn: async () => {
      const response = await apiClient.get(`/campaigns/admin/${campaignId}/responses`);
      return response.data;
    },
    enabled: !!campaignId,
  });
}
