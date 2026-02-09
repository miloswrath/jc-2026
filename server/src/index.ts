import { pathToFileURL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import { loadQuestions } from "./questions";
import {
  buildActivity2Groups,
  buildGroups,
  PRESENTER_ID,
  PRESENTER_NAME
} from "./grouping";
import { getServerConfig } from "./serverConfig";
import {
  Activity1Submission,
  Activity2Submission,
  ClientMessage,
  Group,
  Participant,
  ParticipantSummary,
  ServerMessage
} from "./types";
import {
  buildPresenterState,
  createState,
  joinParticipant,
  markDisconnected,
  updateParticipant
} from "./state";

type SocketInfo = {
  role?: "participant" | "presenter";
  participantId?: string;
};

const { host, port } = getServerConfig(process.env);
const questionsPath =
  process.env.QUESTIONS_PATH ??
  new URL("../../questions.json", import.meta.url);
const questionsUrl =
  typeof questionsPath === "string"
    ? questionsPath.startsWith("file:")
      ? new URL(questionsPath)
      : pathToFileURL(questionsPath)
    : questionsPath;
const questions = await loadQuestions(questionsUrl);

const state = createState(questions);
const socketInfo = new Map<WebSocket, SocketInfo>();
const presenterSockets = new Set<WebSocket>();
const participantSockets = new Map<string, WebSocket>();

const wss = new WebSocketServer({ host, port });

function send(socket: WebSocket, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}

function broadcastPresenterState() {
  const payload = buildPresenterState(state);
  for (const socket of presenterSockets) {
    send(socket, { type: "presenter:state", payload });
  }
}

function broadcastActivity1Results() {
  const payload = { responses: state.activity1Responses };
  for (const socket of presenterSockets) {
    send(socket, { type: "activity1:results", payload });
  }
}

function broadcastActivity2Results() {
  const payload = { responses: state.activity2Responses };
  for (const socket of presenterSockets) {
    send(socket, { type: "activity2:results", payload });
  }
}

function broadcastActivityPhase() {
  const payload = { activityPhase: state.activityPhase };
  for (const socket of participantSockets.values()) {
    send(socket, { type: "activity:phase", payload });
  }
}

function buildParticipantSummary(
  group: Group,
  participants: Map<string, Participant>
): ParticipantSummary[] {
  return group.participantIds.map((participantId) => {
    if (participantId === PRESENTER_ID) {
      return {
        id: PRESENTER_ID,
        name: PRESENTER_NAME,
        hasSubscription: true
      };
    }

    const participant = participants.get(participantId);
    return {
      id: participantId,
      name: participant?.name ?? "Unknown",
      hasSubscription: participant?.hasSubscription ?? false
    };
  });
}

function assignGroupReporter(
  group: Group,
  participants: Map<string, Participant>
) {
  const eligible = group.participantIds.filter(
    (participantId) => participantId !== PRESENTER_ID
  );
  const withoutSubscription = eligible.filter((participantId) => {
    const participant = participants.get(participantId);
    return participant ? !participant.hasSubscription : false;
  });
  const pool = withoutSubscription.length > 0 ? withoutSubscription : eligible;
  if (pool.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

function assignRandomReporter(group: Group) {
  const eligible = group.participantIds.filter(
    (participantId) => participantId !== PRESENTER_ID
  );
  if (eligible.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index];
}

function resetGroups() {
  state.groups = [];
  state.activity1Responses = [];
  state.activity2Responses = [];
  for (const participant of state.participants.values()) {
    delete participant.groupId;
  }
}

function storeActivity1Response(payload: Activity1Submission) {
  const existingIndex = state.activity1Responses.findIndex(
    (response) => response.groupId === payload.groupId
  );
  if (existingIndex >= 0) {
    state.activity1Responses[existingIndex] = payload;
  } else {
    state.activity1Responses.push(payload);
  }
}

function storeActivity2Response(payload: Activity2Submission) {
  const existingIndex = state.activity2Responses.findIndex(
    (response) => response.groupId === payload.groupId
  );
  if (existingIndex >= 0) {
    state.activity2Responses[existingIndex] = payload;
  } else {
    state.activity2Responses.push(payload);
  }
}

function parseMessage(raw: WebSocket.RawData): ClientMessage | null {
  const text =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
        ? Buffer.concat(raw).toString("utf-8")
        : Buffer.from(raw).toString("utf-8");

  try {
    const parsed = JSON.parse(text) as ClientMessage;
    return parsed?.type ? parsed : null;
  } catch {
    return null;
  }
}

wss.on("connection", (socket) => {
  send(socket, { type: "server:ready" });

  socket.on("message", (raw) => {
    const message = parseMessage(raw);
    if (!message) {
      return;
    }

    if (message.type === "participant:join") {
      const name = message.payload?.name?.trim();
      const hasSubscription = message.payload?.hasSubscription;
      if (!name || typeof hasSubscription !== "boolean") {
        return;
      }

      const participant = joinParticipant(state, name, hasSubscription);
      socketInfo.set(socket, {
        role: "participant",
        participantId: participant.id
      });
      participantSockets.set(participant.id, socket);

      send(socket, {
        type: "participant:joined",
        payload: { participantId: participant.id, questions }
      });
      send(socket, {
        type: "activity:phase",
        payload: { activityPhase: state.activityPhase }
      });
      broadcastPresenterState();
      return;
    }

    if (message.type === "presenter:state") {
      socketInfo.set(socket, { role: "presenter" });
      presenterSockets.add(socket);
      send(socket, {
        type: "presenter:state",
        payload: buildPresenterState(state)
      });
      send(socket, {
        type: "activity1:results",
        payload: { responses: state.activity1Responses }
      });
      send(socket, {
        type: "activity2:results",
        payload: { responses: state.activity2Responses }
      });
      return;
    }

    if (message.type === "presenter:grouping") {
      const participants = Array.from(state.participants.values()).filter(
        (participant) => participant.connected
      );
      const paidCount = participants.filter(
        (participant) => participant.hasSubscription
      ).length;
      const includePresenter = paidCount < 4;
      const groupingResult = buildGroups(participants, { includePresenter });
      if ("error" in groupingResult) {
        return;
      }

      state.groups = groupingResult.groups.map((group) => ({
        ...group,
        reporterId: assignGroupReporter(group, state.participants)
      }));
      state.activityPhase = "grouping";
      state.activity1Responses = [];

      for (const group of state.groups) {
        for (const participantId of group.participantIds) {
          if (participantId === PRESENTER_ID) {
            continue;
          }
          const participant = state.participants.get(participantId);
          if (participant) {
            participant.groupId = group.id;
          }
        }
      }

      for (const group of state.groups) {
        const members = buildParticipantSummary(group, state.participants);
        const payload = { group, members };
        for (const participantId of group.participantIds) {
          if (participantId === PRESENTER_ID) {
            continue;
          }
          const participantSocket = participantSockets.get(participantId);
          if (participantSocket) {
            send(participantSocket, {
              type: "participant:group:assigned",
              payload
            });
          }
        }
      }

      broadcastActivityPhase();
      broadcastPresenterState();
      broadcastActivity1Results();
      broadcastActivity2Results();
      return;
    }

    if (message.type === "presenter:activity2:grouping") {
      const participants = Array.from(state.participants.values()).filter(
        (participant) => participant.connected
      );
      const groupingResult = buildActivity2Groups(participants);
      if ("error" in groupingResult) {
        return;
      }

      state.groups = groupingResult.groups.map((group) => ({
        ...group,
        reporterId: assignRandomReporter(group)
      }));
      state.activityPhase = "activity2:grouping";
      state.activity2Responses = [];

      for (const group of state.groups) {
        for (const participantId of group.participantIds) {
          if (participantId === PRESENTER_ID) {
            continue;
          }
          const participant = state.participants.get(participantId);
          if (participant) {
            participant.groupId = group.id;
          }
        }
      }

      for (const group of state.groups) {
        const members = buildParticipantSummary(group, state.participants);
        const payload = { group, members };
        for (const participantId of group.participantIds) {
          if (participantId === PRESENTER_ID) {
            continue;
          }
          const participantSocket = participantSockets.get(participantId);
          if (participantSocket) {
            send(participantSocket, {
              type: "participant:group:assigned",
              payload
            });
          }
        }
      }

      broadcastActivityPhase();
      broadcastPresenterState();
      broadcastActivity2Results();
      return;
    }

    if (message.type === "presenter:activity1:start") {
      state.activityPhase = "activity1";
      state.activity1Responses = [];
      broadcastActivityPhase();
      broadcastPresenterState();
      broadcastActivity1Results();
      broadcastActivity2Results();
      return;
    }

    if (message.type === "presenter:activity1:end") {
      state.activityPhase = "intake";
      resetGroups();
      broadcastActivityPhase();
      broadcastPresenterState();
      broadcastActivity1Results();
      broadcastActivity2Results();
      return;
    }

    if (message.type === "presenter:activity2:start") {
      state.activityPhase = "activity2";
      state.activity2Responses = [];
      broadcastActivityPhase();
      broadcastPresenterState();
      broadcastActivity2Results();
      return;
    }

    if (message.type === "presenter:activity2:end") {
      state.activityPhase = "intake";
      resetGroups();
      broadcastActivityPhase();
      broadcastPresenterState();
      broadcastActivity1Results();
      broadcastActivity2Results();
      return;
    }

    if (
      message.type === "participant:submit" ||
      message.type === "participant:update"
    ) {
      const info = socketInfo.get(socket);
      if (!info?.participantId) {
        return;
      }

      const hasSubscription = message.payload?.hasSubscription;
      if (typeof hasSubscription !== "boolean") {
        return;
      }

      const incoming =
        message.payload?.answers &&
        typeof message.payload.answers === "object" &&
        !Array.isArray(message.payload.answers)
          ? message.payload.answers
          : {};

      const updated = updateParticipant(
        state,
        info.participantId,
        incoming,
        hasSubscription,
        message.type === "participant:submit"
      );
      if (!updated) {
        return;
      }

      send(socket, {
        type: "participant:updated",
        payload: { participantId: updated.id }
      });
      broadcastPresenterState();
    }

    if (message.type === "participant:activity1:submit") {
      const info = socketInfo.get(socket);
      if (!info?.participantId) {
        return;
      }
      if (state.activityPhase !== "activity1") {
        return;
      }

      const payload = message.payload;
      if (
        !payload?.groupId ||
        !payload?.questionAsked ||
        !payload?.impressions
      ) {
        return;
      }

      const group = state.groups.find((entry) => entry.id === payload.groupId);
      if (!group || group.reporterId !== info.participantId) {
        return;
      }

      const questionAsked = payload.questionAsked.trim();
      const impressions = payload.impressions.trim();
      if (!questionAsked || !impressions) {
        return;
      }

      storeActivity1Response({
        groupId: group.id,
        questionAsked,
        impressions
      });
      broadcastActivity1Results();
      return;
    }

    if (message.type === "participant:activity2:submit") {
      const info = socketInfo.get(socket);
      if (!info?.participantId) {
        return;
      }
      if (state.activityPhase !== "activity2") {
        return;
      }

      const payload = message.payload;
      if (
        !payload?.groupId ||
        !payload?.ragImpressions ||
        !payload?.trickImpressions ||
        !payload?.citationImpressions
      ) {
        return;
      }

      const group = state.groups.find((entry) => entry.id === payload.groupId);
      if (!group || group.reporterId !== info.participantId) {
        return;
      }

      const ragImpressions = payload.ragImpressions.trim();
      const trickImpressions = payload.trickImpressions.trim();
      const citationImpressions = payload.citationImpressions.trim();
      if (!ragImpressions || !trickImpressions || !citationImpressions) {
        return;
      }

      storeActivity2Response({
        groupId: group.id,
        ragImpressions,
        trickImpressions,
        citationImpressions
      });
      broadcastActivity2Results();
      return;
    }
  });

  socket.on("close", () => {
    const info = socketInfo.get(socket);
    if (info?.role === "presenter") {
      presenterSockets.delete(socket);
    }

    if (info?.participantId) {
      const updated = markDisconnected(state, info.participantId);
      if (updated) {
        broadcastPresenterState();
      }
      participantSockets.delete(info.participantId);
    }

    socketInfo.delete(socket);
  });
});

console.log(`WebSocket server running on ws://${host}:${port}`);
