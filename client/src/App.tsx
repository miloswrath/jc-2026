import { useEffect, useMemo, useRef, useState } from "react";
import { getWsUrl } from "./ws";

type Question = {
  id: string;
  text: string;
};

type ActivityPhase =
  | "intake"
  | "grouping"
  | "activity1"
  | "activity1:results"
  | "activity2:grouping"
  | "activity2"
  | "activity2:results";

type Group = {
  id: string;
  label: string;
  participantIds: string[];
  reporterId: string | null;
};

type ParticipantSummary = {
  id: string;
  name: string;
  hasSubscription: boolean;
};

type GroupAssignment = {
  group: Group;
  members: ParticipantSummary[];
};

type Activity1Submission = {
  groupId: string;
  questionAsked: string;
  impressions: string;
};

type Activity2Submission = {
  groupId: string;
  ragImpressions: string;
  trickImpressions: string;
  citationImpressions: string;
};

type ServerMessage =
  | { type: "server:ready" }
  | { type: "participant:joined"; payload: { participantId: string; questions: Question[] } }
  | { type: "participant:updated"; payload: { participantId: string } }
  | { type: "participant:group:assigned"; payload: GroupAssignment }
  | { type: "activity:phase"; payload: { activityPhase: ActivityPhase } }
  | { type: "activity1:results"; payload: { responses: Activity1Submission[] } }
  | { type: "activity2:results"; payload: { responses: Activity2Submission[] } };

type ClientMessage =
  | { type: "participant:join"; payload: { name: string; hasSubscription: boolean } }
  | {
      type: "participant:submit" | "participant:update";
      payload: { answers: Record<string, string>; hasSubscription: boolean };
    }
  | { type: "participant:activity1:submit"; payload: Activity1Submission }
  | { type: "participant:activity2:submit"; payload: Activity2Submission };

type SubscriptionToggleProps = {
  value: boolean | null;
  onChange: (value: boolean) => void;
};

