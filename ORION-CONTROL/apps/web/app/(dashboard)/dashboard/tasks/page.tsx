import type { Metadata } from 'next';
import { ClipboardList, Plus } from 'lucide-react';
import { TASK_TYPE_LIST } from '@orion/shared';
import { requirePageUser } from '@/lib/auth/current-user';
import { getStore } from '@/lib/db';
import { getWorkerSummary } from '@/lib/worker-status';
import { reapTasks } from '@/lib/tasks';
import { PageHeader, StatCard } from '@/components/ui/primitives';
import { TaskConsole, type TaskListResponse, type TaskTypeOption } from '@/components/tasks/task-console';

export const metadata: Metadata = { title: 'Background Tasks' };

export default async function TasksPage() {
  const user = await requirePageUser('tasks.view');
  await reapTasks();

  const store = await getStore();
  const [tasks, counts, worker] = await Promise.all([
    store.listTasks({ limit: 50, offset: 0 }),
    store.countTasksByStatus(),
    getWorkerSummary(),
  ]);

  const initial: TaskListResponse = {
    items: tasks.items,
    total: tasks.total,
    limit: 50,
    offset: 0,
    counts,
    permissions: {
      canCreate: user.permissions.includes('tasks.create'),
      canManage: user.permissions.includes('tasks.manage'),
    },
  };

  const taskTypes: TaskTypeOption[] = TASK_TYPE_LIST.filter(
    (definition) =>
      user.permissions.includes(definition.permission) &&
      user.permissions.includes('tasks.create'),
  ).map((definition) => ({
    type: definition.type as TaskTypeOption['type'],
    label: definition.label,
    description: definition.description,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Background tasks"
        description="Every Discord operation runs as a background task. Requests never block the website: the worker claims work at its own pace and submits results back here."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Queued"
          value={counts.queued}
          hint="Waiting for a worker claim"
          icon={<ClipboardList size={18} />}
          tone="brand"
        />
        <StatCard
          label="Running"
          value={counts.running}
          hint="Claimed and executing now"
          icon={<Plus size={18} />}
          tone="cyan"
        />
        <StatCard
          label="Completed"
          value={counts.completed}
          hint="Results stored and inspectable"
          icon={<ClipboardList size={18} />}
          tone="success"
        />
        <StatCard
          label="Failed / timed out"
          value={counts.failed + counts.timed_out}
          hint="Inspect error details or retry"
          icon={<ClipboardList size={18} />}
          tone="danger"
        />
      </div>

      <TaskConsole
        initial={initial}
        taskTypes={taskTypes}
        canCreate={taskTypes.length > 0}
        workerOnline={worker.online}
      />
    </div>
  );
}
