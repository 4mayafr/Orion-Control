import { TASK_STATUS_LABELS, TASK_STATUS_HINTS, type TaskStatus } from '@orion/shared';
import { Badge, type BadgeVariant } from '@/components/ui/primitives';

const VARIANTS: Record<TaskStatus, BadgeVariant> = {
  queued: 'neutral',
  running: 'cyan',
  completed: 'success',
  failed: 'danger',
  timed_out: 'warning',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span title={TASK_STATUS_HINTS[status]}>
      <Badge variant={VARIANTS[status]} dot>
        {TASK_STATUS_LABELS[status]}
      </Badge>
    </span>
  );
}
