/**
 * useThreads hook with in-flight guard to prevent pagination races.
 * - Single in-flight request at a time (via generation counter)
 * - Preserves existing rows on page-load-more error with inline error
 * - Logout/unmount/new-credentials invalidate stale responses
 * - FlatList onEndReached disabled in favour of explicit Load More button
 *   for browser-first pilot (avoids infinite auto-fetch against fixtures)
 */
import { useState, useCallback, useRef } from "react";
import { fetchThreadPage, ApiError, type ThreadPage } from "../lib/iris-api";
import type { IrisThread } from "../types/thread";

export type ThreadsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; threads: IrisThread[]; nextCursor: string | null; loadMoreError: string | null }
  | { status: "error"; message: string };

export function useThreads() {
  const [state, setState] = useState<ThreadsState>({ status: "idle" });
  // Generation counter: incremented on logout/reset so stale callbacks ignore results
  const genRef = useRef(0);
  // In-flight guard: true while any fetch is running
  const inflightRef = useRef(false);

  const load = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    const gen = ++genRef.current;
    setState({ status: "loading" });
    try {
      const page: ThreadPage = await fetchThreadPage();
      if (genRef.current !== gen) return; // stale — logout happened
      setState({
        status: "loaded",
        threads: page.threads,
        nextCursor: page.nextCursor,
        loadMoreError: null,
      });
    } catch (err) {
      if (genRef.current !== gen) return;
      if (err instanceof ApiError && err.status === 401) {
        setState({ status: "error", message: "Unauthorized — check your token" });
      } else {
        setState({ status: "error", message: "Failed to load threads" });
      }
    } finally {
      inflightRef.current = false;
    }
  }, []);

  const loadMore = useCallback(async (cursor: string) => {
    if (inflightRef.current) return; // prevent race
    if (state.status !== "loaded") return;
    const existingThreads = state.threads;
    const existingCursor = state.nextCursor;
    inflightRef.current = true;
    const gen = genRef.current;
    // Optimistically keep loaded state; clear loadMoreError
    setState({ status: "loaded", threads: existingThreads, nextCursor: existingCursor, loadMoreError: null });
    try {
      const page: ThreadPage = await fetchThreadPage(cursor);
      if (genRef.current !== gen) return;
      // Deduplicate by provider_instance+id
      const seen = new Set(existingThreads.map(t => `${t.provider_instance}:${t.id}`));
      const fresh = page.threads.filter(t => !seen.has(`${t.provider_instance}:${t.id}`));
      setState({
        status: "loaded",
        threads: [...existingThreads, ...fresh],
        nextCursor: page.nextCursor,
        loadMoreError: null,
      });
    } catch (err) {
      if (genRef.current !== gen) return;
      // Preserve existing rows, surface inline error
      const msg = err instanceof ApiError && err.status === 401
        ? "Unauthorized"
        : "Failed to load more threads";
      setState({
        status: "loaded",
        threads: existingThreads,
        nextCursor: existingCursor,
        loadMoreError: msg,
      });
    } finally {
      inflightRef.current = false;
    }
  }, [state]);

  const reset = useCallback(() => {
    genRef.current++; // invalidate any in-flight
    inflightRef.current = false;
    setState({ status: "idle" });
  }, []);

  return { state, load, loadMore, reset };
}
