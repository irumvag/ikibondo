/**
 * FAQ data source.
 *
 * Designed to mirror the shape of GET /api/v1/faq/ (Phase 3 backend).
 * In Phase 3, the ADMIN dashboard will provide a full CRUD interface so
 * administrators can add, edit, reorder, and publish/unpublish FAQ items
 * without a code change.  Replace this static array with a TanStack Query
 * hook once the backend endpoint ships.
 */

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  /** Ascending sort order — lower = shown first. */
  order: number;
  is_published: boolean;
}

export const FAQ_DATA: FAQItem[] = [
  {
    id: 'faq-1',
    order: 1,
    is_published: true,
    question: 'Who can use Ikibondo?',
    answer:
      'Ikibondo is designed for authorised personnel working in refugee camps. This includes Community Health Workers (CHWs), nurses, zone supervisors, and camp administrators. Parents and guardians can also access a read-only view of their children\'s health records and vaccination history.',
  },
  {
    id: 'faq-2',
    order: 2,
    is_published: true,
    question: 'How does the malnutrition risk assessment work?',
    answer:
      'During each CHW visit, the app records anthropometric measurements (weight, height, MUAC), vital signs, and symptom flags. The system automatically computes WHO z-scores and feeds a calibrated Random Forest model to produce a risk level: LOW, MEDIUM, or HIGH. The top five contributing factors are shown alongside every result so clinicians can understand and verify the decision.',
  },
  {
    id: 'faq-3',
    order: 3,
    is_published: true,
    question: 'Can it be used without an internet connection?',
    answer:
      'Yes. The CHW interface is designed for offline-first operation. Health workers can record visits, register children, and mark vaccines as administered without connectivity. Data is queued locally and automatically synchronised to the server the next time the device is online.',
  },
  {
    id: 'faq-4',
    order: 4,
    is_published: true,
    question: 'What languages does Ikibondo support?',
    answer:
      'Ikibondo currently supports three languages: Kinyarwanda (rw), French (fr), and English (en). Each user sets their preferred language in their profile. All notifications and interface text are delivered in the user\'s chosen language.',
  },
  {
    id: 'faq-5',
    order: 5,
    is_published: true,
    question: 'How is sensitive health data protected?',
    answer:
      'All data is encrypted in transit using TLS. Access is strictly role-based — CHWs can only see children in their assigned zones, and parents can only view their own children\'s records. Every data access and modification is logged for audit purposes, and no personal health information is shared with third parties.',
  },
  {
    id: 'faq-6',
    order: 6,
    is_published: true,
    question: 'What happens when a child is flagged as HIGH risk?',
    answer:
      'The system generates an immediate alert. The zone supervisor and assigned nurse both receive a push notification and SMS. The alert includes the top contributing risk factors so the clinical team can prioritise follow-up. The child\'s record is flagged on the supervisor dashboard for tracking until the risk is resolved.',
  },
  {
    id: 'faq-7',
    order: 7,
    is_published: true,
    question: 'How are vaccination schedules managed?',
    answer:
      'Vaccination schedules follow Rwanda\'s Expanded Programme on Immunization (EPI) guidelines. The system tracks each vaccine\'s due date and status (scheduled, completed, overdue), and sends automated reminders to parents three days before a vaccine is due. CHWs can mark vaccines as administered directly from the field app.',
  },
  {
    id: 'faq-8',
    order: 8,
    is_published: true,
    question: 'How do I get access?',
    answer:
      'New users register through the web application and select their role. The account is created in a "pending approval" state and must be activated by a supervisor or administrator before the user can log in. You will receive an SMS notification once your account is approved.',
  },
];
