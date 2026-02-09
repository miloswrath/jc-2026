import { useEffect, useMemo, useRef, useState } from "react";
import { usePresenterSocket } from "./presenter/usePresenterSocket";
import {
  Activity1Submission,
  Activity2Submission,
  ActivityPhase,
  Group,
  Participant,
  Question
} from "./presenter/types";

const PRESENTER_ID = "presenter";
const PRESENTER_NAME = "Presenter";

function formatTime(timestamp: number | null) {
  if (!timestamp) {
    return "Waiting for updates";
  }

  return new Date(timestamp).toLocaleTimeString();
}

function sortParticipants(participants: Participant[]) {
  return [...participants].sort((a, b) => {
    return a.joinedAt - b.joinedAt;
  });
}

function buildAnswerList(questions: Question[], participant: Participant) {
  return questions.map((question) => ({
    id: question.id,
    text: question.text,
    answer: participant.answers[question.id] ?? ""
  }));
}

function buildParticipantLookup(participants: Participant[]) {
  return new Map(participants.map((participant) => [participant.id, participant]));
}

function formatGroupLabel(group: Group, index: number) {
  const label =
    group.label === "agentic"
      ? "Agentic"
      : group.label === "non-agentic"
        ? "Non-agentic"
        : "Random";
  return `Group ${index + 1} · ${label}`;
}

function formatGroupName(groupId: string, groups: Group[]) {
  const index = groups.findIndex((group) => group.id === groupId);
  return index >= 0 ? `Group ${index + 1}` : groupId;
}

function buildGroupMemberNames(group: Group, participants: Map<string, Participant>) {
  return group.participantIds.map((id) => {
    if (id === PRESENTER_ID) {
      return PRESENTER_NAME;
    }
    return participants.get(id)?.name ?? "Unknown";
  });
}

