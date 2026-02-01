import { ScrollView, Text, View, TouchableOpacity, Switch } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(colorScheme === "dark");

  const handleLogout = () => {
    // TODO: Implement logout
    router.push("/");
  };

  const SettingItem = ({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: string;
    label: string;
    value?: string | boolean;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between p-4 border-b border-border"
      style={{ borderColor: colors.border }}
    >
      <View className="flex-row items-center flex-1">
        <Ionicons name={icon as any} size={20} color={colors.primary} />
        <Text className="text-foreground font-medium ml-3">{label}</Text>
      </View>
      {typeof value === "boolean" ? (
        <Switch
          value={value}
          onValueChange={onPress}
          disabled={true}
        />
      ) : (
        <View className="flex-row items-center">
          <Text className="text-muted text-sm mr-2">{value}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <ScreenContainer className="p-0">
      <ScrollView>
        {/* Header */}
        <View className="px-4 py-6">
          <Text className="text-3xl font-bold text-foreground">Configurações</Text>
        </View>

        {/* Profile Section */}
        <View className="bg-surface border-t border-b border-border" style={{ borderColor: colors.border }}>
          <View className="px-4 py-4 flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-primary items-center justify-center">
              <Text className="text-white text-lg font-bold">J</Text>
            </View>
            <View className="ml-4 flex-1">
              <Text className="text-foreground font-semibold">João Silva</Text>
              <Text className="text-muted text-sm">joao@example.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </View>
        </View>

        {/* Preferences Section */}
        <View className="mt-6">
          <Text className="text-sm font-semibold text-muted px-4 mb-2">PREFERÊNCIAS</Text>
          <View className="bg-surface border-t border-b border-border" style={{ borderColor: colors.border }}>
            <SettingItem
              icon="notifications"
              label="Notificações"
              value={notifications}
              onPress={() => setNotifications(!notifications)}
            />
            <SettingItem
              icon="moon"
              label="Modo Escuro"
              value={darkMode}
              onPress={() => setDarkMode(!darkMode)}
            />
          </View>
        </View>

        {/* App Section */}
        <View className="mt-6">
          <Text className="text-sm font-semibold text-muted px-4 mb-2">APLICATIVO</Text>
          <View className="bg-surface border-t border-b border-border" style={{ borderColor: colors.border }}>
            <SettingItem
              icon="information-circle"
              label="Sobre"
              value="v1.0.0"
            />
            <SettingItem
              icon="help-circle"
              label="Ajuda e Suporte"
            />
            <SettingItem
              icon="document-text"
              label="Política de Privacidade"
            />
          </View>
        </View>

        {/* Logout Button */}
        <View className="px-4 mt-8 mb-8">
          <TouchableOpacity
            onPress={handleLogout}
            className="bg-error/10 rounded-lg py-4 items-center justify-center"
            activeOpacity={0.8}
          >
            <View className="flex-row items-center">
              <Ionicons name="log-out" size={20} color={colors.error} />
              <Text className="text-error font-semibold ml-2">Sair da Conta</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
