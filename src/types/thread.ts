/**
 * Guarded refinement of the opaque Thread record from @techgod/iris-client.
 * Mandatory fields (id, source, last_message_at) are validated at runtime;
 * records missing them are rejected with a typed error so bad data surfaces
 * before it reaches the UI.
 */
import type { Thread } from "@techgod/iris-client";

export interface IrisThread {
  id: string;               // UUID - mandatory
  source: string;           // provider type - mandatory
  provider_instance: string; // may be absent on legacy records
  title: string | null;
  last_message_at: string;  // RFC-3339 - mandatory for valid cursor
  unread_count: number;
}

export class ThreadRefinementError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "ThreadRefinementError";
  }
}

export function refineThread(raw: Thread): IrisThread {
  const r = raw as Record<string, unknown>;

  // Mandatory: id
  if (typeof r.id !== "string" || r.id.length === 0) {
    throw new ThreadRefinementError(
      `Thread missing required field 'id': got ${JSON.stringify(r.id)}`
    );
  }

  // Mandatory: source
  if (typeof r.source !== "string" || r.source.length === 0) {
    throw new ThreadRefinementError(
      `Thread missing required field 'source': got ${JSON.stringify(r.source)}`
    );
  }

  // Mandatory: last_message_at (required for stable cursor)
  if (typeof r.last_message_at !== "string" || r.last_message_at.length === 0) {
    throw new ThreadRefinementError(
      `Thread missing required field 'last_message_at': got ${JSON.stringify(r.last_message_at)}`
    );
  }

  // Validate last_message_at parses as a real date (don't silently emit NaN)
  const d = new Date(r.last_message_at);
  if (isNaN(d.getTime())) {
    throw new ThreadRefinementError(
      `Thread 'last_message_at' is not a valid date: ${r.last_message_at}`
    );
  }

  // Optional / nullable
  const provider_instance =
    typeof r.provider_instance === "string" ? r.provider_instance : "";
  const title = typeof r.title === "string" ? r.title : null;
  const unread_count = typeof r.unread_count === "number" ? r.unread_count : 0;

  return {
    id: r.id,
    source: r.source,
    provider_instance,
    title,
    last_message_at: r.last_message_at,
    unread_count,
  };
}
