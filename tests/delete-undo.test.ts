import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPendingDeleteQueue, parseRemoveIds, UNDO_DELETE_MS } from "@/lib/applications/pending-delete";

describe("pending delete queue (undo window)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses a 6–8 second undo window", () => {
    expect(UNDO_DELETE_MS).toBeGreaterThanOrEqual(6000);
    expect(UNDO_DELETE_MS).toBeLessThanOrEqual(8000);
  });

  it("deletes only after the window", () => {
    const commit = vi.fn();
    const q = createPendingDeleteQueue({ commit });
    q.schedule("a");
    vi.advanceTimersByTime(UNDO_DELETE_MS - 1);
    expect(commit).not.toHaveBeenCalled();
    expect(q.pending()).toEqual(["a"]);
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledWith(["a"]);
    expect(q.pending()).toEqual([]);
  });

  it("undo cancels the delete — nothing is ever sent", () => {
    const commit = vi.fn();
    const q = createPendingDeleteQueue({ commit });
    q.schedule("a");
    vi.advanceTimersByTime(3000);
    expect(q.undo("a")).toBe(true);
    vi.advanceTimersByTime(UNDO_DELETE_MS * 2);
    expect(commit).not.toHaveBeenCalled();
    expect(q.undo("a")).toBe(false);
  });

  it("undo after the delete ran reports false", () => {
    const q = createPendingDeleteQueue({ commit: () => {} });
    q.schedule("a");
    vi.advanceTimersByTime(UNDO_DELETE_MS);
    expect(q.undo("a")).toBe(false);
  });

  it("keeps independent timers per card and ignores double clicks", () => {
    const commit = vi.fn();
    const q = createPendingDeleteQueue({ commit });
    q.schedule("a");
    q.schedule("a");
    vi.advanceTimersByTime(2000);
    q.schedule("b");
    vi.advanceTimersByTime(UNDO_DELETE_MS - 2000);
    expect(commit.mock.calls).toEqual([[["a"]]]);
    vi.advanceTimersByTime(2000);
    expect(commit.mock.calls).toEqual([[["a"]], [["b"]]]);
  });

  it("flush (page left) commits everything pending at once, then nothing more", () => {
    const commit = vi.fn();
    const q = createPendingDeleteQueue({ commit });
    q.schedule("a");
    q.schedule("b");
    q.undo("b");
    q.schedule("c");
    expect(q.flush()).toEqual(["a", "c"]);
    expect(commit).toHaveBeenCalledWith(["a", "c"]);
    vi.advanceTimersByTime(UNDO_DELETE_MS * 2);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(q.flush()).toEqual([]);
    expect(commit).toHaveBeenCalledTimes(1);
  });
});

describe("parseRemoveIds (keep-alive delete body)", () => {
  it("accepts a list of cuid-like ids, de-duplicated", () => {
    expect(parseRemoveIds({ ids: ["cmh1abc0000xyz", "cmh1abc0000xyz", "cmh2def0000uvw"] })).toEqual([
      "cmh1abc0000xyz",
      "cmh2def0000uvw",
    ]);
  });
  it("rejects junk", () => {
    expect(parseRemoveIds(null)).toBeNull();
    expect(parseRemoveIds({})).toBeNull();
    expect(parseRemoveIds({ ids: [] })).toBeNull();
    expect(parseRemoveIds({ ids: "cmh1abc0000xyz" })).toBeNull();
    expect(parseRemoveIds({ ids: [1] })).toBeNull();
    expect(parseRemoveIds({ ids: ["'; drop table x;--"] })).toBeNull();
    expect(
      parseRemoveIds({ ids: Array.from({ length: 51 }, (_, i) => `cmh${String(i).padStart(11, "0")}`) }),
    ).toBeNull();
  });
});
