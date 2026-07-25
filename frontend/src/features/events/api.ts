import { api } from "@/shared/api/client";

export type ClientEventName = "ui_import_opened" | "ui_paste_link_used" | "ui_bookmarklet_used";

/** Fire-and-forget product analytics event. Never throws. */
export function trackEvent(name: ClientEventName, properties?: Record<string, unknown>) {
  try {
    void api<void>("/events", { method: "POST", body: { name, properties } }).catch(() => {
      // analytics must never break the UI
    });
  } catch {
    // ignore
  }
}
