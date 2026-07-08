export type TaskListVisibilityOptions = {
  showCompleted: boolean;
  showArchived: boolean;
};

export type TaskListVisibilityTarget = {
  status: string;
  archivedAt?: string | Date | null;
  parentTaskId?: number | null;
};

export function isTaskArchived(task: { archivedAt?: string | Date | null }): boolean {
  return task.archivedAt != null;
}

export function matchesTaskListVisibility(
  task: TaskListVisibilityTarget,
  options: TaskListVisibilityOptions,
): boolean {
  if (isTaskArchived(task)) return options.showArchived;
  if (task.status === "completed") return options.showCompleted;
  return true;
}

export function countHiddenTasks(
  tasks: TaskListVisibilityTarget[],
  options: TaskListVisibilityOptions,
  rootOnly = true,
): { hiddenCompleted: number; hiddenArchived: number } {
  const list = rootOnly
    ? tasks.filter((task) => !task.parentTaskId)
    : tasks;

  let hiddenCompleted = 0;
  let hiddenArchived = 0;

  for (const task of list) {
    if (isTaskArchived(task)) {
      if (!options.showArchived) hiddenArchived += 1;
      continue;
    }
    if (task.status === "completed" && !options.showCompleted) {
      hiddenCompleted += 1;
    }
  }

  return { hiddenCompleted, hiddenArchived };
}
