import { useEffect, useState, useRef, useCallback } from "react";
import {
  HubConnectionBuilder,
  HubConnection,
  LogLevel,
} from "@microsoft/signalr";
import type { GameState } from "../types/GameState";

export function useSignalR() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Disconnected");
  const connectionRef = useRef<HubConnection | null>(null);

  useEffect(() => {
    const newConnection = new HubConnectionBuilder()
      .withUrl("/gamehub")
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connectionRef.current = newConnection;

    newConnection.on("ReceiveGameState", (newGameState: GameState) => {
      setGameState(newGameState);
    });

    newConnection
      .start()
      .then(() => {
        setConnectionStatus("Connected");
      })
      .catch((err) => {
        console.error("SignalR Connection Error: ", err);
        setConnectionStatus("Error");
      });

    newConnection.onreconnecting(() => {
      setConnectionStatus("Reconnecting...");
    });

    newConnection.onreconnected(() => {
      setConnectionStatus("Connected");
    });

    newConnection.onclose(() => {
      setConnectionStatus("Disconnected");
    });

    return () => {
      newConnection.stop();
    };
  }, []);

  const invoke = useCallback(
    async (method: string, ...args: unknown[]) => {
      if (connectionRef.current?.state === "Connected") {
        await connectionRef.current.invoke(method, ...args);
      }
    },
    [],
  );

  return { gameState, connectionStatus, invoke };
}
