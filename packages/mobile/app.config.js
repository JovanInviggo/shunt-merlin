const packageJson = require("./package.json");

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// API base URLs per build profile.
// "local" expects the dev server reachable on LAN — replace with your machine's
// IP address when building a local APK (e.g. "http://192.168.1.42:3000").
const API_BASE_URLS = {
  local:       "http://localhost:3000",
  development: "https://dev-api.shuntwizard.com",
  production:  "https://api.shuntwizard.com",
};

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || "development";
  const getBundleIdentifier = () => {
    const baseId = "com.carealytix.ShuntMerlin";
    return profile === "production"
      ? baseId
      : `${baseId}${capitalize(profile)}`;
  };
  const buildNumber = parseInt(packageJson.build || "0", 10);

  const getVersionCode = () => {
    const [major, minor, patch] = packageJson.version.split(".").map(Number);

    if (isNaN(major) || isNaN(minor) || isNaN(patch) || isNaN(buildNumber)) {
      throw new Error("Invalid version or build number");
    }

    const versionCode = parseInt(
      `${major}${String(minor).padStart(2, "0")}${String(patch).padStart(
        2,
        "0"
      )}${String(buildNumber).padStart(2, "0")}`,
      10
    );

    if (versionCode > 2100000000) {
      // Google Play Store requires versionCode to be <= 2100000000
      console.warn(
        `Generated versionCode (${versionCode}) exceeds the maximum allowed value (2100000000). Consider adjusting your versioning scheme.`
      );
    }
    console.log("versionCode", versionCode);
    return versionCode;
  };

  const suffix = profile !== "production" ? ` (${profile})` : "";

  return {
    ...config,
    name: "ShuntMerlin" + suffix,
    slug: "ShuntMerlin",
    version: packageJson.version,
    orientation: "portrait",
    icon: "./assets/images/app-icon.png",
    scheme: "shuntmerlin",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: getBundleIdentifier(),
      infoPlist: {
        NSMicrophoneUsageDescription:
          "This app needs access to the microphone to record audio.",
        ITSAppUsesNonExemptEncryption: false,
      },
      buildNumber: `${buildNumber}`,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/splash-icon.png",
        backgroundColor: "#ffffff",
      },
      package: getBundleIdentifier(),
      permissions: ["RECORD_AUDIO"],
      versionCode: getVersionCode(),
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      [
        "react-native-permissions",
        {
          // Add setup_permissions to your Podfile (see iOS setup - steps 1, 2 and 3)
          iosPermissions: ["Camera", "Microphone"],
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "c71c7a77-fa61-4b32-a751-c268df42f82f",
      },
      // Consumed by config/api.ts via Constants.expoConfig.extra.apiBaseUrl
      apiBaseUrl: API_BASE_URLS[profile] ?? API_BASE_URLS.development,
    },
    experiments: {
      typedRoutes: true,
    },
  };
};
