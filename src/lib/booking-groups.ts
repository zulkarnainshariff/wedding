export type BookingGroup = {
  reference: string;
  travellers: string[];
  /** Other PNR codes cross-linked at the airline (separate bookings, travelling together). */
  linkedWith?: string[];
};

export function groupsFromFlatMap(
  map?: Record<string, string>,
  legacy?: string | null,
): BookingGroup[] {
  if (map && Object.keys(map).length > 0) {
    const byRef = new Map<string, string[]>();
    for (const [name, ref] of Object.entries(map)) {
      const key = ref.trim();
      if (!key) continue;
      const list = byRef.get(key) ?? [];
      list.push(name);
      byRef.set(key, list);
    }
    return [...byRef.entries()].map(([reference, travellers]) => ({
      reference,
      travellers,
    }));
  }
  if (legacy?.trim()) {
    return [{ reference: legacy.trim(), travellers: [] }];
  }
  return [];
}

export function groupsFromDetails(details: Record<string, unknown>): BookingGroup[] {
  if (Array.isArray(details.bookingGroups) && details.bookingGroups.length > 0) {
    return normalizeBookingGroupLinks(
      (details.bookingGroups as BookingGroup[]).map((group) => ({
        reference: group.reference ?? "",
        travellers: Array.isArray(group.travellers) ? group.travellers : [],
        linkedWith: Array.isArray(group.linkedWith) ? group.linkedWith : undefined,
      })),
    );
  }
  return groupsFromFlatMap(
    details.bookingReferences as Record<string, string> | undefined,
    details.bookingReference as string | null,
  );
}

export function flatMapFromGroups(groups: BookingGroup[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const group of groups) {
    const ref = group.reference.trim();
    if (!ref) continue;
    for (const traveller of group.travellers) {
      const name = traveller.trim();
      if (name && name !== "Everyone") result[name] = ref;
    }
  }
  return result;
}

export function otherBookingReferences(
  groups: BookingGroup[],
  currentIndex: number,
): string[] {
  const current = groups[currentIndex]?.reference.trim();
  return [
    ...new Set(
      groups
        .map((group, index) =>
          index === currentIndex ? "" : group.reference.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

export function normalizeBookingGroupLinks(
  groups: BookingGroup[],
): BookingGroup[] {
  const refs = new Set(
    groups.map((group) => group.reference.trim()).filter(Boolean),
  );

  const next = groups.map((group) => ({
    ...group,
    linkedWith: [...new Set(group.linkedWith ?? [])]
      .map((ref) => ref.trim())
      .filter(
        (ref) => ref && refs.has(ref) && ref !== group.reference.trim(),
      ),
  }));

  for (const group of next) {
    const myRef = group.reference.trim();
    if (!myRef) continue;
    for (const otherRef of group.linkedWith ?? []) {
      const other = next.find((entry) => entry.reference.trim() === otherRef);
      if (other && !(other.linkedWith ?? []).includes(myRef)) {
        other.linkedWith = [...(other.linkedWith ?? []), myRef];
      }
    }
  }

  return next;
}

export function remapBookingReference(
  groups: BookingGroup[],
  index: number,
  newReference: string,
): BookingGroup[] {
  const oldRef = groups[index]?.reference.trim();
  const next = groups.map((group, groupIndex) =>
    groupIndex === index ? { ...group, reference: newReference } : { ...group },
  );

  if (!oldRef) return next;

  const newRef = newReference.trim();
  if (oldRef === newRef) return next;

  return normalizeBookingGroupLinks(
    next.map((group) => ({
      ...group,
      linkedWith: (group.linkedWith ?? []).map((ref) =>
        ref === oldRef ? newRef : ref,
      ),
    })),
  );
}

export function updateBookingGroupLinks(
  groups: BookingGroup[],
  index: number,
  linkedWith: string[],
): BookingGroup[] {
  const myRef = groups[index]?.reference.trim();
  if (!myRef) {
    const next = [...groups];
    next[index] = { ...next[index], linkedWith };
    return next;
  }

  const sanitized = linkedWith.filter((ref) => ref.trim() && ref.trim() !== myRef);
  const previous = new Set(groups[index].linkedWith ?? []);
  const selected = new Set(sanitized);

  const next = groups.map((group) => ({
    ...group,
    linkedWith: [...(group.linkedWith ?? [])],
  }));
  next[index].linkedWith = sanitized;

  for (const otherRef of otherBookingReferences(groups, index)) {
    const otherIndex = next.findIndex(
      (group) => group.reference.trim() === otherRef,
    );
    if (otherIndex === -1) continue;

    const wasLinked = previous.has(otherRef);
    const isLinked = selected.has(otherRef);

    if (isLinked && !wasLinked) {
      if (!next[otherIndex].linkedWith!.includes(myRef)) {
        next[otherIndex].linkedWith!.push(myRef);
      }
    } else if (!isLinked && wasLinked) {
      next[otherIndex].linkedWith = next[otherIndex].linkedWith!.filter(
        (ref) => ref !== myRef,
      );
    }
  }

  return next;
}

export function removeBookingGroup(
  groups: BookingGroup[],
  index: number,
): BookingGroup[] {
  const removedRef = groups[index]?.reference.trim();
  if (!removedRef) return groups.filter((_, groupIndex) => groupIndex !== index);

  return normalizeBookingGroupLinks(
    groups
      .filter((_, groupIndex) => groupIndex !== index)
      .map((group) => ({
        ...group,
        linkedWith: (group.linkedWith ?? []).filter((ref) => ref !== removedRef),
      })),
  );
}

export function formatBookingGroupsDisplay(
  groups?: BookingGroup[],
  flat?: Record<string, string>,
  legacy?: string | null,
): string | null {
  const resolved =
    groups && groups.length > 0
      ? groups.filter((group) => group.reference.trim())
      : groupsFromFlatMap(flat, legacy).filter((group) => group.reference.trim());

  if (!resolved.length) return legacy?.trim() || null;

  const linkPairs = new Set<string>();
  for (const group of resolved) {
    for (const otherRef of group.linkedWith ?? []) {
      const pair = [group.reference.trim(), otherRef].sort().join(" ↔ ");
      linkPairs.add(pair);
    }
  }

  const refs = resolved
    .map((group) => {
      const names =
        group.travellers.length > 0 ? group.travellers.join(" / ") : "Booking";
      return `${names}: ${group.reference.trim()}`;
    })
    .join(" · ");

  if (!linkPairs.size) return refs;

  const linkedNote = [...linkPairs]
    .map((pair) => `${pair} linked at airline`)
    .join(" · ");

  return `${refs} (${linkedNote})`;
}
