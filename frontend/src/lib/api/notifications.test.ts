import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ apiClient: { get: vi.fn() } }));
import { apiClient } from './client';
import { getAllNotifications } from './notifications';

const row = { id: '1', notification_type: 'VACCINATION_REMINDER', notification_type_display: 'Reminder', message: 'm',
  is_read: false, created_at: '2026-11-26T08:00:00Z', sent_at: null, child: null, child_name: null };

describe('getAllNotifications', () => {
  it.each([
    ['plain page', { count: 1, results: [row] }],
    ['wrapped list', { success: true, data: [row] }],
    ['wrapped page', { success: true, data: { results: [row] } }],
  ])('reads a %s', async (_, body) => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: body });
    expect((await getAllNotifications()).map((n) => n.id)).toEqual(['1']);
  });
});
