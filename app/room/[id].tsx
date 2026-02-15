import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import { Ionicons } from '@expo/vector-icons';
import { VideoPlayerSync } from '../../components/video-player-sync';
import { BrowserSelector } from '../../components/browser-selector';

const SOCKET_URL = 'http://192.168.0.5:3000'; 

interface User { id: string; displayName: string; isOwner: boolean; }
interface Message { id: string; sender: string; text: string; system?: boolean; }

export default function RoomScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;
  const username = Array.isArray(params.username) ? params.username[0] : params.username;
  
  let initialVideoUrl = '';
  if (params.videoUrl) {
    const rawUrl = Array.isArray(params.videoUrl) ? params.videoUrl[0] : params.videoUrl;
    try { initialVideoUrl = decodeURIComponent(rawUrl); } catch (e) { initialVideoUrl = rawUrl; }
  }

  const [socket, setSocket] = useState<Socket | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [currentVideo, setCurrentVideo] = useState(initialVideoUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [remoteTime, setRemoteTime] = useState(0);
  const [showBrowser, setShowBrowser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const currentTimeRef = useRef(0);
  const videoUrlRef = useRef(initialVideoUrl);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      query: { displayName: username || 'Visitante' },
      transports: ['websocket']
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', { roomId: roomId, videoUrl: videoUrlRef.current });
    });

    newSocket.on('room_data', (data: any) => {
      setUsers(data.users || []);
      if (data.videoUrl) {
        setCurrentVideo(data.videoUrl);
        videoUrlRef.current = data.videoUrl;
      }
      setIsPlaying(data.isPlaying);
      setRemoteTime(data.currentTime);
      const me = data.users?.find((u: User) => u.id === newSocket.id);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
        <Text style={styles.title}>Sala {roomId}</Text>
        <TouchableOpacity onPress={() => setShowBrowser(true)}><Ionicons name="search" size={24} color="#6366F1" /></TouchableOpacity>
      </View>
      <View style={styles.videoContainer}>
        {isLoading ? <ActivityIndicator size="large" /> : (
          <VideoPlayerSync 
            videoId={currentVideo}
            isPlaying={isPlaying}
            isOwner={isOwner}
            onPlayRequest={handlePlayRequest}
            onTimeUpdate={(t) => currentTimeRef.current = t}
            remoteTime={remoteTime}
          />
        )}
      </View>
      <FlatList 
        data={messages} 
        renderItem={({item}) => <Text style={{color: 'white'}}>{item.text}</Text>}
      />
      <Modal visible={showBrowser}><BrowserSelector onVideoSelect={(url) => {setCurrentVideo(url); setShowBrowser(false)}} onClose={() => setShowBrowser(false)} /></Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  title: { color: 'white', fontWeight: 'bold' },
  videoContainer: { height: 240, backgroundColor: 'black', justifyContent: 'center' }
});