function renderActivity1Responses(
  responses: Activity1Submission[],
  groups: Group[]
) {
  if (responses.length === 0) {
    return (
      <div className="rounded-3xl bg-panel/80 p-10 text-center shadow-glow">
        <h2 className="text-2xl font-semibold">Waiting for group reports</h2>
        <p className="mt-3 text-base text-cream/70">
          Reporters will submit the group answers as they finish.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {responses.map((response, index) => (
        <article
          key={`${response.groupId}-${index}`}
          className="animate-rise animate-float rounded-3xl bg-panel/80 p-6 shadow-glow"
          style={{
            animationDelay: `${index * 60}ms`,
            animationDuration: `${7 + index * 0.3}s`
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {formatGroupName(response.groupId, groups)}
            </h2>
            <span className="rounded-full border border-cream/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/70">
              Activity 1
            </span>
          </div>
          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl bg-ink/50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cream/60">
                Question asked
              </p>
              <p className="mt-2 text-base text-cream/90">
                {response.questionAsked}
              </p>
            </div>
            <div className="rounded-2xl bg-ink/50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cream/60">
                Impressions
              </p>
              <p className="mt-2 text-base text-cream/90">
                {response.impressions}
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function renderActivity2Responses(
  responses: Activity2Submission[],
  groups: Group[]
) {
  if (responses.length === 0) {
    return (
      <div className="rounded-3xl bg-panel/80 p-10 text-center shadow-glow">
        <h2 className="text-2xl font-semibold">Waiting for group reports</h2>
        <p className="mt-3 text-base text-cream/70">
          Reporters will submit the group answers as they finish.
        </p>
      </div>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      {responses.map((response, index) => (
        <article
          key={`${response.groupId}-${index}`}
          className="animate-rise animate-float rounded-3xl bg-panel/80 p-6 shadow-glow"
          style={{
            animationDelay: `${index * 60}ms`,
            animationDuration: `${7 + index * 0.3}s`
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {formatGroupName(response.groupId, groups)}
            </h2>
            <span className="rounded-full border border-cream/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/70">
              Activity 2
            </span>
          </div>
          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl bg-ink/50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cream/60">
                RAG questions
              </p>
              <p className="mt-2 text-base text-cream/90">
                {response.ragImpressions}
              </p>
            </div>
            <div className="rounded-2xl bg-ink/50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cream/60">
                Trick question
              </p>
              <p className="mt-2 text-base text-cream/90">
                {response.trickImpressions}
              </p>
            </div>
            <div className="rounded-2xl bg-ink/50 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-cream/60">
                Citation check
              </p>
              <p className="mt-2 text-base text-cream/90">
                {response.citationImpressions}
              </p>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function formatPhaseLabel(phase: ActivityPhase) {
  switch (phase) {
    case "intake":
      return "intake";
    case "grouping":
      return "activity 1 grouping";
    case "activity1":
      return "activity 1";
    case "activity1:results":
      return "activity 1 results";
    case "activity2:grouping":
      return "activity 2 grouping";
    case "activity2":
      return "activity 2";
    case "activity2:results":
      return "activity 2 results";
    default:
      return phase;
  }
}

export default function PresenterApp() {
  const {
    status,
    state,
    lastUpdate,
    activity1Results,
    activity2Results,
    send
  } = usePresenterSocket();
  const orderedParticipants = useMemo(
    () => sortParticipants(state.participants),
    [state.participants]
  );
  const participantLookup = useMemo(
    () => buildParticipantLookup(state.participants),
    [state.participants]
  );
  const [now, setNow] = useState(Date.now());
  const seenRef = useRef<Set<string>>(new Set());
  const updatedRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    for (const participant of state.participants) {
      if (!seenRef.current.has(participant.id)) {
        seenRef.current.add(participant.id);
        updatedRef.current.set(participant.id, Date.now());
      } else {
        const existing = updatedRef.current.get(participant.id) ?? 0;
        if (participant.updatedAt > existing) {
          updatedRef.current.set(participant.id, Date.now());
        }
      }
    }
  }, [state.participants]);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.6em] text-cream/60">
              Presenter
            </p>
            <h1 className="mt-3 text-4xl font-semibold md:text-6xl">Live Wall</h1>
            <p className="mt-3 text-sm text-cream/70 md:text-base">
              {state.participants.length} participant
              {state.participants.length === 1 ? "" : "s"} connected ·{" "}
              {formatTime(lastUpdate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-cream/20 bg-panel/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cream/80">
              Phase: {formatPhaseLabel(state.activityPhase)}
            </div>
            <div className="flex items-center gap-3 rounded-full border border-cream/20 bg-panel/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-cream/80">
              <span className="inline-flex h-2 w-2 rounded-full bg-sand" />
              {status === "ready" ? "Live" : "Offline"}
            </div>
            {state.activityPhase === "intake" && (
              <>
                <button
                  className="rounded-full bg-sand px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-sand/40"
                  onClick={() => send({ type: "presenter:grouping" })}
                  disabled={status !== "ready"}
                >
                  Activity 1 Grouping
                </button>
                <button
                  className="rounded-full border border-cream/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-cream/10 disabled:cursor-not-allowed disabled:border-cream/10 disabled:text-cream/40"
                  onClick={() => send({ type: "presenter:activity2:grouping" })}
                  disabled={status !== "ready"}
                >
                  Activity 2 Grouping
                </button>
              </>
            )}
            {state.activityPhase === "grouping" && (
              <button
                className="rounded-full bg-sand px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-sand/40"
                onClick={() => send({ type: "presenter:activity1:start" })}
                disabled={status !== "ready"}
              >
                Start Activity 1
              </button>
            )}
            {state.activityPhase === "activity2:grouping" && (
              <button
                className="rounded-full bg-sand px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-sand/40"
                onClick={() => send({ type: "presenter:activity2:start" })}
                disabled={status !== "ready"}
              >
                Start Activity 2
              </button>
            )}
            {(state.activityPhase === "activity1:results" ||
              (state.activityPhase === "activity1" &&
                activity1Results.length > 0)) && (
              <button
                className="rounded-full border border-cream/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-cream/10 disabled:cursor-not-allowed disabled:border-cream/10 disabled:text-cream/40"
                onClick={() => send({ type: "presenter:activity1:end" })}
                disabled={status !== "ready"}
              >
                End Activity 1
              </button>
            )}
            {(state.activityPhase === "activity2:results" ||
              (state.activityPhase === "activity2" &&
                activity2Results.length > 0)) && (
              <button
                className="rounded-full border border-cream/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream transition hover:bg-cream/10 disabled:cursor-not-allowed disabled:border-cream/10 disabled:text-cream/40"
                onClick={() => send({ type: "presenter:activity2:end" })}
                disabled={status !== "ready"}
              >
                End Activity 2
              </button>
            )}
          </div>
        </header>

        {state.activityPhase === "intake" && state.participants.length === 0 && (
          <section className="rounded-3xl bg-panel/80 p-10 text-center shadow-glow">
            <h2 className="text-2xl font-semibold">Waiting for answers</h2>
            <p className="mt-3 text-base text-cream/70">
              Ask participants to join the link and share their responses. This
              wall updates live as they submit.
            </p>
          </section>
        )}

        {state.activityPhase === "intake" && state.participants.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-2">
            {orderedParticipants.map((participant, index) => {
              const answers = buildAnswerList(state.questions, participant);
              const highlightUntil = updatedRef.current.get(participant.id) ?? 0;
              const isFresh = now - highlightUntil < 5000;
              return (
                <article
                  key={participant.id}
                  className={`animate-rise animate-float rounded-3xl bg-panel/80 p-6 transition ${
                    isFresh ? "ring-2 ring-sand/70" : ""
                  }`}
                  style={{
                    animationDelay: `${index * 60}ms`,
                    animationDuration: `${7 + index * 0.3}s`
                  }}
                  data-fresh={isFresh ? "true" : "false"}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.3em] text-cream/60">
                        {participant.connected ? "Connected" : "Offline"}
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        {participant.name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                          participant.hasSubscription
                            ? "bg-emerald-400/20 text-emerald-300"
                            : "bg-cream/10 text-cream/40"
                        }`}
                        aria-label={
                          participant.hasSubscription
                            ? "Paid OpenAI subscription"
                            : "No paid OpenAI subscription"
                        }
                      >
                        {participant.hasSubscription ? (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              d="M5 10.5l3 3 7-7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              d="M6 6l8 8M14 6l-8 8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <div className="rounded-full border border-cream/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/70">
                        {participant.submitted ? "Submitted" : "Editing"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4">
                    {answers.map((answer, answerIndex) => (
                      <div
                        key={`${answer.id}-${participant.updatedAt}`}
                        className="rounded-2xl bg-ink/50 p-4"
                      >
                        <p className="text-xs uppercase tracking-[0.25em] text-cream/60">
                          {answerIndex + 1}
                        </p>
                        <p className="mt-2 text-base font-medium">
                          {answer.text}
                        </p>
                        <p
                          className="reveal-write mt-3 text-sm text-cream/80"
                          style={{ animationDelay: `${answerIndex * 140}ms` }}
                        >
                          {answer.answer || "No answer yet."}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {(state.activityPhase === "grouping" ||
          state.activityPhase === "activity2:grouping") && (
          <>
            {state.groups.length === 0 ? (
              <section className="rounded-3xl bg-panel/80 p-10 text-center shadow-glow">
                <h2 className="text-2xl font-semibold">Grouping in progress</h2>
                <p className="mt-3 text-base text-cream/70">
                  Press Grouping when you are ready to assign teams.
                </p>
              </section>
            ) : (
              <section className="grid gap-6 lg:grid-cols-2">
                {state.groups.map((group, index) => {
                  const memberNames = buildGroupMemberNames(
                    group,
                    participantLookup
                  );
                  return (
                    <article
                      key={group.id}
                      className={`animate-rise animate-float rounded-3xl bg-panel/80 p-6 shadow-glow ${
                        group.label === "agentic"
                          ? "ring-2 ring-emerald-400/40"
                          : "ring-1 ring-cream/10"
                      }`}
                      style={{
                        animationDelay: `${index * 70}ms`,
                        animationDuration: `${7 + index * 0.3}s`
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">
                          {formatGroupLabel(group, index)}
                        </h2>
                        <span className="rounded-full border border-cream/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/70">
                          {memberNames.length} people
                        </span>
                      </div>
                      <div className="mt-5 grid gap-3">
                        {memberNames.map((name) => (
                          <div
                            key={`${group.id}-${name}`}
                            className="rounded-2xl bg-ink/50 px-4 py-3 text-sm text-cream/80"
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}

        {state.activityPhase === "activity1" &&
          (activity1Results.length > 0 ? (
            renderActivity1Responses(activity1Results, state.groups)
          ) : (
            <section className="rounded-3xl bg-panel/80 p-10 text-center shadow-glow">
              <h2 className="text-2xl font-semibold">Activity 1 underway</h2>
              <p className="mt-3 text-base text-cream/70">
                Reporters are working on the group submission. Results will appear
                here when they are ready.
              </p>
            </section>
          ))}

        {state.activityPhase === "activity1:results" &&
          renderActivity1Responses(activity1Results, state.groups)}

        {state.activityPhase === "activity2" &&
          (activity2Results.length > 0 ? (
            renderActivity2Responses(activity2Results, state.groups)
          ) : (
            <section className="rounded-3xl bg-panel/80 p-10 text-center shadow-glow">
              <h2 className="text-2xl font-semibold">Activity 2 underway</h2>
              <p className="mt-3 text-base text-cream/70">
                Reporters are working on the group submission. Results will appear
                here when they are ready.
              </p>
            </section>
          ))}

        {state.activityPhase === "activity2:results" &&
          renderActivity2Responses(activity2Results, state.groups)}
      </div>
    </main>
  );
}
