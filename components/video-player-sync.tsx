import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Dimensions, Alert, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface VideoPlayerSyncProps {
  videoId: string;
  isPlaying: boolean;       
  onPlayRequest: () => void;
  isOwner: boolean;
  onTimeUpdate?: (currentTime: number) => void;
  onSeekRequest?: (time: number) => void;
  onSyncRequest?: () => void;
  onReady?: () => void;
  onVideoEnd?: () => void; // 🔥 Gatilho do Auto-Play
  remoteTime?: number;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// 🔥 EXTRATOR INTELIGENTE: Pega o ID de 11 letras de qualquer link do YouTube
const extractYouTubeId = (url: string) => {
  if (!url) return null;
  if (url.length === 11 && !url.includes('/') && !url.includes('.')) return url;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]{11})/);
  return match ? match[1] : null;
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
  onVideoEnd,
  remoteTime = 0 
}: VideoPlayerSyncProps) {
  const webViewRef = useRef<WebView>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Identifica e limpa o ID do YouTube
  const ytId = extractYouTubeId(videoId);
  const isYouTube = !!ytId;

  const filePlayerHTML = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <style>body{margin:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;overflow:hidden}video,iframe{width:100%;height:100%;border:0;object-fit:contain}</style></head>
    <body>${videoId.includes('.mp4')||videoId.includes('.m3u8')?`<video id="player" src="${videoId}" playsinline webkit-playsinline autoplay></video>`:`<iframe id="player" src="${videoId}" allowfullscreen allow="autoplay;encrypted-media"></iframe>`}
    <script>var p=document.getElementById('player');var isV=p.tagName==='VIDEO';if(isV){p.addEventListener('loadedmetadata',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready',duration:p.duration}))});
    p.addEventListener('ended',function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'ended'}))}); // 🔥 Evento de Fim de Vídeo Local
    setInterval(function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'status',currentTime:p.currentTime,duration:p.duration||0,paused:p.paused}))},500)}else{window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready',duration:0}))}
    window.control={play:function(){if(isV)p.play()},pause:function(){if(isV)p.pause()},seek:function(t){if(isV&&isFinite(p.duration))p.currentTime=t}};
    </script></body></html>`;

  const youtubePlayerHTML = `
    <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
    <style>html,body{height:100%;width:100%;margin:0;padding:0;background:#000;overflow:hidden}#player{width:100%!important;height:100%!important}</style></head>
    <body><div id="player"></div><script src="https://www.youtube.com/iframe_api"></script>
    <script>var player;function onYouTubeIframeAPIReady(){player=new YT.Player('player',{height:'100%',width:'100%',videoId:'${ytId}',playerVars:{playsinline:1,controls:0,rel:0,fs:0,autoplay:1,modestbranding:1},events:{onReady:onPlayerReady,onStateChange:onPlayerStateChange}})}
    function onPlayerReady(e){window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));e.target.playVideo()}
    function onPlayerStateChange(e){
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'status',currentTime:player.getCurrentTime(),duration:player.getDuration(),paused:e.data!==1}));
      if(e.data===0) window.ReactNativeWebView.postMessage(JSON.stringify({type:'ended'})); // 🔥 Evento de Fim de Vídeo YouTube
    }
    setInterval(function(){if(player&&player.getCurrentTime)window.ReactNativeWebView.postMessage(JSON.stringify({type:'status',currentTime:player.getCurrentTime(),duration:player.getDuration()}))},500);
    window.control={play:function(){player.playVideo()},pause:function(){player.pauseVideo()},seek:function(t){player.seekTo(t,true)}};
    </script></body></html>`;

  const inject = (s: string) => webViewRef.current?.injectJavaScript(s);

  useEffect(() => {
    if (!hasStarted) return;
    if (isPlaying) inject(`if(window.control)window.control.play();true;`);
    else {
      if (!isOwner && remoteTime > 0) {
        inject(`if(window.control){window.control.seek(${remoteTime});window.control.pause();}true;`);
      } else inject(`if(window.control)window.control.pause();true;`);
    }
  }, [isPlaying, hasStarted, isOwner]);

  useEffect(() => {
    if (!hasStarted || isOwner || remoteTime === 0) return;
    const diff = Math.abs(currentTime - remoteTime);
    if (diff > 3) inject(`if(window.control)window.control.seek(${remoteTime});true;`);
  }, [remoteTime, hasStarted, isOwner]);

  const handleMessage = (e: any) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'ready') { setHasStarted(true); onReady?.(); }
      if (d.type === 'status') {
        setCurrentTime(d.currentTime);
        setDuration(d.duration);
        if (d.paused !== undefined) setLocalIsPlaying(!d.paused);
        onTimeUpdate?.(d.currentTime);
      }
      if (d.type === 'ended') {
        onVideoEnd?.(); // 🔥 Gatilho do React Native
      }
    } catch (err) {}
  };

  const handleTogglePlay = () => {
    if (isOwner) onPlayRequest();
    else if (localIsPlaying) { inject(`window.control.pause();`); setLocalIsPlaying(false); }
    else {
      if (!isPlaying) return Alert.alert("Aguarde", "O Host pausou o vídeo.");
      onSyncRequest?.();
      inject(`if(window.control)window.control.play();true;`);
      setLocalIsPlaying(true);
    }
  };

  const handleSliderSeek = (evt: any) => {
    if (!isOwner || duration === 0) return;
    const { locationX } = evt.nativeEvent;
    const sliderWidth = Dimensions.get('window').width - 48;
    let percentage = locationX / sliderWidth;
    percentage = Math.max(0, Math.min(1, percentage));
    const seekTime = duration * percentage;
    inject(`window.control.seek(${seekTime});`);
    onSeekRequest?.(seekTime);
  };

  const handleSkip = (seconds: number) => {
    if (!isOwner || duration === 0) return; // Segurança dupla: Só o Host pula o tempo
    
    let newTime = currentTime + seconds;
    // Trava para não dar erro de números negativos ou passar do fim do vídeo
    newTime = Math.max(0, Math.min(newTime, duration - 1)); 
    
    inject(`if(window.control)window.control.seek(${newTime});`);
    onSeekRequest?.(newTime); // Avisa o servidor para sincronizar todos os espectadores
  };

  return (
    <View style={styles.container}>
      <WebView key={videoId} ref={webViewRef} source={{ html: isYouTube ? youtubePlayerHTML : filePlayerHTML, baseUrl: "https://google.com" }} onMessage={handleMessage} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} style={{ backgroundColor: '#000' }} />
      {hasStarted && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowControls(!showControls)}>
          {showControls && (
            <View style={styles.controlsUI}>
              <View style={styles.centerRow}>
                  {isOwner && (
                    <TouchableOpacity onPress={() => handleSkip(-10)} style={styles.skipBtn}>
                      <Ionicons name="play-back" size={28} color="#fff" />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity onPress={handleTogglePlay} style={styles.playBtn}>
                    <Ionicons name={(isOwner ? isPlaying : localIsPlaying) ? "pause" : "play"} size={40} color="#fff" />
                  </TouchableOpacity>

                  {isOwner && (
                    <TouchableOpacity onPress={() => handleSkip(10)} style={styles.skipBtn}>
                      <Ionicons name="play-forward" size={28} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              <View style={styles.bottom}><Text style={styles.timeText}>{formatTime(currentTime)} / {formatTime(duration)}</Text>
              <Pressable onPress={handleSliderSeek} style={styles.barBg}><View style={[styles.barFill, { width: `${(currentTime/duration)*100}%` }]} /></Pressable></View>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 240, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' },
  controlsUI: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between', padding: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  centerRow: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20 },
  playBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  skipBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  bottom: { width: '100%' },
  timeText: { color: '#fff', fontSize: 12, marginBottom: 8 },
  barBg: { height: 20, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, justifyContent: 'center' },
  barFill: { height: 4, backgroundColor: '#6366F1', borderRadius: 2 }
});