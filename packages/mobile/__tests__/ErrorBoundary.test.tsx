jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      errorBoundary: {
        title: "Something went wrong",
        message: "The app encountered an unexpected error. Your recordings are safe.",
        tryAgain: "Try again",
      },
    },
  }),
}));

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Suppress React's error boundary console.error noise in test output
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

const GoodChild = () => {
  const { Text } = require("react-native");
  return <Text>All good</Text>;
};

const BadChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error("render crash");
  const { Text } = require("react-native");
  return <Text>All good</Text>;
};

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <GoodChild />
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeTruthy();
  });

  it("shows fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <BadChild shouldThrow />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText(/recordings are safe/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("logs the error via console.error on crash", () => {
    render(
      <ErrorBoundary>
        <BadChild shouldThrow />
      </ErrorBoundary>
    );
    expect(console.error).toHaveBeenCalledWith(
      "[ErrorBoundary] Uncaught error:",
      expect.any(Error),
      expect.anything()
    );
  });

  it("resets to children after pressing Try again", () => {
    // The child must stop throwing BEFORE the boundary resets, otherwise it
    // immediately re-throws when the boundary re-renders its children.
    let shouldThrow = true;
    const TogglableChild = () => {
      if (shouldThrow) throw new Error("render crash");
      const { Text } = require("react-native");
      return <Text>All good</Text>;
    };

    render(
      <ErrorBoundary>
        <TogglableChild />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(screen.getByText("Try again"));

    expect(screen.getByText("All good")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });
});
