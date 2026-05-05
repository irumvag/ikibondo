import { WorkflowPlaceholder } from '@/components/workflows/WorkflowPlaceholder';

export default function Page() {
  return (
    <WorkflowPlaceholder
      title="DHIS2 Sync"
      description="Monitor sync status, failed records, and conflict resolution queue."
      phase="Phase 6"
    />
  );
}
