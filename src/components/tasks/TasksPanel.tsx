"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, Archive, ArchiveRestore, Plus, Save, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { TaskNoteIcon } from "@/components/tasks/TaskNoteIcon";
import { TaskListVisibilityControls } from "@/components/tasks/TaskListVisibilityControls";
import { SectionShell } from "@/components/layout/PageShell";
import { scrollToElementById, taskEditSectionId, taskRowId } from "@/lib/day-jump";
import {
  isTaskArchived,
  matchesTaskListVisibility,
} from "@/lib/task-list-filters";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/task-types";
import type { Task, TaskNote, TaskReminder } from "@/lib/schema";

type TaskRow = Task & {
  assignee: string;
  assigner: string;
  eventName: string | null;
  eventSlug: string | null;
  itemTitle: string | null;
  noteCount: number;
  hasNotes: boolean;
  notePreview?: string;
};

type TaskDetails = {
  task: Task;
  assignee: string;
  eventName: string | null;
  notes: { note: TaskNote; author: string }[];
  reminders: TaskReminder[];
  subtasks: Task[];
};

type UserOption = { id: number; username: string };

type UrgencyFilter = "all" | "urgent" | "non-urgent";
type TaskSortKey = "dueAt" | "assignee" | "assigner";

type TaskEditForm = {
  title: string;
  assigneeUserId: string;
  dueAt: string;
  assignerNotes: string;
  isUrgent: boolean;
  allowSubtasks: boolean;
  allowTaggedNotes: boolean;
};

const EMPTY_EDIT_FORM: TaskEditForm = {
  title: "",
  assigneeUserId: "",
  dueAt: "",
  assignerNotes: "",
  isUrgent: false,
  allowSubtasks: false,
  allowTaggedNotes: false,
};

