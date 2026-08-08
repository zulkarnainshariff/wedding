"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderInput, Maximize2, Pencil, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MultiSelectFilter } from "@/components/gallery/MultiSelectFilter";
import {
  GALLERY_PAGE_SIZE,
  parseCommaList,
  photoLocationLabel,
  photoPreviewUrl,
} from "@/lib/gallery-photo-utils";
import type {
  GalleryAlbum,
  GalleryEvent,
  GalleryPeopleTag,
  GalleryPhoto,
} from "@/components/admin/GalleryManagementPanel";
import type { GalleryAlbumMoveTagMode } from "@/components/admin/PublicFeaturesPanel";

type BriefUser = { id: number; username: string };

type PeopleTagDraft = {
  guestName: string;
  email: string;
  userId: string;
};

type PhotoFormState = {
  eventId: string;
  albumId: string;
  albumName: string;
  url: string;
  caption: string;
  isPrivate: boolean;
  people: PeopleTagDraft[];
  groupings: string[];
  newGroupings: string;
};

function tagsToDraft(tags: GalleryPeopleTag[]): PeopleTagDraft[] {
  if (tags.length === 0) {
    return [{ guestName: "", email: "", userId: "" }];
  }
  return tags.map((tag) => ({
    guestName: tag.guestName,
    email: tag.email ?? "",
    userId: tag.userId ? String(tag.userId) : "",
  }));
}

function draftToTags(people: PeopleTagDraft[]): GalleryPeopleTag[] {
  const seen = new Set<string>();
  const tags: GalleryPeopleTag[] = [];
  for (const row of people) {
    const guestName = row.guestName.trim();
    if (!guestName) continue;
    const key = guestName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push({
      guestName,
      email: row.email.trim() || null,
      userId: row.userId ? Number(row.userId) : null,
      username: null,
    });
  }
  return tags;
}

function photoToForm(photo: GalleryPhoto): PhotoFormState {
  return {
    eventId: String(photo.eventId),
    albumId: photo.albumId ? String(photo.albumId) : "",
    albumName: "",
    url: photo.url,
    caption: photo.caption ?? "",
    isPrivate: Boolean(photo.isPrivate),
    people: tagsToDraft(photo.tags),
    groupings: [...(photo.groupings ?? [])],
    newGroupings: "",
  };
}

