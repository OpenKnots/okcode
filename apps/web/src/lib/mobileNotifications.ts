/**
 * Mobile notification bridge.
 *
 * Listens to orchestration domain events over the WebSocket push channel and
 * fires local notifications via the mobile bridge when the app is backgrounded
 * and an attention-requiring event arrives.
 *
 * This module is side-effect free until `initMobileNotifications` is called.
 */
import type { MobileNotificationEvent } from "@okcode/contracts";
import { ORCHESTRATION_WS_CHANNELS } from "@okcode/contracts";

import { readMobileBridge } from "./runtimeBridge";
import type { WsTransport } from "../wsTransport";

let initialized = false;

/**
 * Returns true when the document is hidden (app is backgrounded / tab is not
 * visible). Notifications are only fired when the user is not actively looking
 * at the app.
 */
function isAppBackgrounded(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

/**
 * Derive a notification event from an orchestration domain event, or null if
 * the event does not warrant a notification.
 */
function deriveNotification(event: {
  type: string;
  payload?: Record<string, unknown>;
  eventId?: string;
  occurredAt?: string;
}): MobileNotificationEvent | null {
  const eventId = (event.eventId as string) ?? crypto.randomUUID();
  const occurredAt = (event.occurredAt as string) ?? new Date().toISOString();
  const threadId = (event.payload?.threadId as string) ?? undefined;

  switch (event.type) {
    case "thread.approval-response-requested":
      return {
        id: eventId,
        category: "approval-requested",
        title: "Approval Requested",
        body: "An agent action needs your approval.",
        threadId,
        occurredAt,
      };

    case "thread.user-input-response-requested":
      return {
        id: eventId,
        category: "user-input-requested",
        title: "Input Needed",
        body: "The agent is waiting for your input.",
        threadId,
        occurredAt,
      };

    case "thread.turn-diff-completed":
      return {
        id: eventId,
        category: "turn-completed",
        title: "Turn Completed",
        body: "The agent has finished a turn.",
        threadId,
        occurredAt,
      };

    case "thread.session-set": {
      const status = (event.payload as Record<string, unknown>)?.status;
      if (
        typeof status === "object" &&
        status !== null &&
        (status as Record<string, unknown>).status === "error"
      ) {
        return {
          id: eventId,
          category: "session-error",
          title: "Session Error",
          body: "An agent session encountered an error.",
          threadId,
          occurredAt,
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Initialize the mobile notification listener. Should be called once during
 * app startup when running in the mobile shell.
 */
export function initMobileNotifications(transport: WsTransport): () => void {
  const mobileBridge = readMobileBridge();
  if (!mobileBridge || initialized) {
    return () => {};
  }

  initialized = true;

  // Register for notification permissions eagerly.
  void mobileBridge.registerNotifications();

  const unsubscribe = transport.subscribe(ORCHESTRATION_WS_CHANNELS.domainEvent, (push) => {
    if (!isAppBackgrounded()) return;

    const event = push.data as {
      type: string;
      payload?: Record<string, unknown>;
      eventId?: string;
      occurredAt?: string;
    };
    const notification = deriveNotification(event);
    if (notification) {
      void mobileBridge.fireNotification(notification);
    }
  });

  return () => {
    initialized = false;
    unsubscribe();
  };
}
