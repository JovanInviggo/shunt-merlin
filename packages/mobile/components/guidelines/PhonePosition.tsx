import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import { Text } from "../Text";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "react-native";
import { Colors, Fonts } from "../../constants/theme";
import { useI18n } from "@/locales";
import GuidelineModal from "./GuidelineModal";

export default function PhonePosition({
    buttonText,
    onButtonPress,
    showHeader = true,
    moreInfo = false,
    showCancelButton = false,
    onCancelPress,
}: {
    buttonText: string;
    onButtonPress: () => void;
    showHeader?: boolean;
    moreInfo?: boolean;
    showCancelButton?: boolean;
    onCancelPress?: () => void;
}) {
    const { t } = useI18n();
    const [showGuidelineModal, setShowGuidelineModal] = useState(false);
    return (
        <>
        <GuidelineModal visible={showGuidelineModal} onClose={() => setShowGuidelineModal(false)} />
        <SafeAreaView style={styles.container} edges={["left", "right", 'bottom']}>
            {showHeader && <View style={styles.header}>
                <TouchableOpacity>
                    <Ionicons name="chevron-back" size={24} color={Colors.guidelineTextDark} />
                </TouchableOpacity>
                <Text>{t.guideline.skip}</Text>
            </View>}
            {showCancelButton && <TouchableOpacity style={styles.cancelButton} onPress={onCancelPress}>
                <Ionicons name="close-outline" size={24} color={Colors.guidelineTextDark} />
            </TouchableOpacity>}
            <View style={styles.guidelineContent}>
                <Image source={require("../../assets/images/position-phone-guideline.png")} />
                <Text style={styles.guidelineTitle}>{t.guideline.slide4Title}</Text>
                <Text style={styles.guidelineText}>{t.guideline.slide4Text}</Text>
                <TouchableOpacity style={styles.fullInstructionsButton} onPress={() => setShowGuidelineModal(true)}>
                    <Ionicons name="information-circle-outline" size={24} color={Colors.guidelineText} />
                    <Text style={styles.buttonText}>{t.guideline.viewFullInstructions}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={onButtonPress}>
                <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
        </SafeAreaView>
        </>
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
        marginBottom: 24,
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
    fullInstructionsButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 75,
        paddingVertical: 8,
        paddingHorizontal: 16,
        alignSelf: "center",
        marginTop: 24,
        borderWidth: 2,
        borderColor: "#0000001A",
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
    cancelButton: {
        position: "absolute",
        top: 14,
        right: 16,
        backgroundColor: "#0000001A",
        borderRadius: 20,
        padding: 4,
    },
    cancelButtonText: {
        fontSize: 24,
        color: Colors.guidelineTextDark,
    },
});
