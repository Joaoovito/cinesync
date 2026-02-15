import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, ActivityIndicator, Pressable, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface VideoPlayerSyncProps {
  videoId: string;
  isPlaying: boolean;       
  onPlayRequest: () => void;
  isOwner: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onSeekRequest?: (time: number) => void;
  onSyncRequest?: () => void; // Gatilho de sync
  onReady?: () => void;
  remoteTime?: number;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export function VideoPlayerSync({ 
  videoId, 
  isPlaying, 
  onPlayRequest,
  isOwner,
  onTimeUpdate,
  onSeekRequest,
  onSyncRequest, 
  onReady,
  remoteTime = 0
}: VideoPlayerSyncProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [interactMode, setInteractMode] = useState(false);
  
  const isYouTube = videoId && videoId.length === 11 && !videoId.includes('/') && !videoId.includes('.');

  const filePlayerHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>body { margin: 0; background-color: black; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; } video, iframe { width: 100%; height: 100%; border: 0; object-fit: contain; }</style>
      </head>
      <body>
        ${videoId.includes('.mp4') || videoId.includes('.m3u8') ? 
          `<video id="player" src="${videoId}" playsinline webkit-playsinline autoplay controlsList="nodownload"></video>` : 
          `<iframe id="player" src="${videoId}" allowfullscreen allow="autoplay; encrypted-media"></iframe>`
        }
        <script>
          var player = document.getElementById('player');
          var isVideo = player.tagName === 'VIDEO';
          if(isVideo) {
            player.addEventListener('loadedmetadata', function() { window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready', duration: player.duration})); });
            setInterval(function(){ window.ReactNativeWebView.postMessage(JSON.stringify({type: 'status', currentTime: player.currentTime, duration: player.duration || 0, paused: player.paused})); }, 500);
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready', duration: 0}));
          }
          window.control = {
            play: function() { if(isVideo) player.play(); },
            pause: function() { if(isVideo) player.pause(); },
            seek: function(time) { if(isVideo && isFinite(player.duration)) player.currentTime = time; }
          };
        </script>
      </body>
    </html>
  `;

  const youtubePlayerHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>html, body { height: 100%; width: 100%; margin: 0; padding: 0; background-color: black; overflow: hidden; } #player { width: 100% !important; height: 100% !important; }</style>
      </head>
      <body>
        <div id="player"></div>
        <script>
          var tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
          var firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
          var player;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              height: '100%', width: '100%', videoId: '${videoId}',
              playerVars: { 'playsinline': 1, 'controls': 0, 'rel': 0, 'fs': 0, 'autoplay': 1, 'modestbranding': 1 },
              events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
            });
          }
          function onPlayerReady(event) { window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready'})); event.target.playVideo(); }
          function onPlayerStateChange(event) { 
             var st = event.data;
             var playing = st === 1;
             window.ReactNativeWebView.postMessage(JSON.stringify({type: 'status', currentTime: player.getCurrentTime(), duration: player.getDuration(), paused: !playing})); 
          }
          setInterval(function(){ if(player && player.getCurrentTime) window.ReactNativeWebView.postMessage(JSON.stringify({type: 'status', currentTime: player.getCurrentTime(), duration: player.getDuration()})); }, 500);
          window.control = { play: function() { player.playVideo(); }, pause: function() { player.pauseVideo(); }, seek: function(time) { player.seekTo(time, true); } };
        </script>
      </body>
    </html>
  `;

  const inject = (script: string) => webViewRef.current?.injectJavaScript(script);

  useEffect(() => {
    if (interactMode || isOwner) return; // Dono nunca é sincronizado externamente

    if (isPlaying) {
      inject(`if(window.control) window.control.play(); true;`);
    } else {
      // Pause alinhado: se o host pausou, eu pulo exatamente para onde ele parou
      inject(`if(window.control) { window.control.seek(${remoteTime}); window.control.pause(); } true;`);
    }
    
    // 🔥 SINCRONIA INTELIGENTE COM TOLERÂNCIA
    // Só faz o "seek" se o espectador estiver mais de 3 segundos atrasado ou adiantado.
    // Isso evita pulos constantes devido ao lag da rede.
    if (remoteTime > 0) {
       const timeDiff = Math.abs(currentTime - remoteTime);
       
       if (timeDiff > 3) {
         console.log("🔄 Sincronizando: Diferença de", timeDiff, "segundos detectada.");
         inject(`if(window.control) { window.control.seek(${remoteTime}); } true;`);
       }
    }

  }, [isPlaying, interactMode, isOwner, remoteTime, currentTime]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') { if (onReady) onReady(); }
      if (data.type === 'status') {
        setCurrentTime(data.currentTime);
        setDuration(data.duration);
        if (data.paused !== undefined) setLocalIsPlaying(!data.paused);
        if (!hasStarted && data.currentTime > 0) setHasStarted(true);
        if (isOwner && onTimeUpdate) onTimeUpdate(data.currentTime);
      }
    } catch (e) {}
  };

  const handleSeek = (evt: any) => {
    if (!isOwner || duration === 0) return;
    const width = evt.nativeEvent.locationX;
    const seekTime = duration * (width / (Dimensions.get('window').width - 32));
    inject(`if(window.control) window.control.seek(${seekTime}); true;`);
    setCurrentTime(seekTime);
    if (onSeekRequest) onSeekRequest(seekTime);
  };

  const handleTogglePlay = () => {
    if (isOwner) {
      onPlayRequest();
    } else {
      if (localIsPlaying) {
        // Pausa Local
        inject(`if(window.control) window.control.pause(); true;`);
        setLocalIsPlaying(false);
      } else {
        // Play Local (Sync primeiro)
        if (!isPlaying) {
          Alert.alert("Aguarde", "O Host pausou o vídeo.");
          return;
        }

        // 🔥 CHAMA O SERVIDOR: "Qual o tempo real agora?"
        if (onSyncRequest) onSyncRequest();
        
        inject(`if(window.control) window.control.play(); true;`);
        setLocalIsPlaying(true);
      }
    }
  };

  const exitInteractMode = () => {
    setInteractMode(false);
    setShowControls(true);
    // Sync ao sair do modo interativo
    if (!isOwner && onSyncRequest) onSyncRequest();
  };

  return (
    <View style={styles.container}>
      <View style={styles.videoWrapper}>
        <WebView
          key={videoId} 
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: isYouTube ? youtubePlayerHTML : filePlayerHTML, baseUrl: "https://google.com" }} 
          onMessage={handleMessage}
          javaScriptEnabled={true} 
          domStorageEnabled={true} 
          allowsInlineMediaPlayback={true} 
          mediaPlaybackRequiresUserAction={false}
          userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36"
          style={{ backgroundColor: 'black' }}
        />
      </View>
      
      {interactMode ? (
        <View style={[styles.interactOverlayContainer, { pointerEvents: 'box-none' } as any]}>
          <TouchableOpacity style={styles.exitInteractBtn} onPress={exitInteractMode}>
            <Ionicons name="checkmark-circle" size={24} color="black" />
            <Text style={styles.interactText}>Voltar e Sincronizar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        hasStarted && (
          <Pressable style={styles.overlayContainer} onPress={() => setShowControls(!showControls)}>
            {showControls && (
              <View style={styles.controlsUI}>
                
                <View style={styles.topBar}>
                   <TouchableOpacity style={styles.interactButton} onPress={() => { setInteractMode(true); setShowControls(false); }}>
                      <Ionicons name="finger-print" size={20} color="white" />
                      <Text style={styles.btnText}>Pular Anúncio / Mexer</Text>
                   </TouchableOpacity>
                </View>

                <View style={styles.centerControls}>
                  <TouchableOpacity 
                    onPress={handleTogglePlay} 
                    style={[styles.playButton, (!isOwner && !localIsPlaying && !isPlaying) && styles.disabledButton]}
                  >
                    <Ionicons 
                      name={(isOwner ? isPlaying : localIsPlaying) ? "pause" : "play"} 
                      size={40} 
                      color="white" 
                      style={{marginLeft: (isOwner ? isPlaying : localIsPlaying) ? 0 : 4}}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.bottomBar}>
                  <Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
                  <Pressable onPress={isOwner ? handleSeek : undefined} style={styles.progressBarArea}>
                    <View style={styles.progressBarBg}>
                      <View style={[styles.progressBarFill, { width: `${(currentTime / (duration || 1)) * 100}%` }]} />
                    </View>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        )
      )}
    </View>
  );
}
// Estilos iguais...
const styles = StyleSheet.create({
  container: { width: '100%', height: 240, backgroundColor: 'black', borderRadius: 12, overflow: 'hidden' },
  videoWrapper: { flex: 1, backgroundColor: 'black' },
  overlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  controlsUI: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  topBar: { alignItems: 'flex-end' },
  interactButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.2)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 5 },
  btnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(99, 102, 241, 0.9)', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  disabledButton: { opacity: 0.5, backgroundColor: 'rgba(50, 50, 50, 0.9)' },
  bottomBar: { width: '100%', paddingBottom: 4 },
  timeText: { color: 'white', fontSize: 12, fontWeight: 'bold', marginBottom: 8 },
  progressBarArea: { height: 20, justifyContent: 'center' },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, width: '100%' },
  progressBarFill: { height: '100%', backgroundColor: '#6366F1' },
  interactOverlayContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20, zIndex: 20 },
  exitInteractBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22C55E', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30, gap: 8, elevation: 5 },
  interactText: { color: 'black', fontWeight: 'bold', fontSize: 14 }
});