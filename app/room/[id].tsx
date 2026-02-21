import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar'; // 🔥 Corrige a barra do Android
import { VideoPlayerSync } from '../../components/video-player-sync';
import { BrowserSelector } from '../../components/browser-selector';

const SOCKET_URL = 'http://192.168.0.5:3000'; 

export default function RoomScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  const roomPassword = params.password || ''; 
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentVideo, setCurrentVideo] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [remoteTime, setRemoteTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Estados dos Modais
  const [showAddMenu, setShowAddMenu] = useState(false); // 🔥 Novo menu
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserStartUrl, setBrowserStartUrl] = useState('https://google.com');

  // Estados da Sala
  const [queue, setQueue] = useState<any[]>([]);
  const [mode, setMode] = useState(1);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'queue' | 'users' | 'settings'>('queue');
  const [mySocketId, setMySocketId] = useState<string>('');
  const currentTimeRef = useRef(0);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      query: { displayName: username }
    });
    setSocket(newSocket);
    newSocket.on('connect', () => {
      setMySocketId(newSocket.id || '');
    });
    newSocket.emit('join_room', { roomId, videoUrl: decodeURIComponent(params.videoUrl as string || ''), password: roomPassword });

    newSocket.on('room_data', (data) => {
      setIsLoading(false);
      setCurrentVideo(data.currentVideo);
      setIsPlaying(data.isPlaying);
      setMode(data.mode);
      setUsers(data.users);
      const me = data.users.find((u: any) => u.id === newSocket.id);
      if (me) setIsOwner(me.isOwner);
    });

    newSocket.on('queue_updated', setQueue);
    newSocket.on('sync_video_state', (state) => { setIsPlaying(state.isPlaying); setRemoteTime(state.currentTime); });
    newSocket.on('access_denied', (data) => { Alert.alert("Acesso Negado", data.message); router.replace('/'); });
    newSocket.on('you_were_kicked', () => { Alert.alert("Expulso", "Você foi removido pelo Host."); router.replace('/'); });

    return () => { newSocket.disconnect(); };
  }, [roomId]);

  // 🔥 CORREÇÃO 1: O Host agora consegue pausar
  const handlePlayRequest = () => {
    const nextState = !isPlaying; // Alterna entre tocar e pausar
    setIsPlaying(nextState);
    socket?.emit('video_control', { roomId, action: nextState ? 'play' : 'pause', currentTime: currentTimeRef.current });
  };

  const handleSeekRequest = (time: number) => socket?.emit('video_control', { roomId, action: 'seek', currentTime: time });
  const handleIndividualSync = () => socket?.emit('request_individual_sync', { roomId });
  const handleAddVideo = (url: string) => { socket?.emit('add_to_queue', { roomId, url }); setShowBrowser(false); };

  const openBrowserWith = (url: string) => {
    setBrowserStartUrl(url);
    setShowAddMenu(false);
    setShowBrowser(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 🔥 Oculta a barra de status do Android para não sobrepor os botões */}
      <StatusBar hidden /> 

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>Sala {roomId}</Text>
        
        {(isOwner || mode !== 1) && (
          <TouchableOpacity onPress={() => setShowAddMenu(true)} style={{ padding: 4 }}>
            <Ionicons name="add-circle" size={32} color="#6366F1" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.videoContainer}>
        {isLoading ? <ActivityIndicator size="large" color="#6366F1" /> : (
          currentVideo ? (
            <VideoPlayerSync videoId={currentVideo} isPlaying={isPlaying} isOwner={isOwner} onPlayRequest={handlePlayRequest} onSeekRequest={handleSeekRequest} onSyncRequest={handleIndividualSync} onTimeUpdate={(t) => currentTimeRef.current = t} remoteTime={remoteTime} onVideoEnd={() => {
    if (isOwner) socket?.emit('play_next', { roomId });
  }} />
          ) : (
            <View style={styles.emptyVideo}>
              <Text style={styles.emptyText}>Nenhum vídeo a tocar.</Text>
              {isOwner && queue.length > 0 && (
                <TouchableOpacity style={styles.playNextBtn} onPress={() => socket?.emit('play_next', { roomId })}>
                  <Text style={styles.playNextText}>Tocar Próximo da Fila</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, activeTab === 'queue' && styles.activeTab]} onPress={() => setActiveTab('queue')}>
          <Text style={[styles.tabText, activeTab === 'queue' && styles.activeTabText]}>Fila ({queue.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'users' && styles.activeTab]} onPress={() => setActiveTab('users')}>
          <Text style={[styles.tabText, activeTab === 'users' && styles.activeTabText]}>Usuários ({users.length})</Text>
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity style={[styles.tab, activeTab === 'settings' && styles.activeTab]} onPress={() => setActiveTab('settings')}>
            <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>Ajustes</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.contentArea}>
        {activeTab === 'queue' && (
          <View style={{ flex: 1 }}>
            {queue.length === 0 ? <Text style={styles.emptyMsg}>A fila está vazia.</Text> : queue.map((vid) => (
              <View key={vid.id} style={styles.queueItem}>
                <View style={styles.queueInfo}>
                  <Text style={styles.queueUrl} numberOfLines={1}>{vid.url}</Text>
                  <Text style={styles.queueAddedBy}>Por: {vid.addedBy}</Text>
                </View>
                <View style={styles.queueActions}>
                  {mode === 3 && (
                    <TouchableOpacity style={styles.voteBtn} onPress={() => socket?.emit('vote_video', { roomId, videoId: vid.id })}>
                      <Ionicons name="chevron-up" size={24} color={vid.votes.includes(mySocketId) ? "#6366F1" : "white"} />
                      <Text style={styles.voteCount}>{vid.votes.length}</Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && mode !== 3 && (
                    <TouchableOpacity onPress={() => socket?.emit('play_next', { roomId, forceVideoId: vid.id })} style={styles.forcePlayBtn}>
                      <Ionicons name="play" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'users' && (
          <View style={{ flex: 1 }}>
            {users.map(u => (
              <View key={u.id} style={styles.userItem}>
                <Text style={styles.userName}>{u.displayName} {u.isOwner ? '(Host)' : ''}</Text>
                {isOwner && u.id !== socket?.id && (
                  <TouchableOpacity onPress={() => socket?.emit('kick_user', { roomId, targetId: u.id })} style={styles.kickBtn}><Text style={styles.kickText}>Expulsar</Text></TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'settings' && isOwner && (
          <View style={styles.settingsArea}>
            <Text style={styles.settingsTitle}>Modo da Sala</Text>
            <TouchableOpacity style={[styles.modeBtn, mode === 1 && styles.modeActive]} onPress={() => socket?.emit('change_mode', { roomId, mode: 1 })}><Text style={styles.modeBtnText}>1. Ditador (Só o Host)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modeBtn, mode === 2 && styles.modeActive]} onPress={() => socket?.emit('change_mode', { roomId, mode: 2 })}><Text style={styles.modeBtnText}>2. Sugestões (Host escolhe)</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.modeBtn, mode === 3 && styles.modeActive]} onPress={() => socket?.emit('change_mode', { roomId, mode: 3 })}><Text style={styles.modeBtnText}>3. Democracia (Votação)</Text></TouchableOpacity>
          </View>
        )}
      </View>

      {/* 🔥 NOVO MENU DE ADIÇÃO DE VÍDEOS */}
      <Modal visible={showAddMenu} transparent animationType="fade">
        <View style={styles.menuOverlay}>
          <View style={styles.menuBox}>
            <Text style={styles.menuTitle}>Fonte do Vídeo</Text>
            <TouchableOpacity style={styles.menuOption} onPress={() => openBrowserWith('https://m.youtube.com')}>
              <Ionicons name="logo-youtube" size={24} color="#FF0000" />
              <Text style={styles.menuOptionText}>YouTube</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} onPress={() => openBrowserWith('https://google.com')}>
              <Ionicons name="globe-outline" size={24} color="#6366F1" />
              <Text style={styles.menuOptionText}>Navegador Web</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCancel} onPress={() => setShowAddMenu(false)}>
              <Text style={styles.menuCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBrowser} animationType="slide">
        <BrowserSelector initialUrl={browserStartUrl} onVideoSelect={handleAddVideo} onClose={() => setShowBrowser(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, paddingHorizontal: 20 },
  title: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  videoContainer: { width: '100%', height: 240, backgroundColor: '#000', justifyContent: 'center' },
  emptyVideo: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  emptyText: { color: '#888', marginBottom: 15 },
  playNextBtn: { backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  playNextText: { color: '#fff', fontWeight: 'bold' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', backgroundColor: '#1a1a1a' },
  tab: { flex: 1, padding: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  tabText: { color: '#888', fontWeight: 'bold' },
  activeTabText: { color: 'white' },
  contentArea: { flex: 1, padding: 15 },
  emptyMsg: { color: '#888', textAlign: 'center', marginTop: 20 },
  queueItem: { flexDirection: 'row', backgroundColor: '#1E1E24', padding: 12, borderRadius: 8, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  queueInfo: { flex: 1, marginRight: 10 },
  queueUrl: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  queueAddedBy: { color: '#888', fontSize: 12, marginTop: 4 },
  queueActions: { flexDirection: 'row', alignItems: 'center' },
  voteBtn: { alignItems: 'center', paddingHorizontal: 10 },
  voteCount: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  forcePlayBtn: { backgroundColor: '#6366F1', padding: 10, borderRadius: 20, marginLeft: 10 },
  userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E24', padding: 15, borderRadius: 8, marginBottom: 10 },
  userName: { color: 'white', fontWeight: 'bold' },
  kickBtn: { backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  kickText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  settingsArea: { flex: 1 },
  settingsTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  modeBtn: { backgroundColor: '#1E1E24', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  modeActive: { borderColor: '#6366F1', backgroundColor: '#2a2b38' },
  modeBtnText: { color: 'white', fontWeight: 'bold' },
  
  // Estilos do Novo Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  menuBox: { width: '80%', backgroundColor: '#1E1E24', borderRadius: 12, padding: 20 },
  menuTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  menuOption: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
  menuOptionText: { color: 'white', fontSize: 16, marginLeft: 15 },
  menuCancel: { marginTop: 20, padding: 15, alignItems: 'center' },
  menuCancelText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 }
});