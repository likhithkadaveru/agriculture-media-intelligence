"use client";

/**
 * Opt-in control for official alerts.
 *
 * The iOS caveat is stated in the UI rather than hidden in a doc: Safari
 * refuses notification permission from a normal tab, so on iPhone the site
 * must be added to the Home Screen first. An officer who taps "Enable" and
 * silently gets nothing would reasonably conclude the whole system is
 * broken, so the one case where it cannot work says so up front.
 */
import { useState, useSyncExternalStore } from "react";

type State = "checking" | "unsupported" | "ios-needs-install" | "ready" | "on" | "denied" | "error";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  // Backed by a plain ArrayBuffer: applicationServerKey rejects the
  // SharedArrayBuffer-capable default that Uint8Array.from infers.
  const view = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

/*
 * Capability detection reads browser-only APIs, so it cannot run during
 * render without a hydration mismatch. useSyncExternalStore is the primitive
 * for exactly that: the server snapshot is "checking" and the client
 * resolves on mount, with no setState-in-effect.
 */
const noopSubscribe = () => () => {};

function detect(): State {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  // iOS exposes neither API until the site is installed to the Home Screen.
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return isIos && !isStandalone ? "ios-needs-install" : "unsupported";
  }
  if (Notification.permission === "granted") return "on";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

export function AlertOptIn() {
  const detected = useSyncExternalStore(noopSubscribe, detect, () => "checking" as State);
  // Set only by the opt-in flow; detection remains the source of truth until
  // the user actually does something.
  const [override, setOverride] = useState<State | null>(null);
  const state = override ?? detected;
  const setState = setOverride;

  async function enable() {
    try {
      const meta = await fetch("/api/push/subscribe").then((r) => r.json());
      if (!meta.enabled) return setState("unsupported");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState("denied");

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(meta.publicKey),
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      setState(response.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "checking" || state === "unsupported") return null;

  const message: Record<Exclude<State, "checking" | "unsupported">, string> = {
    "ios-needs-install": "On iPhone: Share → Add to Home Screen, then open it to enable alerts.",
    ready: "Get notified when an unfavourable story breaks.",
    on: "Alerts are on for this device.",
    denied: "Notifications are blocked for this site in your browser settings.",
    error: "Could not enable alerts. Try again.",
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-[13px] text-ink-secondary">
      <span>{message[state]}</span>
      {(state === "ready" || state === "error") && (
        <button
          type="button"
          onClick={enable}
          className="min-h-[36px] rounded-md border border-border-strong px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface"
        >
          Enable alerts
        </button>
      )}
    </div>
  );
}
