import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";

type HotkeysLockContextValue = {
  locked: boolean;
  acquire: () => () => void;
};

const HotkeysLockContext = createContext<HotkeysLockContextValue | null>(null);

/**
 * Provides a simple ref-counted "lock" that panels can acquire while in edit mode.
 * When locked, App-level hotkeys (tab switching, quit, help) should be disabled so typing is safe.
 */
export function HotkeysLockProvider({ children }: { children: React.ReactNode }) {
  const locksRef = useRef<Set<number>>(new Set());
  const nextIdRef = useRef(1);
  const [, forceRender] = useState(0);

  const acquire = useCallback(() => {
    const id = nextIdRef.current++;
    locksRef.current.add(id);
    forceRender((n) => n + 1);
    return () => {
      if (locksRef.current.delete(id)) {
        forceRender((n) => n + 1);
      }
    };
  }, []);

  const value = useMemo<HotkeysLockContextValue>(() => {
    return { locked: locksRef.current.size > 0, acquire };
  }, [acquire, locksRef.current.size]);

  return <HotkeysLockContext.Provider value={value}>{children}</HotkeysLockContext.Provider>;
}

export function useHotkeysLocked(): boolean {
  const ctx = useContext(HotkeysLockContext);
  return Boolean(ctx?.locked);
}

/**
 * Hook for panels with "edit mode": when active=true, acquire the global lock.
 */
export function useHotkeysLock(active: boolean): void {
  const ctx = useContext(HotkeysLockContext);
  const releaseRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!ctx) return;
    if (active && !releaseRef.current) {
      releaseRef.current = ctx.acquire();
    } else if (!active && releaseRef.current) {
      releaseRef.current();
      releaseRef.current = null;
    }
  }, [active, ctx]);

  useEffect(() => {
    return () => {
      if (releaseRef.current) {
        releaseRef.current();
        releaseRef.current = null;
      }
    };
  }, []);
}

