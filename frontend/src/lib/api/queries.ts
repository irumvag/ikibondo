import { useQuery } from '@tanstack/react-query';
import { getLandingStats, getPublicCamps } from './public';

export const QK = {
  landingStats: ['landing-stats'] as const,
  publicCamps:  ['public-camps']  as const,
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
