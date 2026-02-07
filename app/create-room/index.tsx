import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Image, Alert, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { BrowserSelector } from '../../components/browser-selector';

// ⚠️ COLOQUE SEU IP CORRETO AQUI
const SOCKET_URL = 'http://192.168.0.5:3000';

export default function HomeScreen() {
  const router = useRouter();
  
  // Estados da Tela
  const [rooms, setRooms] = useState<any[]>([]);
  const [showSourceModal, setShowSourceModal] = useState(false); // Modal de escolha (YouTube, Web, etc)
  const [showBrowser, setShowBrowser] = useState(false);         // Modal do Navegador
  const [browserUrl, setBrowserUrl] = useState('https://google.com');
  
  const socketRef = useRef<Socket | null>(null);

  // --- 1. CONEXÃO COM O SERVIDOR (Para pegar a lista) ---
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    
    socketRef.current.on('rooms_update', (data) => {
      console.log("Lista de salas atualizada:", data);
      setRooms(data);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const generateRoomId = () => 'sala-' + Math.floor(1000 + Math.random() * 9000);

  // --- 2. AÇÕES DE NAVEGAÇÃO ---

  // Passo A: Abre o menu e escolhe a fonte
  const openBrowser = (url: string) => {
    setShowSourceModal(false); // Fecha menu de fontes
    setBrowserUrl(url);        // Define URL inicial
    setShowBrowser(true);      // Abre navegador
  };

  // Passo B: O Navegador retornou um vídeo! Criar a sala.
  const handleVideoSelect = (videoId: string) => {
    setShowBrowser(false);
    const newRoomId = generateRoomId();
    
    // Navega para a sala como DONO (Host) e com o vídeo escolhido
    router.push({
      pathname: '/room/[id]',
      params: { id: newRoomId, isHost: 'true', videoId: videoId }
    });
  };

  // Passo C: Entrar em uma sala existente da lista
  const joinRoom = (roomId: string) => {
    router.push({
      pathname: '/room/[id]',
      params: { id: roomId, isHost: 'false' }
    });
  };

  // --- 3. RENDERIZAÇÃO ---

  const renderRoomItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.roomCard} onPress={() => joinRoom(item.id)}>
      <View style={styles.roomThumbnail}>
        <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.8)" />
        {item.isPlaying && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
      <View style={styles.roomInfo}>
        <Text style={styles.roomTitle}>{item.id}</Text>
        <Text style={styles.roomViewers}>
          <Ionicons name="people" size={14} color="#888" /> {item.viewers} assistindo
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#444" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={{flex: 1}}>
        
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Salas Ativas</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.dot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>

        {/* LISTA DE SALAS */}
        {rooms.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="movie-roll" size={80} color="#333" />
            <Text style={styles.emptyText}>Nenhuma sala ativa no momento.</Text>
            <Text style={styles.emptySubText}>Toque em "+" para criar a primeira!</Text>
          </View>
        ) : (
          <FlatList
            data={rooms}
            keyExtractor={(item) => item.id}
            renderItem={renderRoomItem}
            contentContainerStyle={{ padding: 20 }}
          />
        )}

        {/* BOTÃO FLUTUANTE (FAB) PARA CRIAR */}
        <TouchableOpacity style={styles.fab} onPress={() => setShowSourceModal(true)}>
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>

      </SafeAreaView>

      {/* MODAL 1: ESCOLHER FONTE (YouTube, Web, etc) */}
      <Modal visible={showSourceModal} transparent animationType="fade" onRequestClose={() => setShowSourceModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowSourceModal(false)} activeOpacity={1}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>O que vamos assistir?</Text>
            
            <View style={styles.grid}>
              {/* YOUTUBE */}
              <TouchableOpacity style={styles.sourceItem} onPress={() => openBrowser('https://m.youtube.com')}>
                <View style={[styles.iconCircle, {backgroundColor: '#FF0000'}]}>
                   <Ionicons name="logo-youtube" size={32} color="white" />
                </View>
                <Text style={styles.sourceText}>YouTube</Text>
              </TouchableOpacity>

              {/* WEB / GOOGLE */}
              <TouchableOpacity style={styles.sourceItem} onPress={() => openBrowser('https://google.com')}>
                <View style={[styles.iconCircle, {backgroundColor: '#3b82f6'}]}>
                   <Ionicons name="globe" size={32} color="white" />
                </View>
                <Text style={styles.sourceText}>Navegador</Text>
              </TouchableOpacity>
              
              {/* VIMEO (Exemplo Extra) */}
              <TouchableOpacity style={styles.sourceItem} onPress={() => openBrowser('https://vimeo.com')}>
                <View style={[styles.iconCircle, {backgroundColor: '#1ab7ea'}]}>
                   <Text style={{color:'white', fontWeight:'bold'}}>V</Text>
                </View>
                <Text style={styles.sourceText}>Vimeo</Text>
              </TouchableOpacity>

              {/* CANCELAR */}
              <TouchableOpacity style={styles.sourceItem} onPress={() => setShowSourceModal(false)}>
                <View style={[styles.iconCircle, {backgroundColor: '#333'}]}>
                   <Ionicons name="close" size={32} color="white" />
                </View>
                <Text style={styles.sourceText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL 2: O NAVEGADOR EM SI */}
      <Modal visible={showBrowser} animationType="slide" onRequestClose={() => setShowBrowser(false)}>
        <BrowserSelector 
          initialUrl={browserUrl}
          onVideoSelect={handleVideoSelect} 
          onClose={() => setShowBrowser(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 10, backgroundColor: '#09090b', borderBottomWidth: 1, borderBottomColor: '#1f1f22' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f1f22', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: 6 },
  onlineText: { color: '#ddd', fontSize: 12 },

  // Lista Vazia
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  emptyText: { color: 'white', fontSize: 18, marginTop: 20, fontWeight: 'bold' },
  emptySubText: { color: '#888', marginTop: 5 },

  // Card da Sala
  roomCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  roomThumbnail: { width: 80, height: 60, backgroundColor: '#27272a', borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 15, overflow: 'hidden' },
  liveBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#ef4444', paddingHorizontal: 4, borderRadius: 2 },
  liveText: { color: 'white', fontSize: 8, fontWeight: 'bold' },
  roomInfo: { flex: 1 },
  roomTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  roomViewers: { color: '#888', fontSize: 12 },

  // Botão FAB
  fab: { position: 'absolute', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#6366F1', shadowOpacity: 0.5 },

  // Modal de Fontes
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#18181b', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25 },
  modalTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  sourceItem: { width: '45%', alignItems: 'center', marginBottom: 20, backgroundColor: '#27272a', padding: 15, borderRadius: 12 },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  sourceText: { color: '#ddd', fontWeight: '600' }
});