export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
  "cant_complete",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  cant_complete: "Can't complete",
};

export type TaskPermissionAccess = {
  eventId: number;
  eventSlug: string;
  eventName: string;
  canAssign: boolean;
  canAssignForOthers: boolean;
  canViewOthersTasks: boolean;
  viewableUserIds: number[];
};

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus);
}
