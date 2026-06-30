"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { TaskNoteIcon } from "@/components/tasks/TaskNoteIcon";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/task-types";
import type { ItineraryItem } from "@/lib/schema";

type ItemTaskRow = {
  id: number;
  title: string;
  status: string;
  statusReason: string | null;
  isUrgent: boolean;
  assignee: string;
  assigner: string;
  assigneeUserId: number;
  createdByUserId: number;
  assignerNotes: string | null;
  dueAt: string | null;
  allowSubtasks: boolean;
  allowTaggedNotes: boolean;
  allowAssigneeEdit: boolean;
  hasNotes: boolean;
  noteCount: number;
  notePreview?: string;
  parentTaskId: number | null;
};

type TaskNoteRow = { note: { id: number; content: string }; author: string };

type UserOption = { id: number; username: string };

type TaskFormState = {
  title: string;
  assigneeUserId: string;
  dueAt: string;
  assignerNotes: string;
  isUrgent: boolean;
  allowSubtasks: boolean;
  allowTaggedNotes: boolean;
  allowAssigneeEdit: boolean;
  remindAt: string;
};

const EMPTY_FORM: TaskFormState = {
  title: "",
  assigneeUserId: "",
  dueAt: "",
  assignerNotes: "",
  isUrgent: false,
  allowSubtasks: false,
  allowTaggedNotes: false,
  allowAssigneeEdit: false,
  remindAt: "",
};

type UrgencyFilter = "all" | "urgent" | "non-urgent";
type TaskSortKey = "dueAt" | "assignee" | "assigner";

function compareNullableDates(
  a: string | Date | null,
  b: string | Date | null,
): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function notifyTasksChanged() {
  window.dispatchEvent(new Event("tasks-changed"));
}

function formatDueDate(value: string | Date | null) {
  if (!value) return "No due date";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString();
}

function taskToForm(task: ItemTaskRow): TaskFormState {
  return {
    title: task.title,
    assigneeUserId: String(task.assigneeUserId),
    dueAt: task.dueAt ? task.dueAt.slice(0, 16) : "",
    assignerNotes: task.assignerNotes ?? "",
    isUrgent: task.isUrgent,
    allowSubtasks: task.allowSubtasks,
    allowTaggedNotes: task.allowTaggedNotes,
    allowAssigneeEdit: task.allowAssigneeEdit,
    remindAt: "",
  };
}

