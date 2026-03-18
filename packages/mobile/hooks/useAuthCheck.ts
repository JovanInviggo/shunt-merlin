import { useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { isLoggedIn } from "../utils/auth-storage";

export const useAuthCheck = () => {
  const router = useRouter();
  const segments = useSegments();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentRoute = segments[0];

        // Skip check if already on auth screens
        if (currentRoute === "login") {
          setIsChecking(false);
          return;
        }

        // Check login status
        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
          router.dismissAll();
          router.replace("/login");
          setIsChecking(false);
          return;
        }

        // All checks passed
        setIsChecking(false);
      } catch (error) {
        console.error("Error checking auth:", error);
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [router, segments]);

  return { isChecking };
};