function SubscriptionToggle({ value, onChange }: SubscriptionToggleProps) {
  const sliderPosition =
    value === null
      ? "left-1 opacity-0"
      : value
        ? "left-[calc(50%+2px)]"
        : "left-1";

  return (
    <div className="inline-flex flex-col gap-2">
      <div className="relative inline-flex w-56 items-center rounded-full bg-ink/60 p-1 text-xs uppercase tracking-[0.2em] text-cream/70">
        <span
          className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-sand transition ${sliderPosition}`}
        />
        <button
          type="button"
          className={`relative z-10 w-1/2 rounded-full py-2 text-center transition ${
            value === false ? "text-ink" : "text-cream/70"
          }`}
          onClick={() => onChange(false)}
        >
          No
        </button>
        <button
          type="button"
          className={`relative z-10 w-1/2 rounded-full py-2 text-center transition ${
            value === true ? "text-ink" : "text-cream/70"
          }`}
          onClick={() => onChange(true)}
        >
          Yes
        </button>
      </div>
      {value === null && (
        <p className="text-xs text-cream/60">Select yes or no to continue.</p>
      )}
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "ready">(
    "disconnected"
  );
  const [name, setName] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [activityPhase, setActivityPhase] = useState<ActivityPhase>("intake");
  const [groupAssignment, setGroupAssignment] =
    useState<GroupAssignment | null>(null);
  const [activity1Question, setActivity1Question] = useState("");
  const [activity1Impressions, setActivity1Impressions] = useState("");
  const [activity1Submitted, setActivity1Submitted] = useState(false);
  const [activity2RagImpressions, setActivity2RagImpressions] = useState("");
  const [activity2TrickImpressions, setActivity2TrickImpressions] =
    useState("");
  const [activity2CitationImpressions, setActivity2CitationImpressions] =
    useState("");
  const [activity2Submitted, setActivity2Submitted] = useState(false);

  const wsUrl = useMemo(getWsUrl, []);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!wsUrl || typeof WebSocket === "undefined") {
      return;
    }

    setStatus("connecting");
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    const handleOpen = () => setStatus("ready");
    const handleClose = () => setStatus("disconnected");
    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        if (parsed.type === "participant:joined") {
          setParticipantId(parsed.payload.participantId);
          setQuestions(parsed.payload.questions);
        }

        if (parsed.type === "participant:updated") {
          setLastUpdated(Date.now());
        }

        if (parsed.type === "participant:group:assigned") {
          setGroupAssignment(parsed.payload);
        }

        if (parsed.type === "activity:phase") {
          setActivityPhase(parsed.payload.activityPhase);
          if (parsed.payload.activityPhase === "intake") {
            setGroupAssignment(null);
            setActivity1Question("");
            setActivity1Impressions("");
            setActivity1Submitted(false);
            setActivity2RagImpressions("");
            setActivity2TrickImpressions("");
            setActivity2CitationImpressions("");
            setActivity2Submitted(false);
          }
          if (parsed.payload.activityPhase === "activity2:grouping") {
            setActivity2RagImpressions("");
            setActivity2TrickImpressions("");
            setActivity2CitationImpressions("");
            setActivity2Submitted(false);
          }
        }
      } catch {
        // Ignore malformed messages.
      }
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("close", handleClose);
    socket.addEventListener("message", handleMessage);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("close", handleClose);
      socket.removeEventListener("message", handleMessage);
      socket.close();
      socketRef.current = null;
    };
  }, [wsUrl]);

  function send(message: ClientMessage) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    socketRef.current.send(JSON.stringify(message));
  }

  function handleJoin() {
    const trimmed = name.trim();
    if (!trimmed || hasSubscription === null) {
      return;
    }

    send({
      type: "participant:join",
      payload: { name: trimmed, hasSubscription }
    });
  }

  function handleAnswerChange(id: string, value: string) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  function handleSubmit() {
    if (!participantId) {
      return;
    }

    if (hasSubscription === null) {
      return;
    }

    const payload = { answers, hasSubscription };
    send({
      type: submitted ? "participant:update" : "participant:submit",
      payload
    });
    setSubmitted(true);
  }

  const canJoin = name.trim().length > 0 && hasSubscription !== null;
  const allAnswered = questions.every((question) => answers[question.id]?.trim());
  const canSubmit = allAnswered && hasSubscription !== null;
  const isReporter =
    participantId &&
    groupAssignment &&
    groupAssignment.group.reporterId === participantId;
  const activity1Ready =
    activity1Question.trim().length > 0 && activity1Impressions.trim().length > 0;
  const activity2Ready =
    activity2RagImpressions.trim().length > 0 &&
    activity2TrickImpressions.trim().length > 0 &&
    activity2CitationImpressions.trim().length > 0;

  function handleActivity1Submit() {
    if (!groupAssignment || !isReporter) {
      return;
    }

    send({
      type: "participant:activity1:submit",
      payload: {
        groupId: groupAssignment.group.id,
        questionAsked: activity1Question.trim(),
        impressions: activity1Impressions.trim()
      }
    });
    setActivity1Submitted(true);
  }

  function handleActivity2Submit() {
    if (!groupAssignment || !isReporter) {
      return;
    }

    send({
      type: "participant:activity2:submit",
      payload: {
        groupId: groupAssignment.group.id,
        ragImpressions: activity2RagImpressions.trim(),
        trickImpressions: activity2TrickImpressions.trim(),
        citationImpressions: activity2CitationImpressions.trim()
      }
    });
    setActivity2Submitted(true);
  }

  const memberNames =
    groupAssignment?.members.map((member) => member.name) ?? [];

  const groupNumber =
    groupAssignment?.group.id.startsWith("group-") &&
    Number(groupAssignment.group.id.replace("group-", ""))
      ? Number(groupAssignment.group.id.replace("group-", ""))
      : null;

  return (
    <main className="min-h-screen bg-ink text-cream">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 px-6 py-12">
        <header className="animate-rise text-center">
          <p className="text-xs uppercase tracking-[0.6em] text-cream/60">
            Local Q&A
          </p>
          <h1 className="mt-3 text-4xl font-semibold md:text-6xl">Cards</h1>
          <p className="mt-4 text-base text-cream/70 md:text-lg">
            Share quick answers and watch the presenter screen light up in real
            time.
          </p>
        </header>

        <section className="rounded-3xl bg-panel/80 p-8 shadow-glow backdrop-blur">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-cream/60">
            <span>Participant</span>
            <span>{status === "ready" ? "Connected" : "Offline"}</span>
          </div>

          {activityPhase === "intake" && !participantId && (
            <div className="mt-6 animate-fade">
              <h2 className="text-2xl font-semibold">Enter your name</h2>
              <p className="mt-2 text-sm text-cream/70">
                This will label your responses on the presentation screen.
              </p>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                  OpenAI subscription
                </p>
                <p className="mt-2 text-sm text-cream/70">
                  Do you have a paid OpenAI subscription?
                </p>
                <div className="mt-4">
                  <SubscriptionToggle
                    value={hasSubscription}
                    onChange={setHasSubscription}
                  />
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  className="flex-1 rounded-2xl border border-cream/10 bg-ink/60 px-4 py-3 text-base text-cream outline-none transition focus:border-cream/40"
                  placeholder="e.g. Ada Lovelace"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <button
                  className="rounded-2xl bg-cream px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-cream/40"
                  onClick={handleJoin}
                  disabled={!canJoin}
                >
                  Join
                </button>
              </div>
            </div>
          )}

          {activityPhase === "intake" && participantId && (
            <div className="mt-6">
              {!submitted && (
                <>
                  <h2 className="text-2xl font-semibold">Your questions</h2>
                  <p className="mt-2 text-sm text-cream/70">
                    Keep answers short and specific for the live display.
                  </p>
                  <div className="mt-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                      OpenAI subscription
                    </p>
                    <p className="mt-2 text-sm text-cream/70">
                      Do you have a paid OpenAI subscription?
                    </p>
                    <div className="mt-4">
                      <SubscriptionToggle
                        value={hasSubscription}
                        onChange={setHasSubscription}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="mt-6 grid gap-4">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="animate-rise animate-float rounded-2xl bg-ink/40 p-4"
                    style={{
                      animationDelay: `${index * 70}ms`,
                      animationDuration: `${6 + index * 0.4}s`
                    }}
                  >
                    <p className="text-sm uppercase tracking-[0.2em] text-cream/60">
                      Prompt {index + 1}
                    </p>
                    <p className="mt-2 text-lg font-medium">{question.text}</p>
                    {!submitted && (
                      <textarea
                        className="mt-4 w-full resize-none rounded-xl border border-cream/10 bg-ink/70 px-3 py-2 text-base text-cream outline-none transition focus:border-cream/40"
                        rows={3}
                        value={answers[question.id] ?? ""}
                        onChange={(event) =>
                          handleAnswerChange(question.id, event.target.value)
                        }
                      />
                    )}
                    {submitted && (
                      <p className="mt-4 text-sm text-cream/80">
                        {answers[question.id] || "No answer yet."}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {!submitted && (
                <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                    {canSubmit ? "Ready to submit" : "Fill all answers"}
                  </p>
                  <button
                    className="rounded-2xl bg-sand px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-sand/40"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                  >
                    Submit
                  </button>
                </div>
              )}

              {submitted && (
                <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-ink/60 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-cream/60">
                        Submitted
                      </p>
                      <p className="text-base">
                        Thanks! You can still edit your answers.
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cream/70">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                            hasSubscription
                              ? "bg-emerald-400/20 text-emerald-300"
                              : "bg-cream/10 text-cream/40"
                          }`}
                          aria-label={
                            hasSubscription
                              ? "Paid OpenAI subscription"
                              : "No paid OpenAI subscription"
                          }
                        >
                          {hasSubscription ? (
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
                        <span>
                          Paid OpenAI: {hasSubscription ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                    <button
                      className="rounded-2xl border border-cream/30 px-5 py-2 text-xs uppercase tracking-[0.2em] text-cream transition hover:bg-cream/10"
                      onClick={() => setSubmitted(false)}
                    >
                      Edit
                    </button>
                  </div>
                  {lastUpdated && (
                    <p className="text-xs text-cream/60">
                      Last update sent {new Date(lastUpdated).toLocaleTimeString()}.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activityPhase !== "intake" && (
            <div className="mt-6 animate-fade">
              <div className="rounded-3xl bg-ink/50 p-6 shadow-glow">
                <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                  Group Assignment
                </p>
                <h2 className="mt-3 text-3xl font-semibold">
                  {groupNumber ? `Group ${groupNumber}` : "Your group"}
                </h2>
                <p className="mt-3 text-sm text-cream/70">
                  Find your teammates and sit together.
                </p>
                {groupAssignment && (
                  <div className="mt-6 grid gap-3">
                    {memberNames.map((member) => (
                      <div
                        key={member}
                        className="animate-rise rounded-2xl bg-panel/70 px-4 py-3 text-base text-cream/90"
                      >
                        {member}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activityPhase === "activity1" && (
                <div className="mt-8 rounded-3xl bg-panel/80 p-6 shadow-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                        Activity 1
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold">
                        Group report
                      </h3>
                    </div>
                    {groupAssignment?.group.reporterId && (
                      <span className="rounded-full border border-cream/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/70">
                        {isReporter ? "Reporter" : "Waiting"}
                      </span>
                    )}
                  </div>

                  {isReporter && !activity1Submitted && (
                    <div className="mt-6 grid gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                          What question did you ask?
                        </p>
                        <textarea
                          className="mt-3 w-full resize-none rounded-xl border border-cream/10 bg-ink/70 px-3 py-2 text-base text-cream outline-none transition focus:border-cream/40"
                          rows={3}
                          value={activity1Question}
                          onChange={(event) =>
                            setActivity1Question(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                          What were your impressions of the results?
                        </p>
                        <textarea
                          className="mt-3 w-full resize-none rounded-xl border border-cream/10 bg-ink/70 px-3 py-2 text-base text-cream outline-none transition focus:border-cream/40"
                          rows={3}
                          value={activity1Impressions}
                          onChange={(event) =>
                            setActivity1Impressions(event.target.value)
                          }
                        />
                      </div>
                      <button
                        className="rounded-2xl bg-sand px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-sand/40"
                        onClick={handleActivity1Submit}
                        disabled={!activity1Ready}
                      >
                        Submit Activity 1
                      </button>
                    </div>
                  )}

                  {isReporter && activity1Submitted && (
                    <p className="mt-6 text-sm text-cream/70">
                      Submitted. Waiting for the presenter to wrap up Activity 1.
                    </p>
                  )}

                  {!isReporter && (
                    <p className="mt-6 text-sm text-cream/70">
                      Your reporter is submitting the group response. Hang tight.
                    </p>
                  )}
                </div>
              )}

              {activityPhase === "activity1:results" && (
                <div className="mt-8 rounded-3xl bg-panel/80 p-6 text-center shadow-glow">
                  <h3 className="text-2xl font-semibold">
                    Activity 1 submitted
                  </h3>
                  <p className="mt-3 text-sm text-cream/70">
                    Thanks! Wait for the presenter to move to the next step.
                  </p>
                </div>
              )}

              {activityPhase === "activity2" && (
                <div className="mt-8 rounded-3xl bg-panel/80 p-6 shadow-glow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                        Activity 2
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold">
                        Group report
                      </h3>
                    </div>
                    {groupAssignment?.group.reporterId && (
                      <span className="rounded-full border border-cream/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cream/70">
                        {isReporter ? "Reporter" : "Waiting"}
                      </span>
                    )}
                  </div>

                  {isReporter && !activity2Submitted && (
                    <div className="mt-6 grid gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                          3 questions RAG answered - how did it do?
                        </p>
                        <textarea
                          className="mt-3 w-full resize-none rounded-xl border border-cream/10 bg-ink/70 px-3 py-2 text-base text-cream outline-none transition focus:border-cream/40"
                          rows={3}
                          value={activity2RagImpressions}
                          onChange={(event) =>
                            setActivity2RagImpressions(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                          1 trick question - how did it do?
                        </p>
                        <textarea
                          className="mt-3 w-full resize-none rounded-xl border border-cream/10 bg-ink/70 px-3 py-2 text-base text-cream outline-none transition focus:border-cream/40"
                          rows={3}
                          value={activity2TrickImpressions}
                          onChange={(event) =>
                            setActivity2TrickImpressions(event.target.value)
                          }
                        />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-cream/60">
                          Citation requirement - was this an accurate citation?
                        </p>
                        <textarea
                          className="mt-3 w-full resize-none rounded-xl border border-cream/10 bg-ink/70 px-3 py-2 text-base text-cream outline-none transition focus:border-cream/40"
                          rows={3}
                          value={activity2CitationImpressions}
                          onChange={(event) =>
                            setActivity2CitationImpressions(event.target.value)
                          }
                        />
                      </div>
                      <button
                        className="rounded-2xl bg-sand px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-ink transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:bg-sand/40"
                        onClick={handleActivity2Submit}
                        disabled={!activity2Ready}
                      >
                        Submit Activity 2
                      </button>
                    </div>
                  )}

                  {isReporter && activity2Submitted && (
                    <p className="mt-6 text-sm text-cream/70">
                      Submitted. Waiting for the presenter to wrap up Activity 2.
                    </p>
                  )}

                  {!isReporter && (
                    <p className="mt-6 text-sm text-cream/70">
                      Your reporter is submitting the group response. Hang tight.
                    </p>
                  )}
                </div>
              )}

              {activityPhase === "activity2:results" && (
                <div className="mt-8 rounded-3xl bg-panel/80 p-6 text-center shadow-glow">
                  <h3 className="text-2xl font-semibold">
                    Activity 2 submitted
                  </h3>
                  <p className="mt-3 text-sm text-cream/70">
                    Thanks! Wait for the presenter to move to the next step.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
