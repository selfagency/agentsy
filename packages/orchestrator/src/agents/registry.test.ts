import { describe, expect, it } from "vitest";

import type { AgentCapabilities } from "../types/index.js";
import { AgentRegistry } from "./registry.js";

function createAgent(
  overrides: Partial<AgentCapabilities> = {}
): AgentCapabilities {
  return {
    available: overrides.available ?? true,
    costPerTask: overrides.costPerTask ?? 0.1,
    id: overrides.id ?? "agent-1",
    lastSeen: overrides.lastSeen ?? new Date("2026-01-01T00:00:00.000Z"),
    maxConcurrency: overrides.maxConcurrency ?? 1,
    name: overrides.name ?? "Agent 1",
    skills: overrides.skills ?? [
      {
        capabilities: ["summarize"],
        category: "nlp",
        id: "skill-1",
        name: "summarization",
        proficiency: "advanced",
      },
    ],
  };
}

describe(AgentRegistry, () => {
  it("registers and unregisters agents and updates skill lookup", () => {
    const registry = new AgentRegistry();
    const agent = createAgent({ id: "agent-a" });

    registry.register(agent);

    expect(registry.getAgent("agent-a")).toStrictEqual(agent);
    expect(
      registry.findAgentsBySkill("summarization").map((item) => item.id)
    ).toStrictEqual(["agent-a"]);

    registry.unregister("agent-a");

    expect(registry.getAgent("agent-a")).toBeUndefined();
    expect(registry.findAgentsBySkill("summarization")).toStrictEqual([]);
  });

  it("finds agents by multiple skills with proficiency checks", () => {
    const registry = new AgentRegistry();

    registry.register(
      createAgent({
        id: "agent-expert",
        skills: [
          {
            capabilities: ["coding"],
            category: "language",
            id: "skill-ts",
            name: "typescript",
            proficiency: "expert",
          },
          {
            capabilities: ["unit-tests"],
            category: "quality",
            id: "skill-test",
            name: "testing",
            proficiency: "advanced",
          },
        ],
      })
    );

    registry.register(
      createAgent({
        id: "agent-beginner",
        skills: [
          {
            capabilities: ["coding"],
            category: "language",
            id: "skill-ts-low",
            name: "typescript",
            proficiency: "beginner",
          },
          {
            capabilities: ["unit-tests"],
            category: "quality",
            id: "skill-test-low",
            name: "testing",
            proficiency: "intermediate",
          },
        ],
      })
    );

    const matched = registry.findAgentsBySkills([
      { name: "typescript", proficiency: "advanced" },
      { name: "testing", proficiency: "advanced" },
    ]);

    expect(matched.map((item) => item.id)).toStrictEqual(["agent-expert"]);
  });

  it("updates agent availability and lastSeen", () => {
    const registry = new AgentRegistry();
    const originalLastSeen = new Date("2026-01-01T00:00:00.000Z");

    registry.register(
      createAgent({
        available: true,
        id: "agent-update",
        lastSeen: originalLastSeen,
      })
    );

    registry.updateAvailability("agent-update", false);

    const updated = registry.getAgent("agent-update");
    expect(updated?.available).toBeFalsy();
    expect(updated?.lastSeen.getTime()).toBeGreaterThanOrEqual(
      originalLastSeen.getTime()
    );
  });
});
