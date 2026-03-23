import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState, useRef } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  Image,
} from "react-native";
import { Text } from "../components/Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { useI18n } from "../locales";
import { Colors, Fonts } from "../constants/theme";

export default function GuidelineScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateTransition = (newStep: number) => {
    const direction = newStep > step ? 1 : -1;

    // Fade out and slide out
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -30 * direction,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(newStep);
      slideAnim.setValue(30 * direction);

      // Fade in and slide in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const goNext = () => {
    if (step < 5) {
      animateTransition(step + 1);
    } else {
      router.push("/");
    }
  };

  const goBack = () => {
    if (step > 1) {
      animateTransition(step - 1);
    } else {
      router.push("/");
    }
  };

  const slides = [
    {
      image: require("../assets/images/Content.png"),
      title: t.guideline.slide1Title,
      text: t.guideline.slide1Text,
    },
    {
      image: require("../assets/images/phone-guideline.png"),
      title: t.guideline.slide2Title,
      text: t.guideline.slide2Text,
    },
    {
      image: require("../assets/images/press-new-button-guideline.png"),
      title: t.guideline.slide3Title,
      text: t.guideline.slide3Text,
    },
    {
      image: require("../assets/images/position-phone-guideline.png"),
      title: t.guideline.slide4Title,
      text: t.guideline.slide4Text,
    },
    {
      image: require("../assets/images/hold-phone-guideline.png"),
      title: t.guideline.slide5Title,
      text: t.guideline.slide5Text,
    },
  ];

  const currentSlide = slides[step - 1];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Ionicons name="chevron-back" size={24} color={Colors.guidelineTextDark} />
        </TouchableOpacity>
        <Text onPress={() => router.push("/")} style={styles.skipButton}>{t.guideline.skip}</Text>
      </View>

      <Animated.View
        style={[
          styles.guidelineContent,
          {
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <Image source={currentSlide.image} style={styles.guidelineImage} />
        <Text style={styles.guidelineTitle}>{currentSlide.title}</Text>
        <Text style={styles.guidelineText}>{currentSlide.text}</Text>
      </Animated.View>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i + 1 === step && styles.dotActive]}
          />
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={goNext}>
        <Text style={styles.buttonText}>{step < 5 ? t.guideline.next : t.guideline.getStarted}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.guidelineBackground,
  },
  guidelineContent: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    backgroundColor: "#FFFFFF",
    borderRadius: 75,
    padding: 16,
    alignItems: "center",
    width: "80%",
    alignSelf: "center",
    marginBottom: 16,
  },
  buttonText: {
    color: Colors.guidelineText,
    fontSize: 20,
    fontFamily: Fonts.bold,
  },
  skipButton: {
    fontSize: 16,
    color: Colors.guidelineTextDark,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#3B84BB",
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#325C7D",
  },
  guidelineImage: {

  },
  guidelineTitle: {
    fontSize: 32,
    textAlign: "center",
    color: Colors.textDark,
    fontFamily: Fonts.bold,
  },
  guidelineText: {
    fontSize: 22,
    textAlign: "center",
    color: Colors.guidelineTextDark,

  },
});
