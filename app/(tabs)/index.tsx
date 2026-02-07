import { ScrollView, Text, View, TouchableOpacity, TextInput, Alert, StyleSheet } from "react-native";
import { useState } from "react";
// Importante: Usar View normal se ScreenContainer estiver instável, 
// mas vou manter a estrutura que você confirmou que funciona.
import { ScreenContainer } from "@/components/screen-container"; 
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");

  const handleJoinRoom = () => {
    if (!joinId.trim()) {
      Alert.alert("Erro", "Digite o ID da sala para entrar.");
      return;
    }
    // Navega para a sala com o ID digitado
    router.push(`/room/${joinId.trim()}`);
  };

  return (
    <ScreenContainer className="p-4 bg-[#0F172A]">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        
        {/* Cabeçalho */}
        <View className="items-center mb-10">
          <View className="bg-[#6366F1]/20 p-6 rounded-full mb-4">
            <Ionicons name="film-outline" size={64} color="#6366F1" />
          </View>
          <Text className="text-4xl font-bold text-white mb-2">CineSync</Text>
          <Text className="text-gray-400 text-lg">Assista juntos, onde estiver.</Text>
        </View>

        {/* Cartão de Ações */}
        <View className="bg-[#1E293B] p-6 rounded-3xl border border-[#334155] w-full">
          
          {/* Botão CRIAR SALA */}
          <TouchableOpacity
            onPress={() => router.push('/create-room')}
            className="bg-[#6366F1] py-4 px-6 rounded-xl flex-row items-center justify-center mb-8"
            activeOpacity={0.8}
            style={styles.shadow} // Sombra suave
          >
            <Ionicons name="add-circle" size={28} color="white" style={{ marginRight: 12 }} />
            <Text className="text-white font-bold text-xl">CRIAR NOVA SALA</Text>
          </TouchableOpacity>

          {/* Divisor Visual */}
          <View className="flex-row items-center mb-8">
            <View className="flex-1 h-[1px] bg-[#334155]" />
            <Text className="text-gray-500 mx-4 font-bold text-xs tracking-widest">OU ENTRE EM UMA SALA</Text>
            <View className="flex-1 h-[1px] bg-[#334155]" />
          </View>

          {/* Área de ENTRAR */}
          <View>
            <Text className="text-gray-300 font-semibold mb-3 ml-1">Já tem um código?</Text>
            <View className="flex-row gap-3">
              <TextInput
                placeholder="Ex: room_1234"
                placeholderTextColor="#64748B"
                value={joinId}
                onChangeText={setJoinId}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 bg-[#0F172A] text-white p-4 rounded-xl border border-[#334155] text-lg"
              />
              <TouchableOpacity
                onPress={handleJoinRoom}
                disabled={!joinId.trim()}
                className={`w-16 items-center justify-center rounded-xl ${joinId.trim() ? 'bg-[#6366F1]' : 'bg-[#334155]'}`}
              >
                <Ionicons name="arrow-forward" size={28} color={joinId.trim() ? "white" : "#94A3B8"} />
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

// Estilos extras que o NativeWind às vezes precisa de ajuda
const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#6366F1",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  }
});