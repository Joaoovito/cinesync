import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

// Defina as props que o componente DEVE receber
interface VideoPlayerSyncProps {
  videoId: string;
  socket: any; // Tipagem do socket
  roomId: string;
}

export function VideoPlayerSync({ videoId, socket, roomId }: VideoPlayerSyncProps) {
  const playerRef = useRef<YoutubeIframeRef>(null);
  
  // Estados Locais
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true); // Começa carregando
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 1. Monitorar se o videoId chegou corretamente
  useEffect(() => {
    if (!videoId) {
      setError("Aguardando ID do vídeo...");
      setLoading(true);
    } else {
      setError(null);
      console.log(`[Player] Carregando vídeo: ${videoId}`);
    }
  }, [videoId]);

  // 2. Callback crítico: O vídeo carregou?
  const onReady = useCallback(() => {
    console.log("[Player] O vídeo está pronto (onReady).");
    setLoading(false); // <--- ISSO TIRA O SPINNER
    
    // Pega a duração total do vídeo
    playerRef.current?.getDuration().then(d => setDuration(d));
  }, []);

  // 3. Callback de Erro (Debug)
  const onError = useCallback((err: string) => {
    console.error("[Player] Erro no YouTube:", err);
    setError(`Erro ao carregar: ${err}`);
    setLoading(false);
  }, []);

  // 4. Loop de Progresso (Barra de Tempo)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (playing && playerRef.current) {
        const time = await playerRef.current.getCurrentTime();
        setCurrentTime(time);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [playing]);

  // 5. Escutar o Servidor (Socket)
  useEffect(() => {
    if (!socket) return;

    socket.on('sync_action', (data: any) => {
      console.log("[Socket] Recebido:", data);
      
      if (data.action === 'play') {
        setPlaying(true);
        // Sync fino se a diferença for grande (>2s)
        playerRef.current?.getCurrentTime().then(current => {
           if (Math.abs(current - data.time) > 2) {
             playerRef.current?.seekTo(data.time, true);
           }
        });
      }
      
      if (data.action === 'pause') {
        setPlaying(false);
        playerRef.current?.seekTo(data.time, true);
      }

      if (data.action === 'seek') {
        playerRef.current?.seekTo(data.time, true);
      }
    });

    return () => {
      socket.off('sync_action');
    };
  }, [socket]);

  // Ações do Usuário (Enviam para o servidor)
  const handlePlayPause = () => {
    const action = playing ? 'pause' : 'play';
    // Emita para o servidor (NÃO mude o state local ainda)
    socket.emit('sync_action', { roomId, action, time: currentTime });
  };

  const handleSeek = (value: number) => {
    socket.emit('sync_action', { roomId, action: 'seek', time: value });
    setCurrentTime(value);
  };

  if (error) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camada 0: O Player (Invisível mas funcional) */}
      <View pointerEvents="none" style={styles.videoLayer}>
        <YoutubePlayer
          ref={playerRef}
          height={300}
          play={playing}
          videoId={videoId}
          onChangeState={(state: string) => {
             if (state === 'ended') setPlaying(false);
          }}
          onReady={onReady} // <--- CRÍTICO
          onError={onError} // <--- CRÍTICO
          initialPlayerParams={{
            controls: false, // Esconde controles nativos
            modestbranding: true,
            rel: false
          }}
          webViewProps={{
            androidLayerType: 'hardware', // Ou 'software' se der crash
            style: { opacity: 0.99 } // <--- FIX PARA CRASH NO ANDROID
          }}
        />
      </View>

      {/* Camada 1: Overlay de Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={{color: 'white', marginTop: 10}}>Carregando Player...</Text>
        </View>
      )}

      {/* Camada 2: Controles Personalizados (Só mostra se não estiver carregando) */}
      {!loading && (
        <View style={styles.controlsLayer}>
          
          {/* Botão Play/Pause Central */}
          <View style={styles.centerControls}>
            <Ionicons 
              name={playing ? "pause-circle" : "play-circle"} 
              size={70} 
              color="white" 
              onPress={handlePlayPause}
            />
          </View>

          {/* Barra Inferior */}
          <View style={styles.bottomControls}>
            <Text style={styles.timeText}>{Math.floor(currentTime)}s</Text>
            <Slider
              style={{flex: 1, height: 40}}
              minimumValue={0}
              maximumValue={duration}
              value={currentTime}
              onSlidingComplete={handleSeek}
              minimumTrackTintColor="#6366F1"
              maximumTrackTintColor="#FFFFFF"
              thumbTintColor="#6366F1"
            />
            <Text style={styles.timeText}>{Math.floor(duration)}s</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    backgroundColor: 'black',
    overflow: 'hidden',
    position: 'relative',
  },
  videoLayer: {
    opacity: 1, // Vídeo visível ao fundo
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  controlsLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)', // Leve escurecida para ver os botões
  },
  centerControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeText: {
    color: 'white',
    width: 40,
    textAlign: 'center',
  }
});