export function ItemTaskSection({ item }: { item: ItineraryItem }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, taskPermissions, canManageUsers } = useAuth();
  const [tasks, setTasks] = useState<ItemTaskRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingTask, setEditingTask] = useState<ItemTaskRow | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [cantCompleteReason, setCantCompleteReason] = useState<Record<number, string>>({});
  const [pendingCantCompleteId, setPendingCantCompleteId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<TaskNoteRow[] | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [sortKey, setSortKey] = useState<TaskSortKey>("dueAt");
  const openedTaskRef = useRef<number | null>(null);

  const canAssign = taskPermissions.some(
    (entry) => entry.canAssign || entry.canAssignForOthers,
  );

  const selectedPerm = useMemo(
    () => taskPermissions.find((entry) => entry.canAssign || entry.canAssignForOthers),
    [taskPermissions],
  );

  const assigneeOptions = useMemo(() => {
    if (!user) return users;
    if (canManageUsers || canAssign) return users;
    return users.filter((option) => option.id === user.id);
  }, [users, user, canManageUsers, canAssign]);

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/tasks");
    if (!response.ok) return;
    const rows = await response.json();
    setTasks(
      rows.filter((task: { itemId: number | null }) => task.itemId === item.id),
    );
  }, [item.id]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

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
      setUsers([{ id: currentUser.id, username: currentUser.username }]);
    }
    void loadUsers();
  }, [canManageUsers, canAssign, user]);

  useEffect(() => {
    if (searchParams.get("createTask") === "1" && canAssign) {
      setMode("create");
      setForm({
        ...EMPTY_FORM,
        assigneeUserId: user ? String(user.id) : "",
      });
    }
  }, [searchParams, canAssign, user]);

  function canEditTask(task: ItemTaskRow) {
    const isAssignee = task.assigneeUserId === user?.id;
    const isAssigner = task.createdByUserId === user?.id;
    const canEditAsAssigner =
      canAssign &&
      (user?.isAdmin ||
        isAssigner ||
        selectedPerm?.canAssign ||
        selectedPerm?.canAssignForOthers);
    const canEditAsAssignee = isAssignee && task.allowAssigneeEdit;
    return Boolean(canEditAsAssigner || canEditAsAssignee);
  }

  useEffect(() => {
    const taskParam = searchParams.get("task");
    if (!taskParam) {
      openedTaskRef.current = null;
      setFocusTaskId(null);
      return;
    }
    const taskId = Number(taskParam);
    if (!taskId || openedTaskRef.current === taskId) return;

    const task = tasks.find((row) => row.id === taskId);
    if (!task) return;

    openedTaskRef.current = taskId;
    if (canEditTask(task)) {
      void startEdit(task);
      return;
    }
    setMode("list");
    setFocusTaskId(taskId);
  }, [searchParams, tasks, user, canAssign, selectedPerm]);

  useEffect(() => {
    if (!focusTaskId) return;
    document
      .getElementById(`task-row-${focusTaskId}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusTaskId, mode, tasks]);

  function clearTaskQueryParams() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("createTask");
    params.delete("task");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function returnToList() {
    setMode("list");
    setEditingTask(null);
    setEditingNotes(null);
    setForm(EMPTY_FORM);
    setError(null);
    setFocusTaskId(null);
    clearTaskQueryParams();
  }

  function startCreate() {
    setMode("create");
    setEditingTask(null);
    setForm({
      ...EMPTY_FORM,
      assigneeUserId: user ? String(user.id) : "",
    });
    setError(null);
    setStatus(null);
  }

  async function startEdit(task: ItemTaskRow) {
    setMode("edit");
    setEditingTask(task);
    setForm(taskToForm(task));
    setEditingNotes(null);
    setError(null);
    setStatus(null);

    const response = await fetch(`/api/tasks/${task.id}`);
    if (response.ok) {
      const details = await response.json();
      setEditingNotes(details.notes ?? []);
    }
  }

  async function createTask() {
    if (!form.title.trim()) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        dayId: item.dayId ?? null,
        title: form.title.trim(),
        assigneeUserId: Number(form.assigneeUserId) || user?.id,
        dueAt: form.dueAt || null,
        assignerNotes: form.assignerNotes || null,
        isUrgent: form.isUrgent,
        allowSubtasks: form.allowSubtasks,
        allowTaggedNotes: form.allowTaggedNotes,
        allowAssigneeEdit: form.allowAssigneeEdit,
        remindAt: form.remindAt || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to create task.");
      return;
    }
    setStatus("Task created.");
    returnToList();
    await loadTasks();
    notifyTasksChanged();
  }

  async function saveTask() {
    if (!editingTask || !form.title.trim()) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/${editingTask.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title.trim(),
        assignerNotes: form.assignerNotes || null,
        dueAt: form.dueAt || null,
        allowSubtasks: form.allowSubtasks,
        allowTaggedNotes: form.allowTaggedNotes,
        allowAssigneeEdit: form.allowAssigneeEdit,
        remindAt: form.remindAt || null,
        ...(canAssign
          ? {
              assigneeUserId: Number(form.assigneeUserId) || editingTask.assigneeUserId,
              isUrgent: form.isUrgent,
            }
          : {}),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save task.");
      return;
    }
    setStatus("Task updated.");
    returnToList();
    await loadTasks();
    notifyTasksChanged();
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
    setPendingCantCompleteId(null);
    await loadTasks();
    notifyTasksChanged();
  }

  function handleStatusChange(task: ItemTaskRow, nextStatus: TaskStatus) {
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
    if (editingTask?.id === taskId) returnToList();
    await loadTasks();
    notifyTasksChanged();
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
    const detailsResponse = await fetch(`/api/tasks/${taskId}`);
    if (detailsResponse.ok) {
      const details = await detailsResponse.json();
      setEditingNotes(details.notes ?? []);
    }
    await loadTasks();
    notifyTasksChanged();
  }

  const rootTasks = useMemo(() => {
    let list = tasks.filter((task) => !task.parentTaskId);

    if (urgencyFilter === "urgent") {
      list = list.filter((task) => task.isUrgent);
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
  }, [tasks, urgencyFilter, sortKey, user?.isAdmin]);
  const subtasksByParent = useMemo(() => {
    const map = new Map<number, ItemTaskRow[]>();
    for (const task of tasks) {
      if (task.parentTaskId) {
        const list = map.get(task.parentTaskId) ?? [];
        list.push(task);
        map.set(task.parentTaskId, list);
      }
    }
    return map;
  }, [tasks]);

  if (tasks.length === 0 && !canAssign && mode === "list") return null;

  function renderTaskRow(task: ItemTaskRow, depth = 0) {
    const isAssignee = task.assigneeUserId === user?.id;
    const isAssigner = task.createdByUserId === user?.id;
    const canEditAsAssigner =
      canAssign &&
      (user?.isAdmin ||
        isAssigner ||
        selectedPerm?.canAssign ||
        selectedPerm?.canAssignForOthers);
    const canEditAsAssignee = isAssignee && task.allowAssigneeEdit;

    return (
      <div key={task.id} id={`task-row-${task.id}`}>
        <div
          className={[
            "flex flex-col gap-2 rounded-xl border border-stone-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
            depth > 0 ? "ml-6 border-dashed bg-stone-50/80" : "",
            focusTaskId === task.id ? "ring-2 ring-amber-300" : "",
          ].join(" ")}
        >
          <div className="min-w-0">
            <p className="font-medium text-stone-800">
              {depth > 0 ? "↳ " : ""}
              {task.title}
              {task.isUrgent ? (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-red-200">
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
              {isAssignee ? "Assigned to you" : `Assigned to ${task.assignee}`}
              {" · "}
              {formatDueDate(task.dueAt)}
            </p>
            {task.status === "cant_complete" && task.statusReason && (
              <p className="mt-1 text-sm text-amber-800">
                Reason: {task.statusReason}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {(canEditAsAssigner || canEditAsAssignee) && mode === "list" && (
              <button
                type="button"
                onClick={() => startEdit(task)}
                className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
            {user?.isAdmin && mode === "list" && (
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
                  onChange={(event) =>
                    handleStatusChange(task, event.target.value as TaskStatus)
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
                      onChange={(event) =>
                        setCantCompleteReason((current) => ({
                          ...current,
                          [task.id]: event.target.value,
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
            )}
          </div>
        </div>
        {(subtasksByParent.get(task.id) ?? []).map((subtask) =>
          renderTaskRow(subtask, depth + 1),
        )}
      </div>
    );
  }

  if (mode === "create" || mode === "edit") {
    return (
      <div className="border-t border-stone-100 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
              {mode === "create" ? "New task" : "Edit task"}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              For itinerary item: <span className="font-medium">{item.title}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={returnToList}
            className="rounded-full border border-stone-200 p-2 text-stone-500 hover:bg-stone-50"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <TaskFormFields
          form={form}
          setForm={setForm}
          assigneeOptions={assigneeOptions}
          showReminder={mode === "create"}
          showAssignee={canAssign}
          showAssigneeEditToggle={canAssign}
        />

        {mode === "edit" && editingNotes && editingNotes.length > 0 && (
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
              Notes
            </p>
            <div className="mt-2 space-y-2">
              {editingNotes.map(({ note, author }) => (
                <div
                  key={note.id}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <div>
                    <p className="text-stone-700">{note.content}</p>
                    <p className="mt-0.5 text-xs text-stone-400">{author}</p>
                  </div>
                  {user?.isAdmin && editingTask && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deleteNote(editingTask.id, note.id)}
                      className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !form.title.trim()}
            onClick={() => void (mode === "create" ? createTask() : saveTask())}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {mode === "create" ? "Create task" : "Save changes"}
          </button>
          {mode === "edit" && user?.isAdmin && editingTask && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void deleteTask(editingTask.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete task
            </button>
          )}
          <button
            type="button"
            onClick={returnToList}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-stone-100 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Tasks
        </h3>
        {canAssign && (
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-deep hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add task
          </button>
        )}
      </div>

      {status && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      )}

      {tasks.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
            <input
              type="checkbox"
              checked={urgencyFilter === "urgent"}
              onChange={(event) =>
                setUrgencyFilter(event.target.checked ? "urgent" : "all")
              }
              className="h-4 w-4 rounded border-stone-300"
            />
            <span className="font-medium text-stone-700">Urgent only</span>
          </label>
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
      )}

      {rootTasks.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">
          {urgencyFilter === "urgent"
            ? "No urgent tasks for this item."
            : "No tasks linked to this item yet."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {rootTasks.map((task) => renderTaskRow(task))}
        </div>
      )}
    </div>
  );
}

function TaskFormFields({
  form,
  setForm,
  assigneeOptions,
  showReminder,
  showAssignee,
  showAssigneeEditToggle,
}: {
  form: TaskFormState;
  setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  assigneeOptions: UserOption[];
  showReminder: boolean;
  showAssignee: boolean;
  showAssigneeEditToggle: boolean;
}) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Title</span>
        <input
          value={form.title}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      {showAssignee && (
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Assignee</span>
          <select
            value={form.assigneeUserId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                assigneeUserId: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            {assigneeOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.username}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Due date</span>
        <input
          type="datetime-local"
          value={form.dueAt}
          onChange={(event) =>
            setForm((current) => ({ ...current, dueAt: event.target.value }))
          }
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Assigner notes</span>
        <textarea
          value={form.assignerNotes}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              assignerNotes: event.target.value,
            }))
          }
          rows={2}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      {showReminder && (
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Reminder</span>
          <input
            type="datetime-local"
            value={form.remindAt}
            onChange={(event) =>
              setForm((current) => ({ ...current, remindAt: event.target.value }))
            }
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isUrgent}
          onChange={(event) =>
            setForm((current) => ({ ...current, isUrgent: event.target.checked }))
          }
        />
        Urgent
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.allowSubtasks}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              allowSubtasks: event.target.checked,
            }))
          }
        />
        Allow subtasks
      </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={form.allowTaggedNotes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                allowTaggedNotes: event.target.checked,
              }))
            }
          />
          Allow tagged notes
        </label>
        {showAssigneeEditToggle && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.allowAssigneeEdit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  allowAssigneeEdit: event.target.checked,
                }))
              }
            />
            Allow assignee to edit this task
          </label>
        )}
      </div>
  );
}
