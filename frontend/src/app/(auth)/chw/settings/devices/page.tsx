import { WorkflowPlaceholder } from '@/components/workflows/WorkflowPlaceholder';

export default function Page() {
  return (
    <WorkflowPlaceholder
      title="BLE Devices"
      description="Pair Bluetooth sensor devices for automatic vital sign capture during visits."
      phase="Phase 3"
    />
  );
}
