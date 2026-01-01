"use client";

import {useCallback, useEffect, useState} from "react";

type WorkerEvent =
  | {type: "open"}
  | {type: "message"; data: string}
  | {type: "close"; code: number; reason: string}
  | {type: "error"; message: string}
  | {type: "status"; readyState: number};

type WorkerCommand =
  | {type: "connect"; url: string; initialMessages?: string[]}
  | {type: "send"; data: string}
  | {type: "close"}
  | {type: "terminate"};

type ConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

type Listener = (event: WorkerEvent) => void;

let sharedWorker: Worker | null = null;
let sharedRefCount = 0;
const listeners = new Set<Listener>();
let lastState: ConnectionState = "idle";
let lastMessageValue: string | null = null;
let lastErrorValue: string | null = null;
let lastCloseValue: {code: number; reason: string} | null = null;

function getWorker() {
  if (sharedWorker) return sharedWorker;
  const worker = new Worker(new URL("../workers/ws-worker.ts", import.meta.url), {
    type: "module",
  });
  worker.onmessage = (event: MessageEvent<WorkerEvent>) => {
    const message = event.data;
    switch (message.type) {
      case "open":
        lastState = "open";
        break;
      case "message":
        lastMessageValue = message.data;
        break;
      case "close":
        lastState = "closed";
        lastCloseValue = {code: message.code, reason: message.reason};
        break;
      case "error":
        lastErrorValue = message.message;
        lastState = "error";
        break;
      case "status":
        if (message.readyState === WebSocket.CONNECTING) {
          lastState = "connecting";
        }
        break;
      default:
        break;
    }
    listeners.forEach((listener) => listener(message));
  };
  sharedWorker = worker;
  return worker;
}

function maybeTerminateWorker() {
  if (sharedRefCount > 0 || !sharedWorker) return;
  sharedWorker.postMessage({type: "terminate"} satisfies WorkerCommand);
  sharedWorker.terminate();
  sharedWorker = null;
  lastState = "idle";
  lastMessageValue = null;
  lastErrorValue = null;
}

export default function useWebsocketWorker() {
  const [state, setState] = useState<ConnectionState>(lastState);
  const [lastMessage, setLastMessage] = useState<string | null>(lastMessageValue);
  const [lastError, setLastError] = useState<string | null>(lastErrorValue);
  const [lastClose, setLastClose] = useState<{code: number; reason: string} | null>(
    lastCloseValue
  );

  useEffect(() => {
    getWorker();
    sharedRefCount += 1;
    const listener: Listener = (message) => {
      switch (message.type) {
        case "open":
          setState("open");
          break;
        case "message":
          setLastMessage(message.data);
          break;
        case "close":
          setState("closed");
          setLastClose({code: message.code, reason: message.reason});
          break;
        case "error":
          setLastError(message.message);
          setState("error");
          break;
        case "status":
          if (message.readyState === WebSocket.CONNECTING) {
            setState("connecting");
          }
          break;
        default:
          break;
      }
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      sharedRefCount = Math.max(0, sharedRefCount - 1);
      if (sharedRefCount === 0) {
        maybeTerminateWorker();
      }
    };
  }, []);

  const connect = useCallback((url: string, initialMessages?: string[]) => {
    lastState = "connecting";
    lastErrorValue = null;
    setState("connecting");
    getWorker().postMessage({type: "connect", url, initialMessages} satisfies WorkerCommand);
  }, []);

  const send = useCallback((data: string) => {
    getWorker().postMessage({type: "send", data} satisfies WorkerCommand);
  }, []);

  const close = useCallback(() => {
    if (!sharedWorker) return;
    lastState = "closed";
    sharedWorker.postMessage({type: "close"} satisfies WorkerCommand);
  }, []);

  return {state, lastMessage, lastError, lastClose, connect, send, close} as const;
}
