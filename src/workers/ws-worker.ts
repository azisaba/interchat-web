let socket: WebSocket | null = null;
let pendingMessages: string[] = [];

type WorkerCommand =
  | {type: "connect"; url: string; initialMessages?: string[]}
  | {type: "send"; data: string}
  | {type: "close"}
  | {type: "terminate"};

type WorkerEvent =
  | {type: "open"}
  | {type: "message"; data: string}
  | {type: "close"; code: number; reason: string}
  | {type: "error"; message: string}
  | {type: "status"; readyState: number};

function post(event: WorkerEvent) {
  self.postMessage(event);
}

function teardown() {
  if (!socket) return;
  socket.onopen = null;
  socket.onmessage = null;
  socket.onclose = null;
  socket.onerror = null;
  socket.close();
  socket = null;
}

self.onmessage = (event: MessageEvent<WorkerCommand>) => {
  const message = event.data;
  switch (message.type) {
    case "connect": {
      teardown();
      pendingMessages = message.initialMessages ?? [];
      socket = new WebSocket(message.url);
      socket.onopen = () => {
        if (pendingMessages.length > 0) {
          pendingMessages.forEach((data) => socket?.send(data));
          pendingMessages = [];
        }
        post({type: "open"});
      };
      socket.onmessage = (evt) => post({type: "message", data: String(evt.data)});
      socket.onclose = (evt) =>
        post({type: "close", code: evt.code, reason: evt.reason});
      socket.onerror = () =>
        post({type: "error", message: "WebSocket error"});
      post({type: "status", readyState: socket.readyState});
      break;
    }
    case "send": {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(message.data);
      }
      break;
    }
    case "close": {
      teardown();
      break;
    }
    case "terminate": {
      teardown();
      self.close();
      break;
    }
    default: {
      break;
    }
  }
};
