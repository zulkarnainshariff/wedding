"use client";

import { useCallback, useState } from "react";

export function useDiscardConfirm(onDiscard: () => void) {
  const [open, setOpen] = useState(false);

  const requestDismiss = useCallback(
    (isDirty: boolean) => {
      if (!isDirty) {
        onDiscard();
        return;
      }
      setOpen(true);
    },
    [onDiscard],
  );

  const confirmDiscard = useCallback(() => {
    setOpen(false);
    onDiscard();
  }, [onDiscard]);

  const cancelDiscard = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    discardConfirmOpen: open,
    requestDismiss,
    confirmDiscard,
    cancelDiscard,
  };
}