function mergeGroupingTags(
  selected: string[],
  newTagsText: string,
): string[] {
  return [
    ...new Set(
      [...selected, ...parseCommaList(newTagsText)]
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

function GroupingTagsEditor({
  selected,
  newTags,
  knownTags,
  onSelectedChange,
  onNewTagsChange,
}: {
  selected: string[];
  newTags: string;
  knownTags: string[];
  onSelectedChange: (tags: string[]) => void;
  onNewTagsChange: (value: string) => void;
}) {
  const options = useMemo(() => {
    const set = new Set(knownTags.map((tag) => tag.trim()).filter(Boolean));
    for (const tag of selected) {
      if (tag.trim()) set.add(tag.trim());
    }
    return [...set]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => ({ value: tag, label: tag }));
  }, [knownTags, selected]);

  return (
    <div className="space-y-2">
      <span className="block text-sm text-stone-500">Tags</span>
      {options.length > 0 ? (
        <MultiSelectFilter
          label="Tags"
          emptyLabel="Select tags…"
          options={options}
          selected={selected}
          onChange={onSelectedChange}
        />
      ) : null}
      <input
        value={newTags}
        onChange={(e) => onNewTagsChange(e.target.value)}
        placeholder="Or type new tags, comma-separated"
        className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function PeopleTagsEditor({
  people,
  users,
  knownNames,
  onChange,
}: {
  people: PeopleTagDraft[];
  users: BriefUser[];
  knownNames: string[];
  onChange: (people: PeopleTagDraft[]) => void;
}) {
  const [multiPick, setMultiPick] = useState<string[]>([]);

  const nameOptions = useMemo(() => {
    const set = new Set(knownNames.map((name) => name.trim()).filter(Boolean));
    for (const row of people) {
      if (row.guestName.trim()) set.add(row.guestName.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [knownNames, people]);

  function addSelectedNames() {
    if (multiPick.length === 0) return;
    const existing = new Set(
      people.map((row) => row.guestName.trim().toLowerCase()).filter(Boolean),
    );
    const next = [...people];
    // Fill a blank trailing row first, if present.
    const blankIndex = next.findIndex((row) => !row.guestName.trim());
    for (const name of multiPick) {
      const trimmed = name.trim();
      if (!trimmed || existing.has(trimmed.toLowerCase())) continue;
      existing.add(trimmed.toLowerCase());
      if (blankIndex >= 0 && !next[blankIndex].guestName.trim()) {
        next[blankIndex] = {
          ...next[blankIndex],
          guestName: trimmed,
        };
      } else {
        next.push({ guestName: trimmed, email: "", userId: "" });
      }
    }
    onChange(next.length > 0 ? next : [{ guestName: "", email: "", userId: "" }]);
    setMultiPick([]);
  }

  return (
    <div className="space-y-3">
      <span className="block text-sm text-stone-500">People</span>
      {nameOptions.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-stone-100 bg-white p-3">
          <div className="min-w-[12rem] flex-1">
            <MultiSelectFilter
              label="Add names"
              emptyLabel="Select people…"
              options={nameOptions.map((name) => ({
                value: name,
                label: name,
              }))}
              selected={multiPick}
              onChange={setMultiPick}
            />
          </div>
          <button
            type="button"
            disabled={multiPick.length === 0}
            onClick={addSelectedNames}
            className="rounded-lg bg-brand-deep px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add selected ({multiPick.length})
          </button>
        </div>
      ) : null}
      {people.map((row, index) => {
        const hasEmail = Boolean(row.email.trim());
        const hasUser = Boolean(row.userId);
        return (
          <div
            key={index}
            className="grid gap-2 rounded-lg border border-stone-100 bg-stone-50/80 p-3 sm:grid-cols-2"
          >
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-xs text-stone-500">
                Name (select or type new)
              </span>
              <input
                list={`gallery-people-names-${index}`}
                value={row.guestName}
                onChange={(e) => {
                  const next = [...people];
                  next[index] = { ...row, guestName: e.target.value };
                  onChange(next);
                }}
                placeholder="Name"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
              />
              <datalist id={`gallery-people-names-${index}`}>
                {nameOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-stone-500">
                Email (optional)
              </span>
              <input
                type="email"
                value={row.email}
                disabled={hasUser}
                onChange={(e) => {
                  const next = [...people];
                  next[index] = {
                    ...row,
                    email: e.target.value,
                    userId: "",
                  };
                  onChange(next);
                }}
                placeholder="name@example.com"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-stone-500">
                Linked user (optional)
              </span>
              <select
                value={row.userId}
                disabled={hasEmail}
                onChange={(e) => {
                  const userId = e.target.value;
                  const matched = users.find(
                    (user) => String(user.id) === userId,
                  );
                  const next = [...people];
                  next[index] = {
                    ...row,
                    userId,
                    email: "",
                    guestName: matched ? matched.username : row.guestName,
                  };
                  onChange(next);
                }}
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400"
              >
                <option value="">Not linked</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    @{user.username}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => onChange(people.filter((_, i) => i !== index))}
                className="text-xs text-stone-500 hover:text-red-600"
              >
                Remove person
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() =>
          onChange([...people, { guestName: "", email: "", userId: "" }])
        }
        className="inline-flex items-center gap-1 text-sm text-brand-deep"
      >
        <Plus className="h-3.5 w-3.5" />
        Add person
      </button>
    </div>
  );
}

function GalleryPhotoEditDialog({
  photo,
  events,
  albums,
  users,
  knownPeopleNames,
  knownTags,
  busy,
  onClose,
  onSave,
}: {
  photo: GalleryPhoto;
  events: GalleryEvent[];
  albums: GalleryAlbum[];
  users: BriefUser[];
  knownPeopleNames: string[];
  knownTags: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (form: PhotoFormState) => void;
}) {
  const [form, setForm] = useState(() => photoToForm(photo));
  const isUploaded = photo.url.startsWith("/api/gallery/media/");

  useEffect(() => {
    setForm(photoToForm(photo));
  }, [photo]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-edit-title"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4">
          <h2
            id="gallery-edit-title"
            className="font-serif text-xl text-brand-deep"
          >
            Edit photo
          </h2>
          <div className="mt-4 grid gap-4">
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Event</span>
              <select
                value={form.eventId}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    eventId: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Album</span>
              <select
                value={form.albumId}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    albumId: e.target.value,
                    albumName: "",
                  }))
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              >
                <option value="">No album</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.name}
                  </option>
                ))}
              </select>
            </label>
            {!form.albumId ? (
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Or create album</span>
                <input
                  value={form.albumName}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      albumName: e.target.value,
                    }))
                  }
                  placeholder="New album name"
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
            ) : null}
            {!isUploaded ? (
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Photo URL</span>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, url: e.target.value }))
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
            ) : (
              <p className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                Uploaded file — URL cannot be changed. Reassign the album or tags
                below.
              </p>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Caption (optional)</span>
              <input
                value={form.caption}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    caption: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.isPrivate}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    isPrivate: e.target.checked,
                  }))
                }
              />
              <span>
                <span className="font-medium text-stone-800">Private</span>
                <span className="mt-0.5 block text-xs text-stone-500">
                  Hidden when not logged in as admin. Only admins can see private
                  photos.
                </span>
              </span>
            </label>
            <PeopleTagsEditor
              people={form.people}
              users={users}
              knownNames={knownPeopleNames}
              onChange={(people) =>
                setForm((current) => ({ ...current, people }))
              }
            />
            <GroupingTagsEditor
              selected={form.groupings}
              newTags={form.newGroupings}
              knownTags={knownTags}
              onSelectedChange={(groupings) =>
                setForm((current) => ({ ...current, groupings }))
              }
              onNewTagsChange={(newGroupings) =>
                setForm((current) => ({ ...current, newGroupings }))
              }
            />
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-stone-100 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSave(form)}
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveAlbumDialog({
  photoCount,
  albums,
  busy,
  onClose,
  onConfirm,
}: {
  photoCount: number;
  albums: GalleryAlbum[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (target: { albumId: string; albumName: string }) => void;
}) {
  const [albumId, setAlbumId] = useState("");
  const [albumName, setAlbumName] = useState("");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-move-title"
      >
        <h2 id="gallery-move-title" className="font-serif text-xl text-brand-deep">
          Move {photoCount} photo{photoCount === 1 ? "" : "s"}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Destination album</span>
            <select
              value={albumId}
              onChange={(e) => {
                setAlbumId(e.target.value);
                setAlbumName("");
              }}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="">No album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.name}
                </option>
              ))}
            </select>
          </label>
          {!albumId ? (
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">
                Or create new album
              </span>
              <input
                value={albumName}
                onChange={(e) => setAlbumName(e.target.value)}
                placeholder="sorted"
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm({ albumId, albumName: albumName.trim() })}
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Moving…" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

type BulkEditPayload = {
  eventId?: string;
  albumMode: "unchanged" | "set";
  albumId: string;
  albumName: string;
  privateMode: "unchanged" | "private" | "public";
  peopleNames: string[];
  newPeopleNames: string;
  tagNames: string[];
  newTags: string;
};

function BulkEditDialog({
  photoCount,
  events,
  albums,
  knownPeopleNames,
  knownTags,
  busy,
  onClose,
  onConfirm,
}: {
  photoCount: number;
  events: GalleryEvent[];
  albums: GalleryAlbum[];
  knownPeopleNames: string[];
  knownTags: string[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: BulkEditPayload) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [albumMode, setAlbumMode] = useState<"unchanged" | "set">("unchanged");
  const [albumId, setAlbumId] = useState("");
  const [albumName, setAlbumName] = useState("");
  const [privateMode, setPrivateMode] = useState<
    "unchanged" | "private" | "public"
  >("unchanged");
  const [peopleNames, setPeopleNames] = useState<string[]>([]);
  const [newPeopleNames, setNewPeopleNames] = useState("");
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [newTags, setNewTags] = useState("");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-bulk-edit-title"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6 pb-4">
          <h2
            id="gallery-bulk-edit-title"
            className="font-serif text-xl text-brand-deep"
          >
            Edit {photoCount} photo{photoCount === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Only filled fields are applied. People and tags are added to each
            selected photo.
          </p>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Event</span>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              >
                <option value="">Don&apos;t change</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="block text-sm text-stone-500">Album</span>
              <select
                value={albumMode}
                onChange={(e) =>
                  setAlbumMode(e.target.value as "unchanged" | "set")
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                <option value="unchanged">Don&apos;t change</option>
                <option value="set">Set album</option>
              </select>
              {albumMode === "set" ? (
                <>
                  <select
                    value={albumId}
                    onChange={(e) => {
                      setAlbumId(e.target.value);
                      setAlbumName("");
                    }}
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  >
                    <option value="">No album</option>
                    {albums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                  {!albumId ? (
                    <input
                      value={albumName}
                      onChange={(e) => setAlbumName(e.target.value)}
                      placeholder="Or create new album"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Privacy</span>
              <select
                value={privateMode}
                onChange={(e) =>
                  setPrivateMode(
                    e.target.value as "unchanged" | "private" | "public",
                  )
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              >
                <option value="unchanged">Don&apos;t change</option>
                <option value="private">Mark private</option>
                <option value="public">Remove private</option>
              </select>
            </label>

            <div className="space-y-2">
              <span className="block text-sm text-stone-500">Add people</span>
              {knownPeopleNames.length > 0 ? (
                <MultiSelectFilter
                  label="People"
                  emptyLabel="Select people…"
                  options={knownPeopleNames.map((name) => ({
                    value: name,
                    label: name,
                  }))}
                  selected={peopleNames}
                  onChange={setPeopleNames}
                />
              ) : null}
              <input
                value={newPeopleNames}
                onChange={(e) => setNewPeopleNames(e.target.value)}
                placeholder="Or type new names, comma-separated"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <span className="block text-sm text-stone-500">Add tags</span>
              {knownTags.length > 0 ? (
                <MultiSelectFilter
                  label="Tags"
                  emptyLabel="Select tags…"
                  options={knownTags.map((tag) => ({
                    value: tag,
                    label: tag,
                  }))}
                  selected={tagNames}
                  onChange={setTagNames}
                />
              ) : null}
              <input
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Or type new tags, comma-separated"
                className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-stone-100 bg-white px-6 py-4">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm({
                eventId,
                albumMode,
                albumId,
                albumName: albumName.trim(),
                privateMode,
                peopleNames,
                newPeopleNames,
                tagNames,
                newTags,
              })
            }
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PreviousAlbumTagDialog({
  albumNames,
  busy,
  onClose,
  onDecide,
}: {
  albumNames: string[];
  busy: boolean;
  onClose: () => void;
  onDecide: (decision: {
    addTags: boolean;
    remember: "ask" | "always" | "never";
  }) => void;
}) {
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [alwaysAdd, setAlwaysAdd] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-prev-album-title"
      >
        <h2
          id="gallery-prev-album-title"
          className="font-serif text-xl text-brand-deep"
        >
          Add previous album as tag?
        </h2>
        <p className="mt-2 text-sm text-stone-500">
          Tag these photos with their previous album name
          {albumNames.length === 1 ? "" : "s"} so you can still filter by{" "}
          {albumNames.map((name) => `"${name}"`).join(", ")}.
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={alwaysAdd}
              onChange={(e) => {
                setAlwaysAdd(e.target.checked);
                if (e.target.checked) setDontAskAgain(false);
              }}
            />
            <span>Always add previous album name as tags</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={dontAskAgain}
              onChange={(e) => {
                setDontAskAgain(e.target.checked);
                if (e.target.checked) setAlwaysAdd(false);
              }}
            />
            <span>Don&apos;t ask this again</span>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onDecide({
                addTags: false,
                remember: dontAskAgain ? "never" : "ask",
              })
            }
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600 disabled:opacity-50"
          >
            Don&apos;t add
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              onDecide({
                addTags: true,
                remember: alwaysAdd || dontAskAgain ? "always" : "ask",
              })
            }
            className="rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Add tags
          </button>
        </div>
      </div>
    </div>
  );
}

function GalleryPhotoLightbox({
  photo,
  onClose,
}: {
  photo: GalleryPhoto;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={photo.caption ?? photo.eventName}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 z-10 rounded-full bg-stone-900/70 p-2 text-white shadow-sm transition hover:bg-stone-900"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? photo.eventName}
          className="max-h-[78vh] w-full rounded-2xl bg-stone-900 object-contain shadow-2xl"
        />
        <div className="mt-3 rounded-xl bg-white/95 px-4 py-3 text-sm shadow-lg">
          {photo.caption ? (
            <p className="font-medium text-stone-800">{photo.caption}</p>
          ) : null}
          <p className="text-stone-500">
            {photoLocationLabel(photo)}
            {photo.isPrivate ? " · Private" : ""}
          </p>
          {photo.tags.length > 0 ? (
            <p className="mt-1 text-stone-500">
              People:{" "}
              {photo.tags
                .map((tag) =>
                  tag.username
                    ? `${tag.guestName} (@${tag.username})`
                    : tag.email
                      ? `${tag.guestName} (${tag.email})`
                      : tag.guestName,
                )
                .join(", ")}
            </p>
          ) : null}
          {(photo.groupings?.length ?? 0) > 0 ? (
            <p className="mt-1 text-stone-500">
              Tags: {photo.groupings.join(", ")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function GalleryPhotoCard({
  photo,
  editable = false,
  selectable = false,
  selected = false,
  busy = false,
  onSelectChange,
  onEdit,
  onDelete,
}: {
  photo: GalleryPhoto;
  editable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  busy?: boolean;
  onSelectChange?: (selected: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  function handleImageClick() {
    if (busy) return;
    if (selectable) {
      onSelectChange?.(!selected);
      return;
    }
    setExpanded(true);
  }

  return (
    <>
      <figure
        className={[
          "group overflow-hidden rounded-xl border bg-white",
          selected ? "border-brand-deep ring-2 ring-brand-deep/30" : "border-stone-200",
        ].join(" ")}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoPreviewUrl(photo)}
            alt={photo.caption ?? photo.eventName}
            loading="lazy"
            decoding="async"
            className={[
              "h-full w-full object-contain",
              selectable ? "cursor-pointer" : "cursor-zoom-in",
            ].join(" ")}
            onClick={handleImageClick}
            role="presentation"
          />
          {selectable ? (
            <label
              className="absolute top-2 left-2 z-10 rounded-md bg-white/95 px-1.5 py-1 shadow-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected}
                disabled={busy}
                onChange={(e) => onSelectChange?.(e.target.checked)}
                aria-label={`Select photo ${photo.id}`}
              />
            </label>
          ) : null}
          {photo.isPrivate ? (
            <span className="absolute bottom-2 left-2 z-10 rounded bg-stone-900/75 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
              Private
            </span>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => setExpanded(true)}
            className="absolute top-2 right-2 z-10 rounded-lg bg-white/95 p-2 text-stone-700 shadow-sm transition hover:bg-white disabled:opacity-50"
            aria-label="View larger"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {editable ? (
            <div
              className={[
                "absolute z-10 flex gap-1",
                selectable ? "top-2 left-10" : "top-2 left-2",
              ].join(" ")}
            >
              <button
                type="button"
                disabled={busy}
                onClick={onEdit}
                className="rounded-lg bg-white/95 p-2 text-stone-700 shadow-sm hover:bg-white disabled:opacity-50"
                aria-label="Edit photo"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onDelete}
                className="rounded-lg bg-white/95 p-2 text-red-600 shadow-sm hover:bg-white disabled:opacity-50"
                aria-label="Delete photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
        <figcaption className="px-3 py-2 text-sm">
          {photo.caption && (
            <p className="font-medium text-stone-800">{photo.caption}</p>
          )}
          <p className="text-xs text-stone-400">{photoLocationLabel(photo)}</p>
          {photo.tags.length > 0 && (
            <p className="mt-1 text-xs text-stone-500">
              {photo.tags.map((tag) => tag.guestName).join(", ")}
            </p>
          )}
          {(photo.groupings?.length ?? 0) > 0 && (
            <p className="mt-1 text-xs text-brand-deep/80">
              {photo.groupings.join(" · ")}
            </p>
          )}
        </figcaption>
      </figure>

      {expanded ? (
        <GalleryPhotoLightbox photo={photo} onClose={() => setExpanded(false)} />
      ) : null}
    </>
  );
}

function GalleryLoadMore({
  visible,
  total,
  onLoadMore,
}: {
  visible: number;
  total: number;
  onLoadMore: () => void;
}) {
  if (visible >= total) {
    if (total <= GALLERY_PAGE_SIZE) return null;
    return (
      <p className="mt-6 text-center text-xs text-stone-500">
        Showing all {total} photos
      </p>
    );
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <p className="text-xs text-stone-500">
        Showing {visible} of {total} photos
      </p>
      <button
        type="button"
        onClick={onLoadMore}
        className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
      >
        Load more
      </button>
    </div>
  );
}

export function GalleryPublicPhotoGrid({
  photos,
  paginationKey = "",
}: {
  photos: GalleryPhoto[];
  paginationKey?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(GALLERY_PAGE_SIZE);
  }, [paginationKey]);

  const visiblePhotos = useMemo(
    () => photos.slice(0, visibleCount),
    [photos, visibleCount],
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePhotos.map((photo) => (
          <GalleryPhotoCard key={photo.id} photo={photo} />
        ))}
      </div>
      <GalleryLoadMore
        visible={visiblePhotos.length}
        total={photos.length}
        onLoadMore={() =>
          setVisibleCount((current) => current + GALLERY_PAGE_SIZE)
        }
      />
    </>
  );
}

export function GalleryEditablePhotoGrid({
  photos,
  events,
  albums = [],
  albumMoveTagMode = "ask",
  paginationKey = "",
  knownPeopleNames: knownPeopleNamesProp,
  knownTags: knownTagsProp,
  onAlbumMoveTagModeChange,
  onAlbumsChange,
  onPhotoUpdated,
  onPhotoRemoved,
  onPhotosMoved,
}: {
  photos: GalleryPhoto[];
  events: GalleryEvent[];
  albums?: GalleryAlbum[];
  albumMoveTagMode?: GalleryAlbumMoveTagMode;
  /** Change this when filters change so the page resets to the first chunk. */
  paginationKey?: string;
  /** Preferred people name list (e.g. from gallery filter options). */
  knownPeopleNames?: string[];
  knownTags?: string[];
  onAlbumMoveTagModeChange?: (mode: GalleryAlbumMoveTagMode) => void;
  onAlbumsChange?: (albums: GalleryAlbum[]) => void;
  onPhotoUpdated?: (photo: GalleryPhoto) => void;
  onPhotoRemoved?: (photoId: number) => void;
  onPhotosMoved?: (photos: GalleryPhoto[]) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [pendingBulk, setPendingBulk] = useState<{
    payload: BulkEditPayload;
    previousNames: string[];
  } | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    albumId: string;
    albumName: string;
    previousNames: string[];
  } | null>(null);
  const [users, setUsers] = useState<BriefUser[]>([]);
  const [moveTagMode, setMoveTagMode] =
    useState<GalleryAlbumMoveTagMode>(albumMoveTagMode);
  const [visibleCount, setVisibleCount] = useState(GALLERY_PAGE_SIZE);

  useEffect(() => {
    setMoveTagMode(albumMoveTagMode);
  }, [albumMoveTagMode]);

  useEffect(() => {
    setVisibleCount(GALLERY_PAGE_SIZE);
    setSelectedIds(new Set());
  }, [paginationKey]);

  useEffect(() => {
    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: BriefUser[]) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, []);

  const visiblePhotos = useMemo(
    () => photos.slice(0, visibleCount),
    [photos, visibleCount],
  );

  const knownPeopleNames = useMemo(() => {
    const names = new Set<string>(
      (knownPeopleNamesProp ?? []).map((name) => name.trim()).filter(Boolean),
    );
    for (const photo of photos) {
      for (const tag of photo.tags) {
        if (tag.guestName.trim()) names.add(tag.guestName.trim());
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [knownPeopleNamesProp, photos]);

  const knownTags = useMemo(() => {
    const tags = new Set<string>(
      (knownTagsProp ?? []).map((tag) => tag.trim()).filter(Boolean),
    );
    for (const photo of photos) {
      for (const grouping of photo.groupings ?? []) {
        if (grouping.trim()) tags.add(grouping.trim());
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [knownTagsProp, photos]);

  const selectedCount = selectedIds.size;
  const selectedPhotos = useMemo(
    () => photos.filter((photo) => selectedIds.has(photo.id)),
    [photos, selectedIds],
  );

  async function persistMoveTagMode(mode: GalleryAlbumMoveTagMode) {
    setMoveTagMode(mode);
    onAlbumMoveTagModeChange?.(mode);
    try {
      await fetch("/api/system/app-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: { galleryAlbumMoveTagMode: mode },
        }),
      });
    } catch {
      // Preference save is best-effort; move still proceeds.
    }
  }

  async function executeMove(options: {
    albumId: string;
    albumName: string;
    addPreviousAlbumAsTag: boolean;
  }) {
    const photoIds = [...selectedIds];
    if (photoIds.length === 0) return;

    setBusy(true);
    try {
      const response = await fetch("/api/gallery/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoIds,
          albumId: options.albumId ? Number(options.albumId) : null,
          albumName: options.albumName || undefined,
          addPreviousAlbumAsTag: options.addPreviousAlbumAsTag,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        photos?: GalleryPhoto[];
      };
      if (!response.ok) {
        toast.error(body.error ?? "Could not move photos.");
        return;
      }

      const moved = body.photos ?? [];
      onPhotosMoved?.(moved);
      for (const photo of moved) {
        onPhotoUpdated?.(photo);
        if (photo.albumId && photo.albumName) {
          const exists = albums.some((album) => album.id === photo.albumId);
          if (!exists) {
            onAlbumsChange?.([
              ...albums,
              { id: photo.albumId, name: photo.albumName },
            ]);
          }
        }
      }
      setSelectedIds(new Set());
      setMoveOpen(false);
      setPendingMove(null);
      toast.success(
        `Moved ${moved.length || photoIds.length} photo${
          (moved.length || photoIds.length) === 1 ? "" : "s"
        }.`,
      );
    } catch {
      toast.error("Could not move photos.");
    } finally {
      setBusy(false);
    }
  }

  async function executeBulkUpdate(
    payload: BulkEditPayload,
    addPreviousAlbumAsTag: boolean,
  ) {
    const photoIds = [...selectedIds];
    if (photoIds.length === 0) return;

    const addPeople = [
      ...new Set([
        ...payload.peopleNames,
        ...parseCommaList(payload.newPeopleNames),
      ]),
    ].map((guestName) => ({ guestName }));
    const addGroupings = [
      ...new Set([...payload.tagNames, ...parseCommaList(payload.newTags)]),
    ];

    const body: Record<string, unknown> = { photoIds };
    if (payload.eventId) body.eventId = Number(payload.eventId);
    if (payload.albumMode === "set") {
      body.albumId = payload.albumId ? Number(payload.albumId) : null;
      if (payload.albumName) body.albumName = payload.albumName;
      body.addPreviousAlbumAsTag = addPreviousAlbumAsTag;
    }
    if (payload.privateMode === "private") body.isPrivate = true;
    if (payload.privateMode === "public") body.isPrivate = false;
    if (addPeople.length > 0) body.addPeople = addPeople;
    if (addGroupings.length > 0) body.addGroupings = addGroupings;

    setBusy(true);
    try {
      const response = await fetch("/api/gallery/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        photos?: GalleryPhoto[];
      };
      if (!response.ok) {
        toast.error(result.error ?? "Could not update photos.");
        return;
      }

      const updated = result.photos ?? [];
      onPhotosMoved?.(updated);
      for (const photo of updated) {
        onPhotoUpdated?.(photo);
        if (photo.albumId && photo.albumName) {
          const exists = albums.some((album) => album.id === photo.albumId);
          if (!exists) {
            onAlbumsChange?.([
              ...albums,
              { id: photo.albumId, name: photo.albumName },
            ]);
          }
        }
      }
      setSelectedIds(new Set());
      setBulkEditOpen(false);
      setPendingBulk(null);
      toast.success(
        `Updated ${updated.length || photoIds.length} photo${
          (updated.length || photoIds.length) === 1 ? "" : "s"
        }.`,
      );
    } catch {
      toast.error("Could not update photos.");
    } finally {
      setBusy(false);
    }
  }

  function beginBulkEdit(payload: BulkEditPayload) {
    const hasPeople =
      payload.peopleNames.length > 0 ||
      parseCommaList(payload.newPeopleNames).length > 0;
    const hasTags =
      payload.tagNames.length > 0 || parseCommaList(payload.newTags).length > 0;
    const hasEvent = Boolean(payload.eventId);
    const hasPrivate = payload.privateMode !== "unchanged";
    const hasAlbum = payload.albumMode === "set";

    if (!hasPeople && !hasTags && !hasEvent && !hasPrivate && !hasAlbum) {
      toast.error("Choose at least one change to apply.");
      return;
    }

    if (!hasAlbum) {
      void executeBulkUpdate(payload, false);
      return;
    }

    const previousNames = [
      ...new Set(
        selectedPhotos
          .map((photo) => photo.albumName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ];

    if (previousNames.length === 0 || moveTagMode === "never") {
      void executeBulkUpdate(payload, false);
      return;
    }
    if (moveTagMode === "always") {
      void executeBulkUpdate(payload, true);
      return;
    }

    setPendingBulk({ payload, previousNames });
  }

  function beginMove(target: { albumId: string; albumName: string }) {
    const previousNames = [
      ...new Set(
        selectedPhotos
          .map((photo) => photo.albumName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ];

    if (previousNames.length === 0 || moveTagMode === "never") {
      void executeMove({ ...target, addPreviousAlbumAsTag: false });
      return;
    }
    if (moveTagMode === "always") {
      void executeMove({ ...target, addPreviousAlbumAsTag: true });
      return;
    }

    setPendingMove({ ...target, previousNames });
  }

  async function savePhoto(form: PhotoFormState) {
    if (!editingPhoto) return;

    const eventId = Number(form.eventId);
    if (!eventId) {
      toast.error("Event is required.");
      return;
    }

    const isUploaded = editingPhoto.url.startsWith("/api/gallery/media/");
    const url = form.url.trim();
    if (!isUploaded && !url) {
      toast.error("Photo URL is required.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/gallery/${editingPhoto.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          albumId: form.albumId ? Number(form.albumId) : null,
          albumName: form.albumName.trim() || undefined,
          url: isUploaded ? editingPhoto.url : url,
          caption: form.caption.trim() || null,
          isPrivate: form.isPrivate,
          tags: draftToTags(form.people),
          groupings: mergeGroupingTags(form.groupings, form.newGroupings),
        }),
      });

      if (!response.ok) {
        toast.error("Could not update photo.");
        return;
      }

      const updated = (await response.json()) as GalleryPhoto;
      onPhotoUpdated?.(updated);
      if (updated.albumId && updated.albumName) {
        const exists = albums.some((album) => album.id === updated.albumId);
        if (!exists) {
          onAlbumsChange?.([
            ...albums,
            { id: updated.albumId, name: updated.albumName },
          ]);
        }
      }
      setEditingPhoto(null);
      toast.success("Photo updated.");
    } catch {
      toast.error("Could not update photo.");
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId: number) {
    setBusy(true);
    try {
      const response = await fetch(`/api/gallery/${photoId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Could not remove photo.");
        return;
      }
      onPhotoRemoved?.(photoId);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(photoId);
        return next;
      });
      toast.success("Photo removed.");
    } catch {
      toast.error("Could not remove photo.");
    } finally {
      setBusy(false);
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || photos.length === 0}
          onClick={() =>
            setSelectedIds(
              selectedCount === photos.length
                ? new Set()
                : new Set(photos.map((photo) => photo.id)),
            )
          }
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
        >
          {selectedCount === photos.length && photos.length > 0
            ? "Clear selection"
            : "Select all"}
        </button>
        <button
          type="button"
          disabled={busy || selectedCount === 0}
          onClick={() => setBulkEditOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-deep px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Edit selected {selectedCount > 0 ? `(${selectedCount})` : ""}
        </button>
        <button
          type="button"
          disabled={busy || selectedCount === 0}
          onClick={() => setMoveOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
        >
          <FolderInput className="h-3.5 w-3.5" />
          Move album
        </button>
        {selectedCount > 0 ? (
          <span className="text-xs text-stone-500">
            {selectedCount} selected
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visiblePhotos.map((photo) => (
          <GalleryPhotoCard
            key={photo.id}
            photo={photo}
            editable
            selectable
            selected={selectedIds.has(photo.id)}
            busy={busy}
            onSelectChange={(checked) => {
              setSelectedIds((current) => {
                const next = new Set(current);
                if (checked) next.add(photo.id);
                else next.delete(photo.id);
                return next;
              });
            }}
            onEdit={() => setEditingPhoto(photo)}
            onDelete={() => setPendingDeleteId(photo.id)}
          />
        ))}
      </div>

      <GalleryLoadMore
        visible={visiblePhotos.length}
        total={photos.length}
        onLoadMore={() =>
          setVisibleCount((current) => current + GALLERY_PAGE_SIZE)
        }
      />

      {editingPhoto && (
        <GalleryPhotoEditDialog
          photo={editingPhoto}
          events={events}
          albums={albums}
          users={users}
          knownPeopleNames={knownPeopleNames}
          knownTags={knownTags}
          busy={busy}
          onClose={() => {
            if (!busy) setEditingPhoto(null);
          }}
          onSave={(form) => void savePhoto(form)}
        />
      )}

      {moveOpen ? (
        <MoveAlbumDialog
          photoCount={selectedCount}
          albums={albums}
          busy={busy}
          onClose={() => {
            if (!busy) setMoveOpen(false);
          }}
          onConfirm={(target) => beginMove(target)}
        />
      ) : null}

      {bulkEditOpen ? (
        <BulkEditDialog
          photoCount={selectedCount}
          events={events}
          albums={albums}
          knownPeopleNames={knownPeopleNames}
          knownTags={knownTags}
          busy={busy}
          onClose={() => {
            if (!busy) setBulkEditOpen(false);
          }}
          onConfirm={(payload) => beginBulkEdit(payload)}
        />
      ) : null}

      {pendingMove ? (
        <PreviousAlbumTagDialog
          albumNames={pendingMove.previousNames}
          busy={busy}
          onClose={() => {
            if (!busy) setPendingMove(null);
          }}
          onDecide={(decision) => {
            if (decision.remember !== "ask") {
              void persistMoveTagMode(decision.remember);
            }
            void executeMove({
              albumId: pendingMove.albumId,
              albumName: pendingMove.albumName,
              addPreviousAlbumAsTag: decision.addTags,
            });
          }}
        />
      ) : null}

      {pendingBulk ? (
        <PreviousAlbumTagDialog
          albumNames={pendingBulk.previousNames}
          busy={busy}
          onClose={() => {
            if (!busy) setPendingBulk(null);
          }}
          onDecide={(decision) => {
            if (decision.remember !== "ask") {
              void persistMoveTagMode(decision.remember);
            }
            void executeBulkUpdate(pendingBulk.payload, decision.addTags);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Remove photo?"
        message="This permanently removes the photo from the public gallery."
        confirmLabel="Remove"
        destructive
        busy={busy}
        onConfirm={() => {
          if (pendingDeleteId != null) void deletePhoto(pendingDeleteId);
        }}
        onClose={() => {
          if (!busy) setPendingDeleteId(null);
        }}
      />
    </>
  );
}
