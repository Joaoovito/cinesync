import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Clipboard, SafeAreaView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayerSync } from '../../components/video-player-sync';
import { io, Socket } from 'socket.io-client';

// ⚠️ SEU IP
const SOCKET_URL = 'http://192.168.0.5:3000'; 

export default function RoomScreen() {
  const router = useRouter();
  const { id, isHost, videoId } = useLocalSearchParams();
  const isOwner = isHost === 'true';
  const currentVideoId = (videoId as string) || "dQw4w9WgXcQ";

  const [isPlaying, setIsPlaying] = useState(false);
  const [targetTime, setTargetTime] = useState(0); 
  
  // --- CORREÇÃO: Estado para saber se o player já carregou ---
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const pendingActionRef = useRef<{ type: string, value: number } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const currentHostTimeRef = useRef(0);
  const lastHeartbeatRef = useRef(0);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('join_room', id);

    socketRef.current.on('receive_action', (data) => {
      console.log(`📥 Recebido: ${data.type} | Valor: ${data.value}`);

      // SE O PLAYER AINDA NÃO ESTIVER PRONTO, GUARDA NA FILA
      if (!isPlayerReady && data.forceSync) {
        console.log("⏳ Player carregando... Ação guardada para depois.");
        pendingActionRef.current = data;
        return;
      }

      processAction(data);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [id, isPlayerReady]); // Adicionei isPlayerReady nas dependências

  // Função separada para processar ações (usada na chegada e no desbloqueio)
  const processAction = (data: any) => {
    if (data.type === 'play') {
      setIsPlaying(true);
      if (Math.abs(currentHostTimeRef.current - data.value) > 1.5) {
        setTargetTime(data.value);
      }
    }
    
    if (data.type === 'pause') {
      setIsPlaying(false);
      setTargetTime(data.value);
    }

    if (data.type === 'seek' || data.type === 'sync_time') {
      setTargetTime(data.value);
    }
  };

  // --- O PLAYER NOS AVISA QUANDO ESTÁ PRONTO ---
  const handlePlayerReady = () => {
    console.log("✅ Player Pronto! Verificando ações pendentes...");
    setIsPlayerReady(true);
    
    // Se tiver algo guardado (o estado inicial da sala), executa agora
    if (pendingActionRef.current) {
      console.log("🚀 Executando ação pendente:", pendingActionRef.current);
      const action = pendingActionRef.current;
      
      // Força o estado inicial
      setIsPlaying(action.type === 'play');
      setTargetTime(action.value);
      
      pendingActionRef.current = null; // Limpa a fila
    }
  };

  const handleTimeUpdate = (currentTime: number) => {
    currentHostTimeRef.current = currentTime; 

    if (isOwner && isPlaying) {
      const now = Date.now();
      if (now - lastHeartbeatRef.current > 5000) {
        socketRef.current?.emit('send_action', {
          roomId: id,
          type: 'sync_time', 
          value: currentTime
        });
        lastHeartbeatRef.current = now;
      }
    }
  };

  const handlePlayRequest = () => {
    if (isOwner) {
      const newState = !isPlaying;
      setIsPlaying(newState);
      socketRef.current?.emit('send_action', {
        roomId: id,
        type: newState ? 'play' : 'pause',
        value: currentHostTimeRef.current 
      });
      lastHeartbeatRef.current = Date.now();
    } else {
      alert('Apenas o Host controla o vídeo!');
    }
  };

  const handleSeekRequest = (newTime: number) => {
    if (isOwner) {
      currentHostTimeRef.current = newTime;
      socketRef.current?.emit('send_action', {
        roomId: id,
        type: 'seek',
        value: newTime
      });
      lastHeartbeatRef.current = Date.now();
    }
  };

  const copyCode = () => { Clipboard.setString(id as string); alert('Copiado!'); };
  const leaveRoom = () => { socketRef.current?.disconnect(); router.replace('/'); };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={leaveRoom} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.roomTitle}>Sala: {id}</Text>
            <View style={[styles.roleBadge, { backgroundColor: isOwner ? '#4ade80' : '#facc15' }]}>
              <Text style={styles.roleText}>{isOwner ? 'HOST' : 'ESPECTADOR'}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={copyCode} style={styles.copyButton}><Ionicons name="copy-outline" size={20} color="white" /></TouchableOpacity>
        </View>

        <View style={styles.playerWrapper}>
          <VideoPlayerSync 
            videoId={currentVideoId}
            isPlaying={isPlaying} 
            onPlayRequest={handlePlayRequest} 
            isOwner={isOwner}
            onTimeUpdate={handleTimeUpdate} 
            onSeekRequest={handleSeekRequest}
            remoteTime={targetTime}
            // Passamos a função para o componente nos avisar
            onReady={handlePlayerReady} 
          />
        </View>

        <View style={styles.contentArea}>
           <Text style={styles.statusText}>{socketRef.current?.connected ? '🟢 Conectado' : '🔴 ...'}</Text>
           <Text style={styles.placeholderText}>
             {isOwner ? "Host (Controle Total)" : "Sincronizando..."}
           </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f12' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#222', marginTop: 30 },
  backButton: { padding: 8 },
  headerInfo: { alignItems: 'center' },
  roomTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  roleText: { fontSize: 10, fontWeight: 'bold', color: 'black' },
  copyButton: { padding: 8, backgroundColor: '#333', borderRadius: 8 },
  playerWrapper: { width: '100%', aspectRatio: 16/9, backgroundColor: 'black', marginTop: 10 },
  contentArea: { flex: 1, padding: 20, alignItems: 'center' },
  statusText: { color: '#4ade80', fontSize: 12, marginBottom: 10 },
  placeholderText: { color: '#888', fontSize: 14 }
});