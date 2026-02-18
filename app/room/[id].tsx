import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayerSync } from '../../components/video-player-sync';
import { BrowserSelector } from '../../components/browser-selector';

const SOCKET_URL = 'http://192.168.0.5:3000'; 

export default function RoomScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentVideo, setCurrentVideo] = useState(decodeURIComponent(params.videoUrl as string || ''));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [remoteTime, setRemoteTime] = useState(0);
  const [showBrowser, setShowBrowser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const currentTimeRef = useRef(0);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      query: { displayName: username || 'Visitante' },
      transports: ['websocket']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { roomId, videoUrl: currentVideo });
    });

    newSocket.on('room_data', (data: any) => {
      if (data.videoUrl) setCurrentVideo(data.videoUrl);
      setIsPlaying(data.isPlaying);
      setRemoteTime(data.currentTime);
      // 🔥 Inicializa a referência para evitar o reset para 0:00
      currentTimeRef.current = data.currentTime; 
      const me = data.users?.find((u: any) => u.id === newSocket.id);
      setIsOwner(me?.isOwner || false);
      setIsLoading(false);
    });

    newSocket.on('sync_video_state', (state: any) => {
      if (!isOwner) {
        setIsPlaying(state.isPlaying);
        setRemoteTime(state.currentTime);
      }
    });

    return () => { newSocket.disconnect(); };
  }, [roomId, isOwner]);

  const handlePlayRequest = () => {
    if (isOwner && socket) {
      const newState = !isPlaying;
      setIsPlaying(newState);
      socket.emit('video_control', { 
        roomId, 
        action: newState ? 'play' : 'pause', 
        currentTime: currentTimeRef.current 
      });
    }
  };

  const handleSeekRequest = (time: number) => {
    if (isOwner && socket) {
      socket.emit('video_control', { roomId, action: 'seek', currentTime: time });
    }
  };

  const handleIndividualSync = () => {
    if (socket && socket.connected) {
      socket.emit('request_individual_sync', { roomId });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text style={styles.title}>Sala {roomId}</Text>
        <TouchableOpacity onPress={() => setShowBrowser(true)}><Ionicons name="search" size={24} color="#6366F1" /></TouchableOpacity>
      </View>
      <View style={styles.videoContainer}>
        {isLoading ? <ActivityIndicator size="large" color="#6366F1" /> : (
          <VideoPlayerSync 
            videoId={currentVideo}
            isPlaying={isPlaying}
            isOwner={isOwner}
            onPlayRequest={handlePlayRequest}
            onSeekRequest={handleSeekRequest}
            onSyncRequest={handleIndividualSync}
            onTimeUpdate={(t) => currentTimeRef.current = t}
            remoteTime={remoteTime}
          />
        )}
      </View>
      <Modal visible={showBrowser} animationType="slide">
        <BrowserSelector onVideoSelect={(url) => {setCurrentVideo(url); setShowBrowser(false)}} onClose={() => setShowBrowser(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  title: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  videoContainer: { height: 240, backgroundColor: 'black', justifyContent: 'center' }
});