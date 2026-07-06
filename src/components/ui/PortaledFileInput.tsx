"use client";

import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export function PortaledFileInput({
  inputRef,
  id,
  name,
  accept,
  onChange,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  id: string;
  name?: string;
  accept?: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="file"
      accept={accept}
      onChange={onChange}
      className="sr-only"
      tabIndex={-1}
    />,
    document.body,
  );
}