function compareNullableDates(
  a: string | Date | null,
  b: string | Date | null,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

export function TasksPanel() {
  const router = useRouter();
  const { user, taskPermissions, canManageUsers } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
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
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<TaskSortKey>("dueAt");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    assigneeUserId: "",
    dueAt: "",
    assignerNotes: "",
    isUrgent: false,
  });
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TaskEditForm>(EMPTY_EDIT_FORM);
  const editSectionRef = useRef<HTMLDivElement>(null);

  const assignableEvents = useMemo(
    () =>
      taskPermissions.filter(
        (entry) => entry.canAssign || entry.canAssignForOthers || user?.isAdmin,
      ),
    [taskPermissions, user?.isAdmin],
  );

  const canAssign = assignableEvents.length > 0;

  const canViewOthers = useMemo(
    () =>
      user?.isAdmin ||
      taskPermissions.some(
        (entry) => entry.canViewOthersTasks || entry.viewableUserIds.length > 0,
      ),
    [user?.isAdmin, taskPermissions],
  );

  const loadTasks = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const response = await fetch("/api/tasks");
      if (response.ok) {
        setTasks(await response.json());
      }
    } finally {
      if (!options?.silent) setLoading(false);
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

    const urgentParam = searchParams.get("urgent");
    if (urgentParam === "1" || urgentParam === "true") {
      setUrgencyFilter("urgent");
    }

    const taskParam = searchParams.get("task");
    if (taskParam) {
      const id = Number(taskParam);
      if (id) {
        setExpandedId(id);
        setEditingTaskId(id);
      }
    }
  }, [searchParams, router]);

  function setUrgentOnly(enabled: boolean) {
    const nextFilter: UrgencyFilter = enabled ? "urgent" : "all";
    setUrgencyFilter(nextFilter);
    const params = new URLSearchParams(searchParams.toString());
    if (enabled) {
      params.set("urgent", "1");
    } else {
      params.delete("urgent");
    }
    const query = params.toString();
    router.replace(query ? `/tasks?${query}` : "/tasks", { scroll: false });
  }

  useEffect(() => {
    if (!editingTaskId) return;
    const task = tasks.find((row) => row.id === editingTaskId);
    if (!task) return;
    setEditForm({
      title: task.title,
      assigneeUserId: task.assigneeUserId ? String(task.assigneeUserId) : "",
      dueAt: toDatetimeLocalValue(task.dueAt),
      assignerNotes: task.assignerNotes ?? "",
      isUrgent: task.isUrgent,
      allowSubtasks: task.allowSubtasks,
      allowTaggedNotes: task.allowTaggedNotes,
    });
  }, [editingTaskId, tasks]);

  useEffect(() => {
    if (!editingTaskId || !editSectionRef.current) return;
    requestAnimationFrame(() => {
      scrollToElementById(taskEditSectionId());
    });
  }, [editingTaskId]);

  useEffect(() => {
    if (!expandedId || details[expandedId]) return;
    void (async () => {
      const response = await fetch(`/api/tasks/${expandedId}`);
      if (!response.ok) return;
      const payload = (await response.json()) as TaskDetails;
      setDetails((current) => ({ ...current, [expandedId]: payload }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect -- load details for deep-linked task
  }, [expandedId, details]);

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

  const listVisibility = useMemo(
    () => ({ showCompleted, showArchived }),
    [showCompleted, showArchived],
  );

  const rootTasks = useMemo(() => {
    let list = tasks.filter((task) => !task.parentTaskId);

    list = list.filter((task) => matchesTaskListVisibility(task, listVisibility));

    if (urgencyFilter === "urgent") {
      const parentsWithUrgentChildren = new Set(
        tasks
          .filter((task) => task.parentTaskId && task.isUrgent)
          .map((task) => task.parentTaskId as number),
      );
      list = list.filter(
        (task) => task.isUrgent || parentsWithUrgentChildren.has(task.id),
      );
    } else if (urgencyFilter === "non-urgent") {
      list = list.filter((task) => !task.isUrgent);
    }

    if (user?.isAdmin) {
      list = [...list].sort((a, b) => {
        if (sortKey === "dueAt") {
          return compareNullableDates(a.dueAt, b.dueAt);
        }
        if (sortKey === "assignee") {
          return a.assignee.localeCompare(b.assignee);
        }
        return a.assigner.localeCompare(b.assigner);
      });
    }

    return list;
  }, [tasks, urgencyFilter, sortKey, user?.isAdmin, listVisibility]);

  const subtasksByParent = useMemo(() => {
    const map = new Map<number, TaskRow[]>();
    for (const task of tasks) {
      if (task.parentTaskId) {
        if (!matchesTaskListVisibility(task, listVisibility)) continue;
        if (urgencyFilter === "urgent" && !task.isUrgent) continue;
        if (urgencyFilter === "non-urgent" && task.isUrgent) continue;
        const list = map.get(task.parentTaskId) ?? [];
        list.push(task);
        map.set(task.parentTaskId, list);
      }
    }
    return map;
  }, [tasks, urgencyFilter, listVisibility]);

  const assigneeOptions = useMemo(() => {
    if (!user) return users;
    if (canManageUsers || canAssign) return users;
    return users.filter((option) => option.id === user.id);
  }, [users, user, canManageUsers, canAssign]);

  function canManageTask(task: TaskRow): boolean {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (task.createdByUserId === user.id) return true;
    if (task.eventId == null) {
      return assignableEvents.some(
        (entry) => entry.canAssign || entry.canAssignForOthers,
      );
    }
    return assignableEvents.some(
      (entry) =>
        entry.eventId === task.eventId &&
        (entry.canAssign || entry.canAssignForOthers),
    );
  }

  function toDatetimeLocalValue(value: string | Date | null): string {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function loadDetails(taskId: number) {
    const response = await fetch(`/api/tasks/${taskId}`);
    if (!response.ok) return;
    const payload = (await response.json()) as TaskDetails;
    setDetails((current) => ({ ...current, [taskId]: payload }));
  }

  async function toggleExpand(taskId: number) {
    if (expandedId === taskId) {
      setExpandedId(null);
      setEditingTaskId(null);
      setEditForm(EMPTY_EDIT_FORM);
      router.replace("/tasks", { scroll: false });
      return;
    }
    setExpandedId(taskId);
    setEditingTaskId(taskId);
    router.replace(`/tasks?task=${taskId}`, { scroll: false });
    if (!details[taskId]) {
      await loadDetails(taskId);
    }
  }

  async function saveEditedTask() {
    if (!editingTaskId || !editForm.title.trim()) {
      showError("Task title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/${editingTaskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editForm.title.trim(),
        assigneeUserId: Number(editForm.assigneeUserId) || undefined,
        dueAt: editForm.dueAt || null,
        assignerNotes: editForm.assignerNotes || null,
        isUrgent: editForm.isUrgent,
        allowSubtasks: editForm.allowSubtasks,
        allowTaggedNotes: editForm.allowTaggedNotes,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      const message = data.error ?? "Failed to update task.";
      setError(message);
      showError(message);
      return;
    }
    const updated = await response.json();
    setTasks((current) =>
      current.map((task) => (task.id === editingTaskId ? { ...task, ...updated } : task)),
    );
    if (details[editingTaskId]) {
      setDetails((current) => ({
        ...current,
        [editingTaskId]: {
          ...current[editingTaskId],
          task: { ...current[editingTaskId].task, ...updated },
        },
      }));
    }
    const savedTaskId = editingTaskId;
    closeTaskEditor();
    showSuccess("Task saved.");
    await loadTasks({ silent: true });
    window.dispatchEvent(new Event("tasks-changed"));
    requestAnimationFrame(() => {
      scrollToElementById(taskRowId(savedTaskId));
    });
  }

  function closeTaskEditor() {
    setEditingTaskId(null);
    setExpandedId(null);
    setEditForm(EMPTY_EDIT_FORM);
    router.replace("/tasks", { scroll: false });
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
    if (editingTaskId === taskId) closeTaskEditor();
    setDetails((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    await loadTasks();
    window.dispatchEvent(new Event("tasks-changed"));
  }

  async function setTaskArchived(taskId: number, archived: boolean) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(archived ? "Failed to archive task." : "Failed to unarchive task.");
      return;
    }
    if (archived && editingTaskId === taskId) closeTaskEditor();
    await loadTasks({ silent: true });
    window.dispatchEvent(new Event("tasks-changed"));
    showSuccess(archived ? "Task archived." : "Task restored.");
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
    if (task.eventName) return task.eventName;
    return "General task";
  }

  function assigneeLabel(task: TaskRow) {
    if (task.assigneeUserId === user?.id) return "Assigned to you";
    if (canViewOthers || task.assigneeUserId === user?.id) {
      return `Assigned to ${task.assignee}`;
    }
    return null;
  }

  function openTask(task: TaskRow) {
    void toggleExpand(task.id);
  }

  async function createTask() {
    if (!createForm.title.trim()) {
      showError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: createForm.title.trim(),
        assigneeUserId: createForm.assigneeUserId
          ? Number(createForm.assigneeUserId)
          : user?.id,
        dueAt: createForm.dueAt || null,
        assignerNotes: createForm.assignerNotes || null,
        isUrgent: createForm.isUrgent,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      const message = data.error ?? "Failed to create task.";
      setError(message);
      showError(message);
      return;
    }
    setCreateForm({
      title: "",
      assigneeUserId: "",
      dueAt: "",
      assignerNotes: "",
      isUrgent: false,
    });
    setShowCreateForm(false);
    showSuccess("Task created.");
    await loadTasks();
    window.dispatchEvent(new Event("tasks-changed"));
  }

  function renderTaskRow(task: TaskRow, depth = 0) {
    const isSelected = editingTaskId === task.id;
    const isAssignee = task.assigneeUserId === user?.id;
    const canUpdateStatus = isAssignee || canManageTask(task);
    const canArchive = canManageTask(task);
    const assignee = assigneeLabel(task);
    const archived = isTaskArchived(task);
    const completed = task.status === "completed";

    return (
      <div key={task.id} className={depth > 0 ? "ml-6 border-l border-stone-200 pl-4" : ""}>
        <div
          id={taskRowId(task.id)}
          className={[
            "scroll-mt-24 py-4",
            isSelected ? "rounded-xl bg-brand-deep/5 px-3 -mx-3" : "",
            archived || completed ? "opacity-75" : "",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              onClick={() => openTask(task)}
              className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left"
            >
              {isSelected ? (
                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-brand-deep" />
              ) : (
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-stone-800">
                  {depth > 0 ? "↳ " : ""}
                  {task.title}
                  {task.isUrgent ? (
                    <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                      Urgent
                    </span>
                  ) : null}
                  {archived ? (
                    <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600 ring-1 ring-stone-200">
                      Archived
                    </span>
                  ) : null}
                  {completed && !archived ? (
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      Completed
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
              {canArchive && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setTaskArchived(task.id, !archived)}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                >
                  {archived ? (
                    <>
                      <ArchiveRestore className="h-3.5 w-3.5" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="h-3.5 w-3.5" />
                      Archive
                    </>
                  )}
                </button>
              )}
              {user?.isAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void deleteTask(task.id)}
                  className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
              {canUpdateStatus ? (
                <>
                  <select
                    value={
                      pendingCantCompleteId === task.id ? "cant_complete" : task.status
                    }
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
                        className="rounded-lg bg-brand-deep px-3 py-1.5 text-sm text-white"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <span className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-600">
                  {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {(subtasksByParent.get(task.id) ?? []).map((subtask) =>
          renderTaskRow(subtask, depth + 1),
        )}
      </div>
    );
  }

  const editingTask = editingTaskId
    ? tasks.find((task) => task.id === editingTaskId) ?? null
    : null;
  const editingDetails = editingTaskId ? details[editingTaskId] : undefined;
  const canEditSelectedTask = editingTask ? canManageTask(editingTask) : false;
  const isEditingAssignee = editingTask?.assigneeUserId === user?.id;

  if (loading) {
    return <p className="text-sm text-stone-500">Loading tasks…</p>;
  }

  return (
    <SectionShell
      title="Tasks"
      stickyHeader
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
            <input
              type="checkbox"
              checked={urgencyFilter === "urgent"}
              onChange={(event) => setUrgentOnly(event.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            <span className="font-medium text-stone-700">Urgent only</span>
          </label>
          <TaskListVisibilityControls
            tasks={tasks}
            options={{ showCompleted, showArchived }}
            onChange={({ showCompleted: nextCompleted, showArchived: nextArchived }) => {
              setShowCompleted(nextCompleted);
              setShowArchived(nextArchived);
            }}
          />
          {user?.isAdmin && (
            <label className="inline-flex items-center gap-2 text-sm text-stone-600">
              <span>Sort by</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as TaskSortKey)}
                className="rounded-lg border border-stone-200 px-2 py-1.5"
              >
                <option value="dueAt">Due date</option>
                <option value="assignee">Assignee</option>
                <option value="assigner">Assigner</option>
              </select>
            </label>
          )}
        </div>
      }
    >
      {editingTask && (
        <div
          id={taskEditSectionId()}
          ref={editSectionRef}
          className="scroll-mt-24 mb-6 rounded-xl border border-brand-deep/20 bg-brand-deep/5 p-4"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-brand-deep">Edit task</p>
              <p className="text-xs text-stone-500">
                {taskContextLabel(editingTask)} · Assigned by {editingTask.assigner}
              </p>
            </div>
            <button
              type="button"
              onClick={closeTaskEditor}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-white/80"
              aria-label="Close editor"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {editingTask.itemId ? (
            <a
              href={`/itinerary?item=${editingTask.itemId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 inline-flex cursor-pointer items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-brand-deep hover:bg-stone-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View linked item
            </a>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={editForm.title}
              onChange={(e) =>
                setEditForm((current) => ({ ...current, title: e.target.value }))
              }
              placeholder="Task title"
              disabled={!canEditSelectedTask && !editingTask.allowAssigneeEdit}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm sm:col-span-2 disabled:bg-stone-100"
            />
            <select
              value={editForm.assigneeUserId}
              onChange={(e) =>
                setEditForm((current) => ({
                  ...current,
                  assigneeUserId: e.target.value,
                }))
              }
              disabled={!canEditSelectedTask}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm disabled:bg-stone-100"
            >
              {assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.username}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={editForm.dueAt}
              onChange={(e) =>
                setEditForm((current) => ({ ...current, dueAt: e.target.value }))
              }
              disabled={!canEditSelectedTask && !editingTask.allowAssigneeEdit}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm disabled:bg-stone-100"
            />
            {canEditSelectedTask ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.isUrgent}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        isUrgent: e.target.checked,
                      }))
                    }
                  />
                  Urgent
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.allowSubtasks}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        allowSubtasks: e.target.checked,
                      }))
                    }
                  />
                  Allow subtasks
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={editForm.allowTaggedNotes}
                    onChange={(e) =>
                      setEditForm((current) => ({
                        ...current,
                        allowTaggedNotes: e.target.checked,
                      }))
                    }
                  />
                  Allow tagged notes
                </label>
              </>
            ) : null}
            <textarea
              value={editForm.assignerNotes}
              onChange={(e) =>
                setEditForm((current) => ({
                  ...current,
                  assignerNotes: e.target.value,
                }))
              }
              placeholder="Assigner notes"
              rows={3}
              disabled={!canEditSelectedTask && !editingTask.allowAssigneeEdit}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm sm:col-span-2 disabled:bg-stone-100"
            />
          </div>

          {(canEditSelectedTask || editingTask.allowAssigneeEdit) && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveEditedTask()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-brand-deep px-3 py-1.5 text-sm font-medium text-white"
              >
                <Save className="h-4 w-4" />
                Save changes
              </button>
              <button
                type="button"
                onClick={closeTaskEditor}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
          )}

          {editingDetails ? (
            editingDetails.notes.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  Notes
                </p>
                {editingDetails.notes.map(({ note, author }) => (
                  <div
                    key={note.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-stone-700">{note.content}</p>
                      <p className="mt-1 text-xs text-stone-400">{author}</p>
                    </div>
                    {user?.isAdmin && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deleteNote(editingTask.id, note.id)}
                        className="shrink-0 cursor-pointer rounded p-1 text-red-500 hover:bg-red-50"
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
            <p className="mt-4 text-sm text-stone-400">Loading notes…</p>
          )}

          <div className="mt-4 flex gap-2">
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note…"
              className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || !newNote.trim() || !editingTaskId}
              onClick={() => editingTaskId && void addNote(editingTaskId)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
            >
              Add note
            </button>
          </div>

          {editingTask.allowSubtasks && isEditingAssignee && (
            <div className="mt-4 rounded-lg border border-dashed border-stone-300 bg-white/70 p-3">
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
                onClick={() => void createSubtask(editingTask.id)}
                className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg bg-brand-deep px-3 py-1.5 text-sm font-medium text-white"
              >
                <Plus className="h-4 w-4" />
                Add subtask
              </button>
            </div>
          )}
        </div>
      )}

      {canAssign && (
        <div className="mb-6 rounded-xl border border-dashed border-stone-300 p-4">
          {showCreateForm ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <p className="text-sm font-medium text-stone-600 sm:col-span-2">
                New Task
              </p>
              <input
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm((current) => ({ ...current, title: e.target.value }))
                }
                placeholder="Task title"
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <select
                value={createForm.assigneeUserId}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    assigneeUserId: e.target.value,
                  }))
                }
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="">Assign to me</option>
                {assigneeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.username}
                  </option>
                ))}
              </select>
              <input
                type="datetime-local"
                value={createForm.dueAt}
                onChange={(e) =>
                  setCreateForm((current) => ({ ...current, dueAt: e.target.value }))
                }
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={createForm.isUrgent}
                  onChange={(e) =>
                    setCreateForm((current) => ({
                      ...current,
                      isUrgent: e.target.checked,
                    }))
                  }
                />
                Urgent
              </label>
              <textarea
                value={createForm.assignerNotes}
                onChange={(e) =>
                  setCreateForm((current) => ({
                    ...current,
                    assignerNotes: e.target.value,
                  }))
                }
                placeholder="Assigner notes (optional)"
                rows={2}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void createTask()}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-deep px-3 py-1.5 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  Create task
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep"
            >
              <Plus className="h-4 w-4" />
              Add task
            </button>
          )}
        </div>
      )}

      {rootTasks.length === 0 ? (
        <p className="text-sm text-stone-500">
          {urgencyFilter === "urgent"
            ? "No urgent tasks."
            : !showCompleted || !showArchived
              ? "No active tasks match these filters. Try showing completed or archived tasks."
              : canAssign
                ? "No tasks yet. Create one above or from an itinerary item."
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
