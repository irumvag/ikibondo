import { WorkflowPlaceholder } from '@/components/workflows/WorkflowPlaceholder';

export default function Page() {
  return (
    <WorkflowPlaceholder
      title="Today's Schedule"
      description="Prioritised daily visit list ranked by risk, overdue visits, and pending requests."
      phase="Phase 3"
    />
  );
}
