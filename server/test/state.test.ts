import { describe, expect, it } from "vitest";
import { createState, joinParticipant, markDisconnected, updateParticipant } from "../src/state";
import { Question } from "../src/types";

describe("state helpers", () => {
  const questions: Question[] = [{ id: "q1", text: "Question one" }];

  it("tracks join, update, and submit", () => {
    const state = createState(questions);
    const participant = joinParticipant(state, "Ada", true, 1000);

    expect(participant.connected).toBe(true);
    expect(participant.joinedAt).toBe(1000);
    expect(participant.hasSubscription).toBe(true);
    expect(state.participants.size).toBe(1);

    const updated = updateParticipant(
      state,
      participant.id,
      { q1: "Answer" },
      false,
      true,
      2000
    );

    expect(updated?.submitted).toBe(true);
    expect(updated?.answers.q1).toBe("Answer");
    expect(updated?.hasSubscription).toBe(false);
    expect(updated?.updatedAt).toBe(2000);
  });

  it("marks participants disconnected", () => {
    const state = createState(questions);
    const participant = joinParticipant(state, "Riley", false, 3000);

    const updated = markDisconnected(state, participant.id, 4000);
    expect(updated?.connected).toBe(false);
    expect(updated?.updatedAt).toBe(4000);
  });
});
