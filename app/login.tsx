import { ScrollView, Text, View, TouchableOpacity, ActivityIndicator, Linking, Platform } from "react-native";
import { useEffect } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { getLoginUrl } from "@/constants/oauth";
import { useTestLogin } from "@/hooks/use-test-login";

export default function LoginScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user, isAuthenticated, loading } = useAuth();
  const { loginWithTestUser } = useTestLogin();

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, user]);

  const handleLogin = async () => {
    try {
      const loginUrl = getLoginUrl();
      console.log("[Login] OAuth URL:", loginUrl);

      if (Platform.OS === "web") {
        // Web: redirect directly
        window.location.href = loginUrl;
      } else {
        // Native: open in browser
        await Linking.openURL(loginUrl);
      }
    } catch (error) {
      console.error("[Login] Failed to start OAuth:", error);
    }
  };

  const handleTestLogin = async () => {
    const success = await loginWithTestUser();
    if (success) {
      router.replace("/(tabs)");
    }
  };

  if (loading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-foreground mt-4">Carregando...</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-0">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 items-center justify-center px-6 gap-8">
          {/* Logo Section */}
          <View className="items-center gap-4">
            <View className="w-24 h-24 rounded-full bg-primary items-center justify-center">
              <Ionicons name="play-circle" size={60} color="white" />
            </View>
            <View className="items-center gap-2">
              <Text className="text-4xl font-bold text-foreground">CineSync</Text>
              <Text className="text-lg text-muted">Assista juntos</Text>
            </View>
          </View>

          {/* Description */}
          <View className="gap-3">
            <View className="flex-row items-start gap-3">
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text className="text-foreground flex-1">Assista vídeos em tempo real com amigos</Text>
            </View>
            <View className="flex-row items-start gap-3">
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text className="text-foreground flex-1">Chat sincronizado durante a exibição</Text>
            </View>
            <View className="flex-row items-start gap-3">
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              <Text className="text-foreground flex-1">Suporte para YouTube, Google Drive e mais</Text>
            </View>
          </View>

          {/* Login Button */}
      <TouchableOpacity
        onPress={handleLogin}
        className="w-full bg-primary rounded-full py-4 items-center justify-center"
        activeOpacity={0.8}
      >
            <View className="flex-row items-center">
              <Ionicons name="log-in" size={20} color="white" />
              <Text className="text-white font-semibold ml-2">Entrar com Manus</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTestLogin}
            className="w-full bg-surface rounded-full py-4 items-center justify-center border border-border"
            style={{ borderColor: colors.border }}
            activeOpacity={0.8}
          >
            <View className="flex-row items-center">
              <Ionicons name="bug" size={20} color={colors.primary} />
              <Text className="text-foreground font-semibold ml-2">Entrar como Teste</Text>
            </View>
          </TouchableOpacity>

          {/* Info */}
          <View className="bg-surface rounded-lg p-4 border border-border w-full">
            <Text className="text-xs text-muted text-center">
              Ao fazer login, você concorda com nossos Termos de Serviço e Política de Privacidade
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
