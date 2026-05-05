import { WorkflowPlaceholder } from '@/components/workflows/WorkflowPlaceholder';

export default function Page() {
  return (
    <WorkflowPlaceholder
      title="Clinic Session"
      description="Run a bulk vaccination session: select vaccine, mark attendance, record doses."
      phase="Phase 4"
    />
  );
}
