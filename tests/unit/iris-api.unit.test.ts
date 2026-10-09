/**
 * Unit tests for iris-api.ts fetchThreadPage — RED/GREEN
 */
import { fetchThreadPage, PAGE_SIZE } from "../../src/lib/iris-api";
import { setCredentials, clearCredentials } from "../../src/lib/auth";

const mockListThreads = jest.fn();
jest.mock("@techgod/iris-client", () => ({
  IrisClient: jest.fn().mockImplementation(() => ({
    listThreads: mockListThreads,
  })),
  ApiError: class ApiError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, body: unknown) {
      super(`HTTP ${status}`);
      this.name = "ApiError";
      this.status = status;
      this.body = body;
    }
  },
}));

const CREDS = { baseUrl: "https://iris.test.invalid", token: "tok_test" };

// Valid synthetic thread fixture — UUIDs, descending dates
const makeThread = (i: number) => ({
  id: `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`,
  source: "gmail",
  provider_instance: "pilot@example.invalid",
  title: `Thread ${i}`,
  last_message_at: `2026-10-${String(20 - (i % 20)).padStart(2, "0")}T10:00:00Z`,
  unread_count: 0,
});

const PAGE1 = Array.from({ length: PAGE_SIZE }, (_, i) => makeThread(i));

describe("fetchThreadPage", () => {
  beforeEach(() => {
    setCredentials(CREDS);
    mockListThreads.mockReset();
  });
  afterEach(() => clearCredentials());

  it("throws when not authenticated", async () => {
    clearCredentials();
    await expect(fetchThreadPage()).rejects.toThrow("Not authenticated");
  });

  it("calls listThreads with limit=PAGE_SIZE and no cursor on first page", async () => {
    mockListThreads.mockResolvedValue([]);
    await fetchThreadPage();
    expect(mockListThreads).toHaveBeenCalledWith({ limit: PAGE_SIZE });
  });

  it("calls listThreads with cursor when provided", async () => {
    mockListThreads.mockResolvedValue([]);
    const cursor = "2026-10-01T00:00:00Z|gmail|some-uuid";
    await fetchThreadPage(cursor);
    expect(mockListThreads).toHaveBeenCalledWith({ limit: PAGE_SIZE, cursor });
  });

  it("returns refined threads from valid records", async () => {
    mockListThreads.mockResolvedValue([makeThread(0)]);
    const page = await fetchThreadPage();
    expect(page.threads).toHaveLength(1);
    expect(page.threads[0].id).toBe(makeThread(0).id);
    expect(page.threads[0].title).toBe("Thread 0");
  });

  it("rejects malformed records without claiming a partial successful page", async () => {
    const bad = { source: "gmail", last_message_at: "2026-10-01T00:00:00Z" };
    mockListThreads.mockResolvedValue([bad, makeThread(1)]);
    await expect(fetchThreadPage()).rejects.toThrow("Invalid thread response");
  });

  it("rejects non-array response with a non-sensitive error", async () => {
    mockListThreads.mockResolvedValue({ error: "private fixture content" });
    await expect(fetchThreadPage()).rejects.toThrow("Invalid thread response");
  });

  it("returns nextCursor=null when fewer than PAGE_SIZE raw items", async () => {
    mockListThreads.mockResolvedValue([makeThread(0)]);
    const page = await fetchThreadPage();
    expect(page.nextCursor).toBeNull();
  });

  it("returns non-null nextCursor when exactly PAGE_SIZE raw items returned", async () => {
    mockListThreads.mockResolvedValue(PAGE1);
    const page = await fetchThreadPage();
    expect(page.nextCursor).not.toBeNull();
    const last = page.threads[page.threads.length - 1];
    // cursor format: last_message_at|source|id
    expect(page.nextCursor).toBe(
      `${last.last_message_at}|${last.source}|${last.id}`
    );
  });

  it("cursor does not contain empty timestamp (NaN protection)", async () => {
    mockListThreads.mockResolvedValue(PAGE1);
    const page = await fetchThreadPage();
    expect(page.nextCursor).not.toContain("||");
  });

  it("propagates ApiError 401 from listThreads", async () => {
    const { ApiError } = jest.requireMock("@techgod/iris-client");
    mockListThreads.mockRejectedValue(new ApiError(401, { error: "Unauthorized" }));
    await expect(fetchThreadPage()).rejects.toMatchObject({ status: 401 });
  });
});
