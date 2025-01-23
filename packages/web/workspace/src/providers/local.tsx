import {
  ParentProps,
  createContext,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import { bus } from "./bus";
import { useDummyConfig } from "./dummy";
import { createStore } from "solid-js/store";

interface State {
  app?: string;
  stage?: string;
  region?: string;
}

const localContext = createContext<State>();

export function LocalProvider(props: ParentProps) {
  const dummy = useDummyConfig();
  if (dummy())
    return (
      <localContext.Provider value={dummy()!.local}>
        {props.children}
      </localContext.Provider>
    );

  let reconnect: number;
  let ws: WebSocket;
  const [store, setStore] = createStore<State>({});

  bus.on("log.cleared", (properties) => {
    if (!ws) return;
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(
      JSON.stringify({
        type: "log.cleared",
        properties,
      }),
    );
  });

  bus.on("cli.dev", (properties) => {
    setStore(properties);
  });

  let attempt = 0;
  const urls = [
    "ws://localhost:13557/socket",
    "wss://localhost:13557/socket",
    "wss://localhost:14557/socket",
  ];
  onMount(() => {
    function connect() {
      const url = urls[attempt % urls.length];
      console.log("trying to connect to local", url);
      attempt++;
      clearTimeout(reconnect);
      ws = new WebSocket(url);
      ws.onmessage = (e) => {
        const parsed = JSON.parse(e.data);
        bus.emit(parsed.type, parsed.properties);
      };
      ws.onclose = () => {
        setStore({});
        reconnect = window.setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        reconnect = window.setTimeout(connect, 3000);
      };
    }
    connect();
  });

  onCleanup(() => {
    if (ws) ws.close();
    if (reconnect) clearTimeout(reconnect);
  });

  return (
    <localContext.Provider value={store}>
      {props.children}
    </localContext.Provider>
  );
}

export function useLocalContext() {
  const ctx = useContext(localContext);
  if (!ctx) throw new Error("No local context found");
  return ctx;
}
