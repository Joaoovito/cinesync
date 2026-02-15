import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, SafeAreaView, Alert, ScrollView, FlatList, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client'; // Importante para ouvir as salas
import { BrowserSelector } from '../../components/browser-selector';

// 👇 CONFIRME SEU IP AQUI
const SOCKET_URL = 'http://192.168.0.5:3000'; 

interface RoomInfo {
  id: string;
  userCount: number;
  hasVideo: boolean;
}

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [targetUrl, setTargetUrl] = useState('https://google.com');
  
  // Estado das Salas Ativas
  const [activeRooms, setActiveRooms] = useState<RoomInfo[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Conecta na Home para ver as salas em tempo real
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { displayName: 'Observador' }
    });
    setSocket(newSocket);

    newSocket.on('active_rooms', (rooms: RoomInfo[]) => {
      console.log("Salas ativas:", rooms);
      setActiveRooms(rooms);
    });

    return () => { newSocket.disconnect(); };
  }, []);

  const openSource = (url: string) => {
    if (!username.trim()) {
      Alert.alert('Quase lá!', 'Digite seu nome antes.');
      return;
    }
    setTargetUrl(url);
    setShowBrowser(true);
  };

  const handleVideoSelected = (url: string, type?: 'youtube' | 'direct' | 'embed') => {
    setShowBrowser(false);
    if (!url) return;
    const newRoomId = 'sala-' + Math.floor(Math.random() * 10000);
    enterRoom(newRoomId, url);
  };

  const enterRoom = (roomId: string, videoUrl: string = '') => {
    if (!username.trim()) {
      Alert.alert('Identifique-se', 'Digite seu nome para entrar.');
      return;
    }
    router.push({
      pathname: '/room/[id]',
      params: { 
        id: roomId, 
        username,
        videoUrl: encodeURIComponent(videoUrl) 
      }
    });
  };

  const showComingSoon = (service: string) => {
    Alert.alert("Em Breve 🚧", `O suporte ao ${service} será adicionado nas próximas versões!`);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* ScrollView principal */}
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.header}>
          <Text style={styles.logo}>CineSync 🍿</Text>
          <Text style={styles.subtitle}>O cinema é onde você estiver.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Seu Apelido</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Capitão Pipoca"
            placeholderTextColor="#666"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        {/* --- SEÇÃO DE CRIAR SALA --- */}
        <Text style={styles.sectionTitle}>Criar Sala / Assistir</Text>
        <View style={styles.grid}>
          <TouchableOpacity style={[styles.card, { backgroundColor: '#FF0000' }]} onPress={() => openSource('https://youtube.com')}>
            <Ionicons name="logo-youtube" size={32} color="white" />
            <Text style={styles.cardText}>YouTube</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, { backgroundColor: '#6366F1' }]} onPress={() => openSource('https://google.com')}>
            <Ionicons name="globe-outline" size={32} color="white" />
            <Text style={styles.cardText}>Internet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.disabledCard]} onPress={() => showComingSoon('Netflix')}>
            <Text style={[styles.cardText, { color: '#E50914', fontSize: 20, fontWeight: 'bold' }]}>N</Text>
            <Text style={styles.cardSubText}>Em Breve</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.card, styles.disabledCard]} onPress={() => showComingSoon('Prime Video')}>
            <Ionicons name="logo-amazon" size={32} color="#00A8E1" />
            <Text style={styles.cardSubText}>Em Breve</Text>
          </TouchableOpacity>
        </View>

        {/* --- SEÇÃO DE SALAS ATIVAS --- */}
        <View style={styles.roomsSection}>
          <Text style={styles.sectionTitle}>Salas ao Vivo 🔴</Text>
          
          {activeRooms.length === 0 ? (
            <View style={styles.noRooms}>
              <Text style={styles.noRoomsText}>Nenhuma sala aberta no momento.</Text>
              <Text style={styles.noRoomsSub}>Crie a primeira escolhendo um vídeo acima!</Text>
            </View>
          ) : (
            activeRooms.map((room) => (
              <TouchableOpacity key={room.id} style={styles.roomCard} onPress={() => enterRoom(room.id)}>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{room.id}</Text>
                  <View style={styles.roomBadges}>
                    {room.hasVideo && (
                      <View style={styles.badgeVideo}>
                        <Ionicons name="play-circle" size={12} color="white" />
                        <Text style={styles.badgeText}>Passando Filme</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.userCount}>
                  <Ionicons name="people" size={16} color="#6366F1" />
                  <Text style={styles.countText}>{room.userCount}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#444" />
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

      {/* Modal do Navegador */}
      <Modal visible={showBrowser} animationType="slide" onRequestClose={() => setShowBrowser(false)}>
        <BrowserSelector 
          initialUrl={targetUrl}
          onVideoSelect={handleVideoSelected} 
          onClose={() => setShowBrowser(false)} 
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  content: { padding: 20, paddingBottom: 50 },
  header: { alignItems: 'center', marginBottom: 25, marginTop: 10 },
  logo: { fontSize: 32, fontWeight: 'bold', color: '#6366F1' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 5 },
  
  inputGroup: { marginBottom: 25 },
  label: { color: '#ccc', marginBottom: 8, marginLeft: 4, fontSize: 14 },
  input: { backgroundColor: '#1E1E24', color: 'white', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 30 },
  card: { width: '48%', height: 90, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 5 },
  disabledCard: { backgroundColor: '#1E1E24', borderWidth: 1, borderColor: '#333', opacity: 0.6 },
  cardText: { color: 'white', fontWeight: 'bold', marginTop: 5, fontSize: 14 },
  cardSubText: { color: '#666', fontSize: 10, marginTop: 2 },

  roomsSection: { marginTop: 10 },
  noRooms: { alignItems: 'center', padding: 20, backgroundColor: '#1E1E24', borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444' },
  noRoomsText: { color: '#888', fontSize: 14, fontWeight: 'bold' },
  noRoomsSub: { color: '#555', fontSize: 12, marginTop: 4 },

  roomCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E1E24', padding: 16, borderRadius: 12, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#6366F1' },
  roomInfo: { flex: 1 },
  roomName: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  roomBadges: { flexDirection: 'row', marginTop: 4, gap: 5 },
  badgeVideo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22c55e', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  userCount: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 4, marginRight: 10 },
  countText: { color: '#6366F1', fontWeight: 'bold', fontSize: 12 }
});