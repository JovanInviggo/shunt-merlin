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
        viewFullInstructions: "Show Full Instructions",
        slide4Title: "Position your phone",
        slide4Text: "Place the phone against your skin",
        slide1Title: "Slide 1 Title",
        slide1Text: "Slide 1 Text",
        slide2Title: "Slide 2 Title",
        slide2Text: "Slide 2 Text",
        slide3Title: "Slide 3 Title",
        slide3Text: "Slide 3 Text",
        slide5Title: "Slide 5 Title",
        slide5Text: "Slide 5 Text",
      },
    },
  }),
}));

// Mock GuidelineModal so we can assert on its visible prop
jest.mock("../components/guidelines/GuidelineModal", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
    visible ? <Text testID="guideline-modal">GuidelineModal</Text> : null;
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import PhonePosition from "../components/guidelines/PhonePosition";

const onButtonPress = jest.fn();
const onCancelPress = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PhonePosition — Show Full Instructions button", () => {
  it("GuidelineModal is not visible initially", () => {
    render(
      <PhonePosition buttonText="Start" onButtonPress={onButtonPress} />
    );
    expect(screen.queryByTestId("guideline-modal")).toBeNull();
  });

  it("opens GuidelineModal when Show Full Instructions is pressed", () => {
    render(
      <PhonePosition buttonText="Start" onButtonPress={onButtonPress} />
    );
    fireEvent.press(screen.getByText("Show Full Instructions"));
    expect(screen.getByTestId("guideline-modal")).toBeTruthy();
  });
});

describe("PhonePosition — main button", () => {
  it("calls onButtonPress when the main button is pressed", () => {
    render(
      <PhonePosition buttonText="Start Recording" onButtonPress={onButtonPress} />
    );
    fireEvent.press(screen.getByText("Start Recording"));
    expect(onButtonPress).toHaveBeenCalledTimes(1);
  });
});

describe("PhonePosition — cancel button", () => {
  it("does not render cancel button when showCancelButton is false", () => {
    render(
      <PhonePosition buttonText="Start" onButtonPress={onButtonPress} showCancelButton={false} />
    );
    // Only the main action button and the full-instructions button should be present
    expect(screen.queryByTestId("cancel-button")).toBeNull();
  });

  it("calls onCancelPress when cancel button is pressed", () => {
    render(
      <PhonePosition
        buttonText="Start"
        onButtonPress={onButtonPress}
        showCancelButton={true}
        onCancelPress={onCancelPress}
      />
    );
    // cancel button is the first TouchableOpacity when showCancelButton=true
    const touchables = screen.UNSAFE_getAllByType(
      require("react-native").TouchableOpacity
    );
    // Fragment: [GuidelineModal(null), SafeAreaView > [cancelButton, guidelineContent > fullInstructionsButton, mainButton]]
    // Find cancel by pressing each and checking which calls onCancelPress
    let called = false;
    for (const t of touchables) {
      fireEvent.press(t);
      if (onCancelPress.mock.calls.length > 0) { called = true; break; }
    }
    expect(called).toBe(true);
  });
});
