import { useEffect, useState } from "react";

const CHANNEL_NAME = "display-tab-presence";
const HEARTBEAT_INTERVAL_MS = 2000;
const HEARTBEAT_TIMEOUT_MS = 5000;

interface HeartbeatMessage {
  type: "heartbeat" | "announce" | "closing";
  tabId: string;
}

/**
 * Detects if the Display page is open in multiple browser tabs on the same machine
 * using the BroadcastChannel API. Returns true when another Display tab is detected.
 */
export function useDuplicateDisplayDetection(): boolean {
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const tabId = crypto.randomUUID();
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const otherTabs = new Map<string, number>();

    const pruneStale = () => {
      const now = Date.now();
      for (const [id, lastSeen] of otherTabs) {
        if (now - lastSeen > HEARTBEAT_TIMEOUT_MS) {
          otherTabs.delete(id);
        }
      }
      setIsDuplicate(otherTabs.size > 0);
    };

    const handleMessage = (event: MessageEvent<HeartbeatMessage>) => {
      const { type, tabId: senderId } = event.data;
      if (senderId === tabId) return;

      if (type === "closing") {
        otherTabs.delete(senderId);
      } else {
        otherTabs.set(senderId, Date.now());
      }
      setIsDuplicate(otherTabs.size > 0);
    };

    channel.addEventListener("message", handleMessage);

    // Announce presence immediately
    channel.postMessage({ type: "announce", tabId } satisfies HeartbeatMessage);

    // Send periodic heartbeats
    const heartbeatTimer = setInterval(() => {
      channel.postMessage({ type: "heartbeat", tabId } satisfies HeartbeatMessage);
      pruneStale();
    }, HEARTBEAT_INTERVAL_MS);

    // Notify other tabs when closing
    const handleBeforeUnload = () => {
      channel.postMessage({ type: "closing", tabId } satisfies HeartbeatMessage);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(heartbeatTimer);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.postMessage({ type: "closing", tabId } satisfies HeartbeatMessage);
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, []);

  return isDuplicate;
}
