import { describe, expect, it } from "vitest";
import { buildGroups, PRESENTER_ID } from "../src/grouping";
import { Participant } from "../src/types";

function makeParticipant(id: number, hasSubscription: boolean): Participant {
  return {
    id: `p-${id}`,
    name: `Participant ${id}`,
    hasSubscription,
    answers: {},
    submitted: false,
    connected: true,
    joinedAt: 0,
    updatedAt: 0
  };
}

function pick<T>(items: T[], random: () => number) {
  const index = Math.floor(random() * items.length);
  return items[index];
}

describe("buildGroups", () => {
  it("requires at least 8 participants", () => {
    const participants = Array.from({ length: 7 }, (_, index) =>
      makeParticipant(index + 1, index < 4)
    );
    const result = buildGroups(participants, { includePresenter: false });
    expect("error" in result).toBe(true);
  });

  it("creates four groups with at least one paid subscriber when possible", () => {
    const participants = Array.from({ length: 8 }, (_, index) =>
      makeParticipant(index + 1, index < 4)
    );
    const result = buildGroups(participants, {
      includePresenter: false,
      random: () => 0.42
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.groups).toHaveLength(4);
    const sizes = result.groups.map((group) => group.participantIds.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

    const paidIds = new Set(
      participants.filter((p) => p.hasSubscription).map((p) => p.id)
    );
    for (const group of result.groups) {
      const hasPaid = group.participantIds.some((id) => paidIds.has(id));
      expect(hasPaid).toBe(true);
      expect(group.label).toBe("agentic");
    }
  });

  it("includes presenter when requested for paid scarcity", () => {
    const participants = Array.from({ length: 8 }, (_, index) =>
      makeParticipant(index + 1, index < 3)
    );
    const result = buildGroups(participants, {
      includePresenter: true,
      random: () => 0.2
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    const allIds = result.groups.flatMap((group) => group.participantIds);
    expect(allIds).toContain(PRESENTER_ID);
    expect(result.presenterIncluded).toBe(true);
  });

  it("labels two agentic and two non-agentic groups when paid < 4", () => {
    const participants = Array.from({ length: 8 }, (_, index) =>
      makeParticipant(index + 1, index < 3)
    );
    const result = buildGroups(participants, {
      includePresenter: false,
      random: () => 0.55
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    const labels = result.groups.map((group) => group.label);
    const agenticCount = labels.filter((label) => label === "agentic").length;
    const nonAgenticCount = labels.filter((label) => label === "non-agentic").length;
    expect(agenticCount).toBe(2);
    expect(nonAgenticCount).toBe(2);
  });

  it("fills agentic groups with paid subscribers when available", () => {
    const participants = Array.from({ length: 12 }, (_, index) =>
      makeParticipant(index + 1, index < 3)
    );
    const result = buildGroups(participants, {
      includePresenter: true,
      random: () => 0.01
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    const paidIds = new Set(
      participants.filter((p) => p.hasSubscription).map((p) => p.id)
    );
    paidIds.add(PRESENTER_ID);
    const agenticGroups = result.groups.filter(
      (group) => group.label === "agentic"
    );
    for (const group of agenticGroups) {
      const paidCount = group.participantIds.filter((id) => paidIds.has(id))
        .length;
      expect(paidCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("spreads participants into balanced groups", () => {
    const participants = Array.from({ length: 11 }, (_, index) =>
      makeParticipant(index + 1, index % 2 === 0)
    );
    const result = buildGroups(participants, {
      includePresenter: false,
      random: () => 0.77
    });

    if ("error" in result) {
      throw new Error(result.error);
    }

    const sizes = result.groups.map((group) => group.participantIds.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(result.groups.flatMap((group) => group.participantIds)).toHaveLength(
      participants.length
    );
  });
});
