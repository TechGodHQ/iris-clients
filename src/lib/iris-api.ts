/**
 * Iris client factory. Wraps @techgod/iris-client IrisClient.
 * Never exposes token to logs, error messages, or URLs.
 */
import { IrisClient, ApiError } from "@techgod/iris-client";
import { getCredentials } from "./auth";
import { refineThread, type IrisThread } from "../types/thread";

export { ApiError };

export const PAGE_SIZE = 20;

export interface ThreadPage {
  threads: IrisThread[];
  nextCursor: string | null;
}

function makeClient(): IrisClient {
  const creds = getCredentials();
  if (!creds) throw new Error("Not authenticated");
  return new IrisClient({ baseUrl: creds.baseUrl, token: creds.token });
}

export async function fetchThreadPage(cursor?: string): Promise<ThreadPage> {
  const client = makeClient();
  const params = cursor
    ? { limit: PAGE_SIZE, cursor }
    : { limit: PAGE_SIZE };
  const raw = await client.listThreads(params);

  // A malformed record must not turn an incomplete response into a successful page.
  // The generic error prevents remote content from entering UI diagnostics.
  if (!Array.isArray(raw)) throw new Error("Invalid thread response");
  let threads: IrisThread[];
  try {
    threads = raw.map(refineThread);
  } catch {
    throw new Error("Invalid thread response");
  }

  // Cursor: last_message_at|source|id — tie-safe per API contract.
  // Only emit cursor when we received a full page of VALID refined threads.
  const last = threads[threads.length - 1];
  const nextCursor =
    raw.length === PAGE_SIZE && last
      ? `${last.last_message_at}|${last.source}|${last.id}`
      : null;

  return { threads, nextCursor };
}
