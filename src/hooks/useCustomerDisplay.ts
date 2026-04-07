/**
 * useCustomerDisplay Hook
 *
 * Broadcasts cart state to the customer display page (/display)
 * via BroadcastChannel + localStorage fallback.
 *
 * Usage in POS:
 *   const broadcast = useCustomerDisplay();
 *   broadcast({ items, total, status: 'ordering' });
 */

"use client";

import { useRef, useCallback, useEffect } from "react";
import type {
  CustomerDisplayData,
  DisplayItem,
  DisplayStatus,
} from "@/src/app/display/page";

const CHANNEL_NAME = "park-customer-display";
const LS_KEY = "park_customer_display";

export type { CustomerDisplayData, DisplayItem, DisplayStatus };

/**
 * Returns a broadcast function that sends data to the customer display.
 * Automatically cleans up the BroadcastChannel on unmount.
 */
export function useCustomerDisplay() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      channelRef.current = new BroadcastChannel(CHANNEL_NAME);
    }
    return () => {
      channelRef.current?.close();
    };
  }, []);

  const broadcast = useCallback((data: CustomerDisplayData) => {
    // BroadcastChannel (instant)
    try {
      channelRef.current?.postMessage(data);
    } catch {
      // Silently fail — channel may be closed
    }

    // localStorage fallback (for browsers without BroadcastChannel)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch {
      // Storage full or unavailable
    }
  }, []);

  return broadcast;
}
