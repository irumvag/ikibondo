import { useQuery } from '@tanstack/react-query';
import { getLandingStats, getPublicCamps } from './public';
import {
  listUsers, getPendingApprovals, listCamps, listZones,
  getModelInfo, listPredictions,
} from './admin';
import {
  getZoneStats, getCHWActivity, listHighRiskRecords, listCampChildren,
} from './supervisor';
import {
  getGrowthData, getChild, getChildHistory, getChildNotes, listHealthRecords,
} from './nurse';
import { listVaccinationQueue } from './chw';

export const QK = {
  landingStats:       ['landing-stats']       as const,
  publicCamps:        ['public-camps']        as const,
  adminUsers:         ['admin-users']         as const,
  pendingApprovals:   ['pending-approvals']   as const,
  adminCamps:         ['admin-camps']         as const,
  adminZones:         (campId: string) => ['admin-zones', campId] as const,
  modelInfo:          ['model-info']          as const,
  predictions:        ['predictions']         as const,
  zoneStats:          (campId: string, zoneId: string) => ['zone-stats', campId, zoneId] as const,
  chwActivity:        (campId: string, zoneId: string) => ['chw-activity', campId, zoneId] as const,
  highRiskRecords:    (zone?: string, page?: number)   => ['high-risk-records', zone, page] as const,
  campChildren:       (camp?: string, status?: string, page?: number) => ['camp-children', camp, status, page] as const,
  growthData:         (childId: string) => ['growth-data', childId] as const,
  child:              (childId: string) => ['child', childId] as const,
  childHistory:       (childId: string) => ['child-history', childId] as const,
  childNotes:         (childId: string) => ['child-notes', childId] as const,
  healthRecords:      (params: Record<string, unknown>) => ['health-records', params] as const,
  vaccinationQueue:   (page?: number) => ['vaccination-queue', page] as const,
};

export function useLandingStats() {
  return useQuery({
    queryKey: QK.landingStats,
    queryFn: getLandingStats,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function usePublicCamps() {
  return useQuery({
    queryKey: QK.publicCamps,
    queryFn: getPublicCamps,
    staleTime: 300_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useAdminUsers(role?: string) {
  return useQuery({
    queryKey: [...QK.adminUsers, role ?? 'all'],
    queryFn: () => listUsers(role),
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: QK.pendingApprovals,
    queryFn: getPendingApprovals,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useAdminCamps() {
  return useQuery({
    queryKey: QK.adminCamps,
    queryFn: listCamps,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useAdminZones(campId: string | null) {
  return useQuery({
    queryKey: QK.adminZones(campId ?? ''),
    queryFn: () => listZones(campId!),
    enabled: !!campId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useModelInfo() {
  return useQuery({
    queryKey: QK.modelInfo,
    queryFn: getModelInfo,
    staleTime: 120_000,
    retry: 1,
  });
}

export function usePredictions(model?: string) {
  return useQuery({
    queryKey: [...QK.predictions, model ?? 'all'],
    queryFn: () => listPredictions({ model, limit: 50 }),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useZoneStats(campId: string | null, zoneId: string | null) {
  return useQuery({
    queryKey: QK.zoneStats(campId ?? '', zoneId ?? ''),
    queryFn: () => getZoneStats(campId!, zoneId!),
    enabled: !!campId && !!zoneId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCHWActivity(campId: string | null, zoneId: string | null) {
  return useQuery({
    queryKey: QK.chwActivity(campId ?? '', zoneId ?? ''),
    queryFn: () => getCHWActivity(campId!, zoneId!),
    enabled: !!campId && !!zoneId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useHighRiskRecords(zone?: string, page = 1) {
  return useQuery({
    queryKey: QK.highRiskRecords(zone, page),
    queryFn: () => listHighRiskRecords({ zone, page, page_size: 20 }),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCampChildren(camp?: string, status?: string, page = 1) {
  return useQuery({
    queryKey: QK.campChildren(camp, status, page),
    queryFn: () => listCampChildren({ camp, status, page, page_size: 20 }),
    enabled: !!camp,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useGrowthData(childId: string | null) {
  return useQuery({
    queryKey: QK.growthData(childId ?? ''),
    queryFn: () => getGrowthData(childId!),
    enabled: !!childId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useChild(childId: string | null) {
  return useQuery({
    queryKey: QK.child(childId ?? ''),
    queryFn: () => getChild(childId!),
    enabled: !!childId,
    staleTime: 60_000,
    retry: 1,
  });
}

export function useChildHistory(childId: string | null) {
  return useQuery({
    queryKey: QK.childHistory(childId ?? ''),
    queryFn: () => getChildHistory(childId!),
    enabled: !!childId,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useChildNotes(childId: string | null) {
  return useQuery({
    queryKey: QK.childNotes(childId ?? ''),
    queryFn: () => getChildNotes(childId!),
    enabled: !!childId,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useHealthRecords(params: {
  risk_level?: string;
  nutrition_status?: string;
  zone?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: QK.healthRecords(params as Record<string, unknown>),
    queryFn: () => listHealthRecords({ ...params, page_size: 20 }),
    staleTime: 30_000,
    retry: 1,
  });
}

export function useVaccinationQueue(page = 1) {
  return useQuery({
    queryKey: QK.vaccinationQueue(page),
    queryFn: () => listVaccinationQueue({ page, page_size: 30 }),
    staleTime: 30_000,
    retry: 1,
  });
}
