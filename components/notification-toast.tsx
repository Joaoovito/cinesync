import { View, Text, Animated, Easing } from "react-native";
import { useEffect, useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/use-colors";

export type NotificationType = "user-joined" | "user-left" | "info" | "success" | "error";

interface NotificationToastProps {
  message: string;
  type: NotificationType;
  duration?: number;
  onDismiss?: () => void;
}

export function NotificationToast({
  message,
  type,
  duration = 3000,
  onDismiss,
}: NotificationToastProps) {
  const colors = useColors();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Slide in
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        onDismiss?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [slideAnim, duration, onDismiss]);

  const getBackgroundColor = () => {
    switch (type) {
      case "user-joined":
        return colors.success;
      case "user-left":
        return "#F59E0B";
      case "error":
        return colors.error;
      case "success":
        return colors.success;
      default:
        return colors.primary;
    }
  };

  const getIcon = () => {
    switch (type) {
      case "user-joined":
        return "person-add";
      case "user-left":
        return "person-remove";
      case "error":
        return "alert-circle";
      case "success":
        return "checkmark-circle";
      default:
        return "information-circle";
    }
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
      }}
      className="absolute top-0 left-0 right-0 z-50"
    >
      <View
        className="mx-4 mt-4 rounded-lg px-4 py-3 flex-row items-center gap-3"
        style={{ backgroundColor: getBackgroundColor() }}
      >
        <Ionicons name={getIcon()} size={20} color="white" />
        <Text className="flex-1 text-white text-sm font-medium">{message}</Text>
      </View>
    </Animated.View>
  );
}
