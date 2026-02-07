import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, ActivityIndicator, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

interface VideoPlayerSyncProps {
  videoId: string;
  isPlaying: boolean;       
  onPlayRequest: () => void;
  isOwner: boolean;
  
  // ✅ Props opcionais para a Sincronia Avançada
  onTimeUpdate?: (currentTime: number) => void;
  onSeekRequest?: (time: number) => void; // <--- O que estava faltando
  onReady?: () => void;                   // <--- O que adicionamos por último
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
  onReady,
  remoteTime = 0
}: VideoPlayerSyncProps) {
  const webViewRef = useRef<WebView>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [interactMode, setInteractMode] = useState(false);

  const APP_ORIGIN = "https://cinesync.app";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          body { margin: 0; background-color: black; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
          #player { width: 100% !important; height: 100% !important; }
        </style>
      </head>
      <body>
        <div id="player"></div>
        <script>
          var tag = document.createElement('script');
          tag.src = "https://www.youtube.com/iframe_api";
          var firstScriptTag = document.getElementsByTagName('script')[0];
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

          var player;
          function onYouTubeIframeAPIReady() {
            player = new YT.Player('player', {
              height: '100%',
              width: '100%',
              videoId: '${videoId}',
              playerVars: {
                'playsinline': 1, 'controls': 0, 'fs': 0, 'rel': 0,
                'modestbranding': 1, 'disablekb': 1, 'origin': '${APP_ORIGIN}'
              },
              events: { 'onReady': onPlayerReady, 'onStateChange': onPlayerStateChange }
            });
          }

          function onPlayerReady(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'ready'}));
            player.setVolume(100);
            
            setInterval(function(){
              if(player && player.getCurrentTime) {
                var time = player.getCurrentTime();
                var dur = player.getDuration();
                window.ReactNativeWebView.postMessage(JSON.stringify({type: 'status', currentTime: time, duration: dur}));
              }
            }, 500);
          }

          function onPlayerStateChange(event) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type: 'state', data: event.data}));
          }
        </script>
      </body>
    </html>
  `;

  const inject = (script: string) => webViewRef.current?.injectJavaScript(script);

  // 1. Play/Pause Sync
  useEffect(() => {
    if (hasStarted && !interactMode) {
      if (isPlaying) inject(`if(player && player.playVideo) player.playVideo(); true;`);
      else inject(`if(player && player.pauseVideo) player.pauseVideo(); true;`);
    }
  }, [isPlaying, hasStarted, interactMode]);

  // 2. Time Sync (Drift Correction)
  useEffect(() => {
    if (!isOwner && hasStarted && remoteTime > 0) {
      const diff = Math.abs(currentTime - remoteTime);
      if (diff > 2) {
        inject(`if(player) player.seekTo(${remoteTime}, true); true;`);
        setCurrentTime(remoteTime);
      }
    }
  }, [remoteTime, isOwner]);

  // --- INTERAÇÕES ---
  
  const handleSeek = (evt: any) => {
    if (!isOwner || duration === 0) return;
    const width = evt.nativeEvent.locationX;
    const trackWidth = Dimensions.get('window').width - 32;
    const seekTime = duration * (width / trackWidth);
    
    inject(`if(player) player.seekTo(${seekTime}, true); true;`);
    setCurrentTime(seekTime);
    
    // 🔥 Avisa o componente pai (host)
    if (onSeekRequest) onSeekRequest(seekTime);
  };

  const handleSkip = (s: number) => { 
    if(!isOwner) return; 
    const t = currentTime + s; 
    inject(`if(player) player.seekTo(${t}, true); true;`); 
    setCurrentTime(t);
    
    // 🔥 Avisa o componente pai (host)
    if (onSeekRequest) onSeekRequest(t);
  };

  const handleTogglePlay = () => isOwner && onPlayRequest();

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // ✅ AVISA QUE ESTÁ PRONTO (CRUCIAL PARA O AUTO-PLAY)
      if (data.type === 'ready') {
        setIsReady(true);
        if (onReady) onReady();
      }

      if (data.type === 'state') {
        if (data.data === 1 || data.data === 3) setHasStarted(true);
        if (data.data === 0) { setShowControls(true); if(isPlaying && isOwner) onPlayRequest(); }
      }
      if (data.type === 'status') {
        setCurrentTime(data.currentTime);
        setDuration(data.duration);
        if (isOwner && onTimeUpdate) onTimeUpdate(data.currentTime);
      }
    } catch (e) {}
  };

  // --- VOLUME ---
  const handleVolumeChange = (evt: any) => {
     const w = evt.nativeEvent.locationX; let v = Math.round((w / 100) * 100); 
     if(v<0) v=0; if(v>100) v=100; setVolume(v); inject(`if(player) player.setVolume(${v}); true;`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.videoWrapper}>
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent, baseUrl: APP_ORIGIN }} 
          onMessage={handleMessage}
          javaScriptEnabled={true} domStorageEnabled={true} allowsInlineMediaPlayback={true} mediaPlaybackRequiresUserAction={false} androidLayerType="hardware"
          style={{ backgroundColor: 'black' }}
        />
      </View>
      
      {interactMode && (<TouchableOpacity style={styles.interactOverlay} onPress={() => setInteractMode(false)}><View style={styles.interactBadge}><Text style={styles.interactText}>Modo Interativo (Toque para Sair)</Text></View></TouchableOpacity>)}
      {hasStarted && !interactMode && (
        <Pressable style={styles.overlayContainer} onPress={() => { setShowControls(!showControls); setShowVolumeControl(false); }}>
          {showControls && (
            <View style={styles.controlsUI}>
              <View style={styles.backdrop} />
              <View style={styles.topBar}>
                 <TouchableOpacity style={styles.interactButton} onPress={() => {setInteractMode(true); setShowControls(false);}}><MaterialIcons name="touch-app" size={20} color="white" /><Text style={styles.interactBtnText}>Pular Anúncio</Text></TouchableOpacity>
                 <View style={styles.volumeContainer}>{showVolumeControl && <Pressable onPress={handleVolumeChange} style={styles.volumeSliderTrack}><View style={[styles.volumeSliderFill, { width: volume }]} /></Pressable>}<TouchableOpacity onPress={() => setShowVolumeControl(!showVolumeControl)} style={styles.iconButton}><Ionicons name="volume-high" size={24} color="white" /></TouchableOpacity></View>
              </View>
              <View style={styles.centerControls}>
                {isOwner ? (
                  <View style={styles.controlsRow}>
                    <TouchableOpacity onPress={() => handleSkip(-10)} style={styles.skipButton}><MaterialIcons name="replay-10" size={36} color="white" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleTogglePlay} style={styles.playButton}><Ionicons name={isPlaying ? "pause" : "play"} size={40} color="white" style={{marginLeft: isPlaying?0:4}}/></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleSkip(10)} style={styles.skipButton}><MaterialIcons name="forward-10" size={36} color="white" /></TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.viewerBadge}><ActivityIndicator size="small" color="#6366F1" animating={isPlaying} /><Text style={styles.viewerText}>{isPlaying ? "Sincronizado" : "Pausado"}</Text></View>
                )}
              </View>
              <View style={styles.bottomBar}>
                <View style={styles.timeInfo}><Text style={styles.timeText}>{formatTime(currentTime)}</Text><Text style={styles.timeText}>{formatTime(duration)}</Text></View>
                {isOwner ? (
                  <Pressable onPress={handleSeek} style={styles.progressBarArea}><View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${(currentTime / (duration || 1)) * 100}%` }]} /></View><View style={[styles.progressBarThumb, { left: `${(currentTime / (duration || 1)) * 100}%` }]} /></Pressable>
                ) : (
                  <View style={styles.progressBarArea}><View style={[styles.progressBarBg, { opacity: 0.6 }]}><View style={[styles.progressBarFill, { width: `${(currentTime / (duration || 1)) * 100}%` }]} /></View></View>
                )}
              </View>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 240, backgroundColor: 'black', borderRadius: 12, overflow: 'hidden' },
  videoWrapper: { flex: 1, backgroundColor: 'black' },
  overlayContainer: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  controlsUI: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 12 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  interactButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  interactBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  volumeContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 4 },
  iconButton: { padding: 6 },
  volumeSliderTrack: { width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', marginRight: 10, marginLeft: 10, borderRadius: 2 },
  volumeSliderFill: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 30 },
  skipButton: { padding: 10, opacity: 0.8 },
  playButton: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(99, 102, 241, 0.9)', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  bottomBar: { width: '100%', paddingBottom: 4 },
  timeInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  timeText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600' },
  progressBarArea: { height: 24, justifyContent: 'center' },
  progressBarBg: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, width: '100%', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6366F1' },
  progressBarThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: 'white', top: 5, marginLeft: -7 },
  viewerBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30 },
  viewerText: { color: 'white', fontWeight: 'bold' },
  interactOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 5, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  interactBadge: { backgroundColor: 'rgba(245, 158, 11, 0.9)', padding: 10, borderRadius: 8 },
  interactText: { color: 'black', fontWeight: 'bold' }
});