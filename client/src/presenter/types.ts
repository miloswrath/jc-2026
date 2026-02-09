export type Question = {
  id: string;
  text: string;
};

export type ActivityPhase =
  | "intake"
  | "grouping"
  | "activity1"
  | "activity1:results"
  | "activity2:grouping"
  | "activity2"
  | "activity2:results";

export type Group = {
  id: string;
  label: string;
  participantIds: string[];
  reporterId: string | null;
};

export type ParticipantSummary = {
  id: string;
  name: string;
  hasSubscription: boolean;
};

export type GroupAssignment = {
  group: Group;
  members: ParticipantSummary[];
};

export type Activity1Submission = {
  groupId: string;
  questionAsked: string;
  impressions: string;
};

export type Activity2Submission = {
  groupId: string;
  ragImpressions: string;
  trickImpressions: string;
  citationImpressions: string;
};

export type Participant = {
  id: string;
  name: string;
  hasSubscription: boolean;
  groupId?: string;
  answers: Record<string, string>;
  submitted: boolean;
  connected: boolean;
  joinedAt: number;
  updatedAt: number;
};

export type PresenterState = {
  questions: Question[];
  participants: Participant[];
  groups: Group[];
  activityPhase: ActivityPhase;
};

export type ServerMessage =
  | { type: "server:ready" }
  | { type: "presenter:state"; payload: PresenterState }
  | { type: "activity1:results"; payload: { responses: Activity1Submission[] } }
  | { type: "activity2:results"; payload: { responses: Activity2Submission[] } };

export type ClientMessage =
  | { type: "presenter:state" }
  | { type: "presenter:grouping" }
  | { type: "presenter:activity1:start" }
  | { type: "presenter:activity1:end" }
  | { type: "presenter:activity2:grouping" }
  | { type: "presenter:activity2:start" }
  | { type: "presenter:activity2:end" };
