import { describe, expect, it } from "vitest";

import { createSchedulerRegistry, createTaskScheduler } from "./index.js";

describe(createSchedulerRegistry, () => {
  it("registers pending and scheduled tasks", () => {
    const registry = createSchedulerRegistry();

    const pending = registry.register({ id: "pending", prompt: "run soon" });
    const scheduled = registry.register({
      id: "scheduled",
      lane: "nightly",
      prompt: "run later",
      runAt: Date.now() + 1000,
    });

    expect(pending.status).toBe("pending");
    expect(scheduled.status).toBe("scheduled");
    expect(registry.list()).toHaveLength(2);
  });

  it("cancels existing tasks", () => {
    const registry = createSchedulerRegistry([
      { id: "task-1", prompt: "hello" },
    ]);

    const cancelled = registry.cancel("task-1");

    expect(cancelled?.status).toBe("cancelled");
    expect(registry.get("task-1")?.status).toBe("cancelled");
  });

  it("filters tasks by lane and status", () => {
    const registry = createSchedulerRegistry([
      { id: "a", lane: "default", prompt: "alpha" },
      { id: "b", lane: "nightly", prompt: "beta", runAt: Date.now() + 100 },
    ]);

    expect(registry.list({ lane: "nightly" })).toHaveLength(1);
    expect(registry.list({ status: "scheduled" })).toHaveLength(1);
  });

  it("returns null when cancelling unknown tasks", () => {
    const registry = createSchedulerRegistry();

    expect(registry.cancel("missing")).toBeNull();
  });

  it("creates scheduling decisions via createTaskScheduler", async () => {
    const registry = createSchedulerRegistry();
    const scheduler = createTaskScheduler(registry);

    const decision = await scheduler.schedule({
      agents: [{ available: true, id: "agent-1" }],
      taskInfo: { id: "task-1", input: { value: 1 }, name: "Task 1" },
    });

    expect(decision).toStrictEqual({
      agentId: "agent-1",
      assigned: true,
      status: "scheduled",
    });
    expect(registry.get("task-1")?.metadata).toMatchObject({
      assignedAgentId: "agent-1",
    });
  });

  it("returns null when no eligible agent is available", async () => {
    const scheduler = createTaskScheduler();

    await expect(
      scheduler.schedule({
        agents: [{ nope: true }],
        taskInfo: { id: "task-2", name: "Task 2" },
      })
    ).resolves.toBeNull();
  });

  it("passes through function scheduling tasks unchanged", async () => {
    const scheduler = createTaskScheduler();

    await expect(scheduler.schedule(async () => "done")).resolves.toBe("done");
  });
});
