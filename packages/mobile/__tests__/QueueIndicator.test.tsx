jest.mock("../utils/upload-queue", () => ({
  subscribeToQueueChanges: jest.fn(),
  unsubscribeFromQueueChanges: jest.fn(),
  getQueue: jest.fn().mockResolvedValue([]),
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      queue: {
        uploading: "Uploading {{count}} item",
        uploadingPlural: "Uploading {{count}} items",
      },
    },
    language: "en",
    setLanguage: jest.fn(),
  }),
  interpolate: (text: string, params: Record<string, any>) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, k) => params[k]?.toString() ?? `{{${k}}}`),
}));

import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import {
  subscribeToQueueChanges,
  unsubscribeFromQueueChanges,
  getQueue,
} from "../utils/upload-queue";
import { QueueIndicator } from "../components/QueueIndicator";

/** Returns the queue-change handler that the component passed to subscribeToQueueChanges. */
const getCapturedHandler = (): ((size: number) => void) => {
  const calls = (subscribeToQueueChanges as jest.Mock).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
};

beforeEach(() => {
  jest.clearAllMocks();
  (getQueue as jest.Mock).mockResolvedValue([]);
});

describe("QueueIndicator visibility", () => {
  it("renders nothing when queue size is 0", async () => {
    render(<QueueIndicator />);
    await act(async () => {}); // flush getQueue promise

    expect(screen.toJSON()).toBeNull();
  });

  it("renders text when queue size is 1 (singular)", async () => {
    render(<QueueIndicator />);
    await act(async () => {});

    await act(async () => { getCapturedHandler()(1); });

    expect(screen.getByText(/Uploading 1 item/)).toBeTruthy();
  });

  it("renders text when queue size is 3 (plural)", async () => {
    render(<QueueIndicator />);
    await act(async () => {});

    await act(async () => { getCapturedHandler()(3); });

    expect(screen.getByText(/Uploading 3 items/)).toBeTruthy();
  });

  it("returns to null when queue drops back to 0", async () => {
    render(<QueueIndicator />);
    await act(async () => {});

    await act(async () => { getCapturedHandler()(2); });
    await act(async () => { getCapturedHandler()(0); });

    expect(screen.toJSON()).toBeNull();
  });
});

describe("subscription lifecycle", () => {
  it("subscribes to queue changes on mount", async () => {
    render(<QueueIndicator />);
    await act(async () => {});

    expect(subscribeToQueueChanges).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes with the same handler on unmount", async () => {
    const { unmount } = render(<QueueIndicator />);
    await act(async () => {});

    const handler = getCapturedHandler();

    act(() => { unmount(); });

    expect(unsubscribeFromQueueChanges).toHaveBeenCalledWith(handler);
  });
});
