import { useCallback, useEffect, useState } from "react";

const CHANNEL_NAME = "display-tab-presence";

/**
 * Generates a unique tab identifier. Uses `crypto.randomUUID` when available
 * (secure contexts – HTTPS or localhost), and falls back to a Math.random-based
 * ID otherwise. `crypto.randomUUID` is not exposed on non-secure origins such
 * as plain-HTTP LAN addresses (e.g. http://192.168.x.x), so calling it there
 * throws "crypto.randomUUID is not a function". The tab ID only needs to be
 * unique across tabs on the same device, so the fallback is sufficient.
 */
function generateTabId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface PresenceMessage {
  type: "announce" | "closing";
  tabId: string;
}

interface DuplicateDisplayState {
  /** Whether another Display tab is currently open on this device. */
  isDuplicate: boolean;
  /** Whether the user has dismissed the warning for the current set of peers. */
  dismissed: boolean;
  /** Call to dismiss the warning. It automatically resets when the peer set changes. */
  dismiss: () => void;
}

/**
 * Detects if the Display page is open in multiple browser tabs on the same machine
 * using the BroadcastChannel API.
 *
 * On mount each tab announces itself. When a tab receives an announce from another
 * tab it re-announces so both sides learn about each other. A closing message is
 * sent on beforeunload / cleanup so other tabs can clear the warning immediately.
 */
export function useDuplicateDisplayDetection(): DuplicateDisplayState {
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const tabId = generateTabId();
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
          // A new peer joined – reset any prior dismissal
          setDismissed(false);
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

  const dismiss = useCallback(() => setDismissed(true), []);

  return { isDuplicate, dismissed, dismiss };
}
