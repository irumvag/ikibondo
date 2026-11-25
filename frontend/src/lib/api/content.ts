import { apiClient } from './client';
import type { SectionKey, StoredContent, StoredSection } from '@/lib/siteContent';

export async function getSiteContent(): Promise<StoredContent> {
  const { data } = await apiClient.get('/site-content/');
  return (data?.data ?? {}) as StoredContent;
}

export async function saveSiteSection(
  key: SectionKey,
  payload: Pick<StoredSection, 'content_en' | 'content_fr' | 'content_rw'>,
): Promise<StoredSection> {
  const { data } = await apiClient.put(`/site-content/${key}/`, payload);
  return data.data;
}

/** Back to the built-in text. */
export async function resetSiteSection(key: SectionKey): Promise<void> {
  await apiClient.delete(`/site-content/${key}/`);
}

export interface Announcement {
  id: string;
  message_en: string;
  message_fr: string;
  message_rw: string;
  link_url: string;
  level: 'INFO' | 'WARNING';
  show_public: boolean;
  show_dashboard: boolean;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
}

export type AnnouncementInput = Omit<Announcement, 'id' | 'created_at'>;

function rows<T>(data: unknown): T[] {
  const d = (data as { data?: unknown })?.data ?? data;
  return ((d as { results?: T[] })?.results ?? d ?? []) as T[];
}

export async function getActiveAnnouncements(where: 'public' | 'dashboard'): Promise<Announcement[]> {
  const { data } = await apiClient.get('/announcements/active/', { params: { where } });
  return rows<Announcement>(data);
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const { data } = await apiClient.get('/announcements/');
  return rows<Announcement>(data);
}

export async function createAnnouncement(input: AnnouncementInput): Promise<Announcement> {
  const { data } = await apiClient.post('/announcements/', input);
  return data.data ?? data;
}

export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>): Promise<Announcement> {
  const { data } = await apiClient.patch(`/announcements/${id}/`, input);
  return data.data ?? data;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await apiClient.delete(`/announcements/${id}/`);
}
