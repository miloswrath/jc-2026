import { randomUUID } from "node:crypto";
import {
  ActivityPhase,
  Activity1Submission,
  Activity2Submission,
  Group,
  Participant,
  PresenterState,
  Question
} from "./types";

export type State = {
  questions: Question[];
  participants: Map<string, Participant>;
  groups: Group[];
  activityPhase: ActivityPhase;
  activity1Responses: Activity1Submission[];
  activity2Responses: Activity2Submission[];
};

export function createState(questions: Question[]): State {
  return {
    questions,
    participants: new Map(),
    groups: [],
    activityPhase: "intake",
    activity1Responses: [],
    activity2Responses: []
  };
}

export function buildPresenterState(state: State): PresenterState {
  return {
    questions: state.questions,
    participants: Array.from(state.participants.values()),
    groups: state.groups,
    activityPhase: state.activityPhase
  };
}

export function joinParticipant(
  state: State,
  name: string,
  hasSubscription: boolean,
  now = Date.now()
): Participant {
  const participant: Participant = {
    id: randomUUID(),
    name,
    hasSubscription,
    answers: {},
    submitted: false,
    connected: true,
    joinedAt: now,
    updatedAt: now
  };

  state.participants.set(participant.id, participant);
  return participant;
}

export function updateParticipant(
  state: State,
  participantId: string,
  answers: Record<string, string>,
  hasSubscription: boolean,
  submitted: boolean,
  now = Date.now()
): Participant | null {
  const participant = state.participants.get(participantId);
  if (!participant) {
    return null;
  }

  participant.answers = { ...participant.answers, ...answers };
  participant.hasSubscription = hasSubscription;
  participant.submitted = submitted ? true : participant.submitted;
  participant.updatedAt = now;
  return participant;
}

export function markDisconnected(
  state: State,
  participantId: string,
  now = Date.now()
): Participant | null {
  const participant = state.participants.get(participantId);
  if (!participant) {
    return null;
  }

  participant.connected = false;
  participant.updatedAt = now;
  return participant;
}
