"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { TaskNoteIcon } from "@/components/tasks/TaskNoteIcon";
import { SectionShell } from "@/components/layout/PageShell";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/task-types";
import type { Task, TaskNote, TaskReminder } from "@/lib/schema";

type TaskRow = Task & {
  assignee: string;
  assigner: string;
  eventName: string;
  eventSlug: string;
  itemTitle: string | null;
  noteCount: number;
  hasNotes: boolean;
  notePreview?: string;
};

type TaskDetails = {
  task: Task;
  assignee: string;
  eventName: string;
  notes: { note: TaskNote; author: string }[];
  reminders: TaskReminder[];
  subtasks: Task[];
};

type UserOption = { id: number; username: string };

export function TasksPanel() {
  const router = useRouter();
  const { user, taskPermissions, canManageUsers } = useAuth();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<Record<number, TaskDetails>>({});
  const [newNote, setNewNote] = useState("");
  const [cantCompleteReason, setCantCompleteReason] = useState<Record<number, string>>({});
  const [pendingCantCompleteId, setPendingCantCompleteId] = useState<number | null>(null);
  const [subtaskForm, setSubtaskForm] = useState({
    title: "",
    assigneeUserId: "",
    dueAt: "",
    assignerNotes: "",
    isUrgent: false,
    allowSubtasks: false,
    allowTaggedNotes: false,
  });

  const canAssign = taskPermissions.some(
    (entry) => entry.canAssign || entry.canAssignForOthers,
  );

  const canViewOthers = useMemo(
    () =>
      user?.isAdmin ||
      taskPermissions.some(
        (entry) => entry.canViewOthersTasks || entry.viewableUserIds.length > 0,
      ),
    [user?.isAdmin, taskPermissions],
  );

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        setTasks(await response.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const itemParam = searchParams.get("item");
    if (itemParam) {
      router.replace(`/itinerary?item=${itemParam}&createTask=1`);
      return;
    }

    const taskParam = searchParams.get("task");
    if (taskParam) {
      const id = Number(taskParam);
      if (id) setExpandedId(id);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!user) return;
    const currentUser = user;

    async function loadUsers() {
      if (canManageUsers) {
        const response = await fetch("/api/users");
        if (response.ok) {
          const rows = await response.json();
          setUsers(rows.map((row: UserOption) => ({ id: row.id, username: row.username })));
          return;
        }
      }
      if (canAssign) {
        const response = await fetch("/api/tasks/assignees");
        if (response.ok) {
          const rows = await response.json();
          setUsers(rows.map((row: UserOption) => ({ id: row.id, username: row.username })));
          return;
        }
      }

      const fromTasks = new Map<number, string>();
      fromTasks.set(currentUser.id, currentUser.username);
      for (const task of tasks) {
        if (task.assigneeUserId && task.assignee) {
          fromTasks.set(task.assigneeUserId, task.assignee);
        }
      }
      setUsers(
        Array.from(fromTasks.entries()).map(([id, username]) => ({ id, username })),
      );
    }

    void loadUsers();
  }, [canManageUsers, canAssign, user, tasks]);

  const rootTasks = useMemo(
    () => tasks.filter((task) => !task.parentTaskId),
    [tasks],
  );

  const subtasksByParent = useMemo(() => {
    const map = new Map<number, TaskRow[]>();
    for (const task of tasks) {
      if (task.parentTaskId) {
        const list = map.get(task.parentTaskId) ?? [];
        list.push(task);
        map.set(task.parentTaskId, list);
      }
    }
    return map;
  }, [tasks]);

  const assigneeOptions = useMemo(() => {
    if (!user) return users;
    if (canManageUsers || canAssign) return users;
    return users.filter((option) => option.id === user.id);
  }, [users, user, canManageUsers, canAssign]);

  async function loadDetails(taskId: number) {
    const response = await fetch(`/api/tasks/${taskId}`);
    if (!response.ok) return;
    const payload = (await response.json()) as TaskDetails;
    setDetails((current) => ({ ...current, [taskId]: payload }));
  }

  async function toggleExpand(taskId: number) {
    if (expandedId === taskId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(taskId);
    if (!details[taskId]) {
      await loadDetails(taskId);
    }
  }

  async function updateStatus(
    taskId: number,
    nextStatus: TaskStatus,
    statusReason?: string,
  ) {
    setBusy(true);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: nextStatus,
        ...(nextStatus === "cant_complete" ? { statusReason } : {}),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to update status.");
      return;
    }
    const updated = await response.json();
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, ...updated } : task)),
    );
    if (details[taskId]) {
      setDetails((current) => ({
        ...current,
        [taskId]: {
          ...current[taskId],
          task: { ...current[taskId].task, ...updated },
        },
      }));
    }
    window.dispatchEvent(new Event("tasks-changed"));
  }

  function handleStatusChange(task: TaskRow, nextStatus: TaskStatus) {
    if (nextStatus === "cant_complete") {
      setPendingCantCompleteId(task.id);
      setCantCompleteReason((current) => ({
        ...current,
        [task.id]: current[task.id] ?? task.statusReason ?? "",
      }));
      return;
    }
    void updateStatus(task.id, nextStatus);
  }

  async function submitCantComplete(taskId: number) {
    const reason = cantCompleteReason[taskId]?.trim();
    if (!reason) {
      setError("Please provide a reason for can't complete.");
      return;
    }
    await updateStatus(taskId, "cant_complete", reason);
    setPendingCantCompleteId(null);
  }

  async function addNote(taskId: number) {
    if (!newNote.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: newNote.trim() }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to add note.");
      return;
    }
    setNewNote("");
    await Promise.all([loadDetails(taskId), loadTasks()]);
    window.dispatchEvent(new Event("tasks-changed"));
  }

  async function createSubtask(parentId: number) {
    if (!subtaskForm.title.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/tasks/${parentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subtask: {
          title: subtaskForm.title.trim(),
          assigneeUserId: Number(subtaskForm.assigneeUserId) || user?.id,
          dueAt: subtaskForm.dueAt || null,
          assignerNotes: subtaskForm.assignerNotes || null,
          isUrgent: subtaskForm.isUrgent,
          allowSubtasks: subtaskForm.allowSubtasks,
          allowTaggedNotes: subtaskForm.allowTaggedNotes,
        },
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to create subtask.");
      return;
    }
    setSubtaskForm({
      title: "",
      assigneeUserId: user ? String(user.id) : "",
      dueAt: "",
      assignerNotes: "",
      isUrgent: false,
      allowSubtasks: false,
      allowTaggedNotes: false,
    });
    await Promise.all([loadDetails(parentId), loadTasks()]);
    window.dispatchEvent(new Event("tasks-changed"));
  }

  async function deleteTask(taskId: number) {
    if (!confirm("Delete this task and its subtasks?")) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to delete task.");
      return;
    }
    if (expandedId === taskId) setExpandedId(null);
    setDetails((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    await loadTasks();
    window.dispatchEvent(new Event("tasks-changed"));
  }

  async function deleteNote(taskId: number, noteId: number) {
    if (!confirm("Delete this note?")) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteNote: { id: noteId } }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to delete note.");
      return;
    }
    await Promise.all([loadDetails(taskId), loadTasks()]);
    window.dispatchEvent(new Event("tasks-changed"));
  }

  function formatDueDate(value: string | Date | null) {
    if (!value) return "No due date";
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleString();
  }

  function taskContextLabel(task: TaskRow) {
    if (task.itemTitle) return task.itemTitle;
    return task.eventName;
  }

  function assigneeLabel(task: TaskRow) {
    if (task.assigneeUserId === user?.id) return "Assigned to you";
    if (canViewOthers || task.assigneeUserId === user?.id) {
      return `Assigned to ${task.assignee}`;
    }
    return null;
  }

  function renderTaskRow(task: TaskRow, depth = 0) {
    const isExpanded = expandedId === task.id;
    const taskDetails = details[task.id];
    const isAssignee = task.assigneeUserId === user?.id;
    const assignee = assigneeLabel(task);

    return (
      <div key={task.id} className={depth > 0 ? "ml-6 border-l border-stone-200 pl-4" : ""}>
        <div className="py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              onClick={() => void toggleExpand(task.id)}
              className="flex min-w-0 flex-1 items-start gap-2 text-left"
            >
              {isExpanded ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-stone-800">
                  {depth > 0 ? "↳ " : ""}
                  {task.title}
                  {task.isUrgent ? (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      Urgent
                    </span>
                  ) : null}
                  {task.hasNotes && task.notePreview ? (
                    <TaskNoteIcon preview={task.notePreview} className="ml-2 align-middle" />
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  Assigned by {task.assigner}
                  {" · "}
                  {taskContextLabel(task)}
                  {assignee ? ` · ${assignee}` : ""}
                  {" · "}
                  {formatDueDate(task.dueAt)}
                </p>
                {task.status === "cant_complete" && task.statusReason && (
                  <p className="mt-1 text-sm text-amber-800">
                    Reason: {task.statusReason}
                  </p>
                )}
              </div>
            </button>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              {user?.isAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteTask(task.id)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
              {isAssignee && (
                <>
                <select
                  value={pendingCantCompleteId === task.id ? "cant_complete" : task.status}
                  disabled={busy}
                  onChange={(e) =>
                    handleStatusChange(task, e.target.value as TaskStatus)
                  }
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                >
                  {TASK_STATUSES.map((taskStatus) => (
                    <option key={taskStatus} value={taskStatus}>
                      {TASK_STATUS_LABELS[taskStatus]}
                    </option>
                  ))}
                </select>
                {pendingCantCompleteId === task.id && (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={cantCompleteReason[task.id] ?? ""}
                      onChange={(e) =>
                        setCantCompleteReason((current) => ({
                          ...current,
                          [task.id]: e.target.value,
                        }))
                      }
                      placeholder="Reason can't complete"
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submitCantComplete(task.id)}
                      className="rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-sm text-white"
                    >
                      Save
                    </button>
                  </div>
                )}
                </>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="mt-4 ml-6 space-y-4 border-l border-stone-100 pl-4">
              {task.assignerNotes && (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    Assigner notes
                  </p>
                  <p className="mt-1 text-sm text-stone-700">{task.assignerNotes}</p>
                </div>
              )}

              {taskDetails ? (
                taskDetails.notes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                      Notes
                    </p>
                    {taskDetails.notes.map(({ note, author }) => (
                      <div
                        key={note.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="text-stone-700">{note.content}</p>
                          <p className="mt-1 text-xs text-stone-400">{author}</p>
                        </div>
                        {user?.isAdmin && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteNote(task.id, note.id)}
                            className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50"
                            aria-label="Delete note"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-sm text-stone-400">Loading details…</p>
              )}

              <div className="flex gap-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note…"
                  className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={busy || !newNote.trim()}
                  onClick={() => void addNote(task.id)}
                  className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                >
                  Add note
                </button>
              </div>

              {task.allowSubtasks && isAssignee && (
                <div className="rounded-lg border border-dashed border-stone-300 p-3">
                  <p className="text-sm font-medium text-stone-600">Add subtask</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      value={subtaskForm.title}
                      onChange={(e) =>
                        setSubtaskForm((current) => ({
                          ...current,
                          title: e.target.value,
                        }))
                      }
                      placeholder="Subtask title"
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm sm:col-span-2"
                    />
                    <select
                      value={subtaskForm.assigneeUserId}
                      onChange={(e) =>
                        setSubtaskForm((current) => ({
                          ...current,
                          assigneeUserId: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    >
                      {assigneeOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.username}
                        </option>
                      ))}
                    </select>
                    <input
                      type="datetime-local"
                      value={subtaskForm.dueAt}
                      onChange={(e) =>
                        setSubtaskForm((current) => ({
                          ...current,
                          dueAt: e.target.value,
                        }))
                      }
                      className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !subtaskForm.title.trim()}
                    onClick={() => void createSubtask(task.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-sm font-medium text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Add subtask
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {(subtasksByParent.get(task.id) ?? []).map((subtask) =>
          renderTaskRow(subtask, depth + 1),
        )}
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-stone-500">Loading tasks…</p>;
  }

  return (
    <SectionShell title="Tasks">
      {rootTasks.length === 0 ? (
        <p className="text-sm text-stone-500">
          {canAssign
            ? "No tasks yet. Create tasks from an itinerary item's detail view."
            : "No tasks yet."}
        </p>
      ) : (
        <div className="divide-y divide-stone-100">
          {rootTasks.map((task) => renderTaskRow(task))}
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </SectionShell>
  );
}
