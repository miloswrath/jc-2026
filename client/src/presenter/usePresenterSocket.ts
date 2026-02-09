import { useEffect, useRef, useState } from "react";
import {
  Activity1Submission,
  Activity2Submission,
  ClientMessage,
  PresenterState,
  ServerMessage
} from "./types";
import { getWsUrl } from "../ws";

export function usePresenterSocket() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "ready">(
    "disconnected"
  );
  const [state, setState] = useState<PresenterState>({
    questions: [],
    participants: [],
    groups: [],
    activityPhase: "intake"
  });
  const [activity1Results, setActivity1Results] = useState<
    Activity1Submission[]
  >([]);
  const [activity2Results, setActivity2Results] = useState<
    Activity2Submission[]
  >([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const wsUrl = getWsUrl();

  useEffect(() => {
    if (!wsUrl || typeof WebSocket === "undefined") {
      return;
    }

    setStatus("connecting");
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    const handleOpen = () => {
      setStatus("ready");
      const message: ClientMessage = { type: "presenter:state" };
      socket.send(JSON.stringify(message));
    };

    const handleClose = () => setStatus("disconnected");
    const handleMessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        if (parsed.type === "presenter:state") {
          setState(parsed.payload);
          setLastUpdate(Date.now());
        }
        if (parsed.type === "activity1:results") {
          setActivity1Results(parsed.payload.responses);
        }
        if (parsed.type === "activity2:results") {
          setActivity2Results(parsed.payload.responses);
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

  return { status, state, lastUpdate, activity1Results, activity2Results, send };
}
