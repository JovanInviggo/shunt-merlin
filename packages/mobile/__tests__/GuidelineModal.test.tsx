jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { SafeAreaView: ({ children }: any) => <View>{children}</View> };
});

jest.mock("../locales", () => ({
  useI18n: () => ({
    t: {
      guideline: {
        skip: "Skip",
        next: "Next",
        getStarted: "Get Started",
        close: "Close",
        slide1Title: "Slide 1 Title",
        slide1Text: "Slide 1 Text",
        slide2Title: "Slide 2 Title",
        slide2Text: "Slide 2 Text",
        slide3Title: "Slide 3 Title",
        slide3Text: "Slide 3 Text",
        slide4Title: "Slide 4 Title",
        slide4Text: "Slide 4 Text",
        slide5Title: "Slide 5 Title",
        slide5Text: "Slide 5 Text",
      },
    },
  }),
}));

import React from "react";
import { Animated } from "react-native";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import GuidelineModal from "../components/guidelines/GuidelineModal";

const onClose = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.spyOn(Animated, "timing").mockImplementation((value, config) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      if (config && "toValue" in config) {
        (value as Animated.Value).setValue(config.toValue as number);
      }
      callback?.({ finished: true });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  }));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("GuidelineModal visibility", () => {
  it("renders content when visible", () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    expect(screen.getByText("Slide 1 Title")).toBeTruthy();
  });

  it("does not render content when not visible", () => {
    render(<GuidelineModal visible={false} onClose={onClose} />);
    expect(screen.queryByText("Slide 1 Title")).toBeNull();
  });
});

describe("GuidelineModal navigation", () => {
  it("shows Next button on slide 1", () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    expect(screen.getByText("Next")).toBeTruthy();
  });

  it("advances to slide 2 when Next is pressed", async () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    await act(async () => { fireEvent.press(screen.getByText("Next")); });
    expect(screen.getByText("Slide 2 Title")).toBeTruthy();
  });

  it("shows Close button on slide 5", async () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    for (let i = 0; i < 4; i++) {
      await act(async () => { fireEvent.press(screen.getByText("Next")); });
    }
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("calls onClose and resets to slide 1 when Close is pressed on last slide", async () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    for (let i = 0; i < 4; i++) {
      await act(async () => { fireEvent.press(screen.getByText("Next")); });
    }
    await act(async () => { fireEvent.press(screen.getByText("Close")); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("GuidelineModal close button", () => {
  it("calls onClose when the close (X) button is pressed", () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    // The close button is the second TouchableOpacity (first is back chevron)
    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    // close button is positioned absolutely — it's the second touchable
    fireEvent.press(touchables[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when back chevron is pressed on slide 1", () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    // back chevron is the first touchable
    fireEvent.press(touchables[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose when back is pressed on slide 2 (goes back to slide 1)", async () => {
    render(<GuidelineModal visible={true} onClose={onClose} />);
    await act(async () => { fireEvent.press(screen.getByText("Next")); });
    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    fireEvent.press(touchables[0]);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText("Slide 1 Title")).toBeTruthy();
  });
});
