import * as Auth from "@/lib/_core/auth";
import { useCallback } from "react";

const TEST_USER = {
  id: 1,
  openId: "test-user-123",
  name: "Usuário Teste",
  email: "teste@cinesync.local",
  loginMethod: "test",
  lastSignedIn: new Date(),
};

const TEST_SESSION_TOKEN = "test-session-token-" + Date.now();

export function useTestLogin() {
  const loginWithTestUser = useCallback(async () => {
    try {
      // Store test session token
      await Auth.setSessionToken(TEST_SESSION_TOKEN);

      // Store test user info
      await Auth.setUserInfo(TEST_USER);

      console.log("[TestLogin] Test user logged in successfully");
      return true;
    } catch (error) {
      console.error("[TestLogin] Failed to login with test user:", error);
      return false;
    }
  }, []);

  const logoutTestUser = useCallback(async () => {
    try {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      console.log("[TestLogin] Test user logged out");
      return true;
    } catch (error) {
      console.error("[TestLogin] Failed to logout test user:", error);
      return false;
    }
  }, []);

  return {
    loginWithTestUser,
    logoutTestUser,
    testUser: TEST_USER,
  };
}
