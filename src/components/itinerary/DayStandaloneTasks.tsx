import Link from "next/link";
import { CheckSquare } from "lucide-react";
import type { DayTaskBrief } from "@/lib/task-queries";

export function DayStandaloneTasks({ tasks }: { tasks: DayTaskBrief[] }) {
  if (!tasks.length) return null;

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/tasks?task=${task.id}`}
          className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:border-accent/50 hover:bg-surface-soft"
        >
          <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-deep" />
          <div className="min-w-0">
            <p className="font-medium text-stone-800">{task.title}</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Task
              {task.mine ? " · assigned to you" : ""}
              {task.isUrgent ? " · urgent" : ""}
              {task.hasNotes ? " · has notes" : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
