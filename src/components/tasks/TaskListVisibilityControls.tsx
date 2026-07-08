"use client";

import {
  countHiddenTasks,
  type TaskListVisibilityOptions,
  type TaskListVisibilityTarget,
} from "@/lib/task-list-filters";

export function TaskListVisibilityControls({
  tasks,
  options,
  onChange,
}: {
  tasks: TaskListVisibilityTarget[];
  options: TaskListVisibilityOptions;
  onChange: (next: TaskListVisibilityOptions) => void;
}) {
  const { hiddenCompleted, hiddenArchived } = countHiddenTasks(tasks, options);

  return (
    <>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
        <input
          type="checkbox"
          checked={options.showCompleted}
          onChange={(event) =>
            onChange({ ...options, showCompleted: event.target.checked })
          }
          className="h-4 w-4 rounded border-stone-300"
        />
        <span className="font-medium text-stone-700">
          Show completed
          {!options.showCompleted && hiddenCompleted > 0
            ? ` (${hiddenCompleted})`
            : ""}
        </span>
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
        <input
          type="checkbox"
          checked={options.showArchived}
          onChange={(event) =>
            onChange({ ...options, showArchived: event.target.checked })
          }
          className="h-4 w-4 rounded border-stone-300"
        />
        <span className="font-medium text-stone-700">
          Show archived
          {!options.showArchived && hiddenArchived > 0
            ? ` (${hiddenArchived})`
            : ""}
        </span>
      </label>
    </>
  );
}
