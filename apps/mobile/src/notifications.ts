/**
 * Local notification support for the mobile companion app.
 *
 * Uses Capacitor Local Notifications to alert the user when attention-requiring
 * events arrive while the app is backgrounded.
 */
import { LocalNotifications } from "@capacitor/local-notifications";
import type { MobileNotificationEvent } from "@okcode/contracts";

let registered = false;
let nextNotificationId = 1;

const CATEGORY_CHANNEL_MAP: Record<MobileNotificationEvent["category"], string> = {
  "approval-requested": "attention",
  "user-input-requested": "attention",
  "turn-completed": "status",
  "session-error": "alerts",
};

/**
 * Request notification permissions and create notification channels.
 * Returns true if permission was granted.
 */
export async function registerNotifications(): Promise<boolean> {
  if (registered) return true;

  try {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") {
      return false;
    }

    // Create Android notification channels (no-op on iOS)
    await LocalNotifications.createChannel({
      id: "attention",
      name: "Attention Required",
      description: "Approval requests and user input needed",
      importance: 5, // Max importance
      sound: "default",
      vibration: true,
    });

    await LocalNotifications.createChannel({
      id: "status",
      name: "Status Updates",
      description: "Turn completions and session updates",
      importance: 3, // Default importance
      sound: "default",
      vibration: false,
    });

    await LocalNotifications.createChannel({
      id: "alerts",
      name: "Alerts",
      description: "Errors and critical session events",
      importance: 4, // High importance
      sound: "default",
      vibration: true,
    });

    registered = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Fire a local notification for a mobile notification event.
 */
export async function fireNotification(event: MobileNotificationEvent): Promise<void> {
  if (!registered) {
    const ok = await registerNotifications();
    if (!ok) return;
  }

  const channelId = CATEGORY_CHANNEL_MAP[event.category] ?? "attention";
  const id = nextNotificationId++;

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: event.title,
        body: event.body,
        channelId,
        extra: {
          eventId: event.id,
          category: event.category,
          threadId: event.threadId,
          occurredAt: event.occurredAt,
        },
        // Show immediately
        schedule: { at: new Date(Date.now() + 100) },
      },
    ],
  });
}

/**
 * Set up listener for notification taps to enable deep navigation.
 */
export function setupNotificationTapHandler(onTap: (threadId: string | undefined) => void): void {
  void LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    const threadId = action.notification.extra?.threadId as string | undefined;
    onTap(threadId);
  });
}
