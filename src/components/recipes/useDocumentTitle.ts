"use client";

import { useEffect } from "react";

/** Sets "<title> · CulinaryLog" while mounted; static export has no per-recipe metadata. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · CulinaryLog`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
