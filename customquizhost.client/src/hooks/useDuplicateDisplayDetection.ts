import { useEffect, useState } from "react";

const CHANNEL_NAME = "display-tab-presence";

interface PresenceMessage {
  type: "announce" | "closing";
  tabId: string;
}

/**
 * Detects if the Display page is open in multiple browser tabs on the same machine
 * using the BroadcastChannel API. Returns true when another Display tab is detected.
 *
 * On mount each tab announces itself. When a tab receives an announce from another
 * tab it re-announces so both sides learn about each other. A closing message is
 * sent on beforeunload / cleanup so other tabs can clear the warning immediately.
 */
export function useDuplicateDisplayDetection(): boolean {
  const [isDuplicate, setIsDuplicate] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const tabId = crypto.randomUUID();
    const channel = new BroadcastChannel(CHANNEL_NAME);
    const otherTabs = new Set<string>();

    const handleMessage = (event: MessageEvent<PresenceMessage>) => {
      const { type, tabId: senderId } = event.data;
      if (senderId === tabId) return;

      if (type === "closing") {
        otherTabs.delete(senderId);
      } else {
        const isNew = !otherTabs.has(senderId);
        otherTabs.add(senderId);

        // Re-announce so the sender also learns about us
        if (isNew) {
          channel.postMessage({ type: "announce", tabId } satisfies PresenceMessage);
        }
      }
      setIsDuplicate(otherTabs.size > 0);
    };

    channel.addEventListener("message", handleMessage);

    // Announce presence immediately
    channel.postMessage({ type: "announce", tabId } satisfies PresenceMessage);

    // Notify other tabs when closing
    const handleBeforeUnload = () => {
      channel.postMessage({ type: "closing", tabId } satisfies PresenceMessage);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      channel.postMessage({ type: "closing", tabId } satisfies PresenceMessage);
      channel.removeEventListener("message", handleMessage);
      channel.close();
    };
  }, []);

  return isDuplicate;
}
