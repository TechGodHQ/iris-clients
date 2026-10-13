/**
 * Unit tests for thread refinement — RED/GREEN
 */
import { refineThread, ThreadRefinementError } from "../../src/types/thread";

// Synthetic test UUIDs — no real addresses
const UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "550e8400-e29b-41d4-a716-446655440001";

describe("refineThread", () => {
  it("refines a complete valid thread record", () => {
    const raw = {
      id: UUID_A,
      source: "gmail",
      provider_instance: "testprovider@example.invalid",
      title: "Project update",
      last_message_at: "2026-10-09T14:00:00Z",
      unread_count: 3,
    };
    const t = refineThread(raw as Record<string, unknown>);
    expect(t.id).toBe(UUID_A);
    expect(t.source).toBe("gmail");
    expect(t.provider_instance).toBe("testprovider@example.invalid");
    expect(t.title).toBe("Project update");
    expect(t.last_message_at).toBe("2026-10-09T14:00:00Z");
    expect(t.unread_count).toBe(3);
  });

  it("handles null title", () => {
    const raw = {
      id: UUID_A,
      source: "slack",
      provider_instance: "workspace.example.invalid",
      title: null,
      last_message_at: "2026-10-01T00:00:00Z",
    };
    const t = refineThread(raw as Record<string, unknown>);
    expect(t.title).toBeNull();
  });

  it("handles absent optional provider_instance with empty-string fallback", () => {
    const raw = {
      id: UUID_A,
      source: "imap",
      last_message_at: "2026-09-30T00:00:00Z",
    };
    const t = refineThread(raw as Record<string, unknown>);
    expect(t.provider_instance).toBe("");
  });

  it("handles absent optional unread_count with 0 default", () => {
    const raw = {
      id: UUID_A,
      source: "imap",
      last_message_at: "2026-09-30T00:00:00Z",
    };
    const t = refineThread(raw as Record<string, unknown>);
    expect(t.unread_count).toBe(0);
  });

  // Mandatory field rejection tests

  it("rejects record with missing id", () => {
    const raw = { source: "gmail", last_message_at: "2026-10-01T00:00:00Z" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow(
      ThreadRefinementError
    );
  });

  it("rejects record with empty string id", () => {
    const raw = { id: "", source: "gmail", last_message_at: "2026-10-01T00:00:00Z" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow(
      ThreadRefinementError
    );
  });

  it("rejects record with numeric id", () => {
    const raw = { id: 12345, source: "gmail", last_message_at: "2026-10-01T00:00:00Z" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow(
      ThreadRefinementError
    );
  });

  it("rejects record with missing source", () => {
    const raw = { id: UUID_A, last_message_at: "2026-10-01T00:00:00Z" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow(
      ThreadRefinementError
    );
  });

  it("rejects record with missing last_message_at", () => {
    const raw = { id: UUID_A, source: "gmail" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow(
      ThreadRefinementError
    );
  });

  it("rejects record with invalid date in last_message_at", () => {
    const raw = { id: UUID_A, source: "gmail", last_message_at: "not-a-date" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow(
      ThreadRefinementError
    );
  });

  it("does not coerce numeric id to string (rejects)", () => {
    const raw = { id: 99, source: "gmail", last_message_at: "2026-10-01T00:00:00Z" };
    expect(() => refineThread(raw as Record<string, unknown>)).toThrow();
  });
});
