import { useCallback, useRef } from "react";

/**
 * Error thrown to unwind an in-progress upload/import flow once the user has
 * requested cancellation. Flows can throw this (via `throwIfCancelled`) between
 * async steps so cancellation works even while a task is still "preparing" and
 * no network request is in flight yet.
 */
export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export function isCancellation(error: unknown): boolean {
  return (
    error instanceof UploadCancelledError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "CanceledError")
  );
}

export interface UploadCancellation {
  /** Begin a new cancellable operation. Returns an AbortSignal for requests. */
  begin: () => AbortSignal;
  /** The AbortSignal for the current operation, if one is active. */
  getSignal: () => AbortSignal | undefined;
  /** Request cancellation of the current operation. */
  cancel: () => void;
  /** Whether cancellation has been requested for the current operation. */
  isCancelled: () => boolean;
  /** Throws {@link UploadCancelledError} if cancellation has been requested. */
  throwIfCancelled: () => void;
}

/**
 * Manages cancellation for upload/import flows. Combines an AbortController
 * (to abort in-flight requests) with a flag that flows check between async
 * steps, so the user can cancel at any point while the progress modal is
 * visible — including during the "preparing" phase before any upload starts.
 */
export function useUploadCancellation(): UploadCancellation {
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const begin = useCallback(() => {
    cancelledRef.current = false;
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }, []);

  const getSignal = useCallback(() => abortRef.current?.signal, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
  }, []);

  const isCancelled = useCallback(() => cancelledRef.current, []);

  const throwIfCancelled = useCallback(() => {
    if (cancelledRef.current) {
      throw new UploadCancelledError();
    }
  }, []);

  return { begin, getSignal, cancel, isCancelled, throwIfCancelled };
}
