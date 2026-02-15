import React, { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface BrowserSelectorProps {
  initialUrl?: string;
  onVideoSelect: (videoId: string, source?: 'youtube' | 'direct' | 'embed') => void;
  onClose: () => void;
}

// 👇 A CORREÇÃO ESTÁ AQUI: TEM QUE TER "export" ANTES DE "function"
export function BrowserSelector({ initialUrl = 'https://google.com', onVideoSelect, onClose }: BrowserSelectorProps) {
  const [url, setUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  const webViewRef = useRef<any>(null);

  // 🔒 TRAVAS
  const isAlertOpen = useRef(false);
  const isCaptured = useRef(false);

  // 🕵️ CAÇADOR HÍBRIDO (YouTube + MP4 + Embeds)
  const hunterScript = `
    (function() {
      if (window.hasCineSync) return;
      window.hasCineSync = true;

      function notify(data) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }

      function scan() {
        var found = false;

        // 1. DETECTOR DE YOUTUBE
        var ytMatch = window.location.href.match(/(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})/);
        if (ytMatch && ytMatch[1]) {
           notify({type: 'video_detected', url: ytMatch[1], sourceType: 'youtube'});
           return;
        }

        // 2. DETECTOR DE ARQUIVOS/EMBEDS
        var mediaTags = document.querySelectorAll('video, iframe');
        mediaTags.forEach(function(el) {
           var src = el.src || el.currentSrc;
           if (!src) return;
           src = src.trim();
           if (src.startsWith('blob:') || src.startsWith('data:')) return;

           // A. Arquivos Diretos
           if (src.includes('.mp4') || src.includes('.m3u8') || src.includes('odycdn')) {
              notify({type: 'video_detected', url: src, sourceType: 'direct'});
              found = true;
           } 
           // B. Players Externos (Genéricos)
           else if ((src.includes('embed') || src.includes('player')) && !src.includes('google') && !src.includes('ads')) {
              notify({type: 'video_detected', url: src, sourceType: 'embed'});
              found = true;
           }
        });

        // 3. REGEX NO HTML (Para JSON escondido)
        if (!found) {
          var html = document.documentElement.innerHTML;
          var mp4Regex = /(https?:\\/\\/[^"']+\\.(?:mp4|m3u8))/gi;
          var match = mp4Regex.exec(html);
          if (match) notify({type: 'video_detected', url: match[1], sourceType: 'direct'});
        }
      }

      // VIGIA DE MUDANÇAS
      var observer = new MutationObserver(function() { scan(); });
      observer.observe(document.body, { childList: true, subtree: true });
      setInterval(scan, 2000);
      
      // Manual
      window.manualCapture = function() {
        scan();
        window.ReactNativeWebView.postMessage(JSON.stringify({type: 'scan_complete'}));
      }
    })();
  `;

  const handleMessage = (event: any) => {
    try {
      if (isCaptured.current || isAlertOpen.current) return;
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'scan_complete') {
        Alert.alert("Scanner", "Nada encontrado nesta página.");
        return;
      }

      if (data.type === 'video_detected') {
        if (data.url === currentUrl && data.sourceType !== 'youtube') return; 

        isAlertOpen.current = true;
        
        let displaySource = 'Web Player';
        if (data.sourceType === 'youtube') displaySource = 'YouTube';
        if (data.sourceType === 'direct') displaySource = 'Arquivo de Vídeo';

        Alert.alert(
          "Vídeo Encontrado! 🎬",
          `Fonte: ${displaySource}`,
          [
            { text: "Cancelar", style: "cancel", onPress: () => { isAlertOpen.current = false; } },
            { 
              text: "ASSISTIR AGORA", 
              onPress: () => {
                isCaptured.current = true;
                isAlertOpen.current = false;
                onVideoSelect(data.url, data.sourceType); 
              }
            }
          ]
        );
      }
    } catch (e) {}
  };

  const captureVideo = () => {
    webViewRef.current?.injectJavaScript(`if(window.manualCapture) window.manualCapture(); else alert('Carregando...'); true;`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.addressBar}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton}><Ionicons name="close" size={24} color="white" /></TouchableOpacity>
        <TextInput
          style={styles.input} value={url} onChangeText={setUrl} onSubmitEditing={() => setUrl(url)}
          placeholder="Digite a URL..." placeholderTextColor="#999" autoCapitalize="none" keyboardType="web-search"
        />
        <TouchableOpacity onPress={() => setUrl(url)} style={styles.iconButton}><Ionicons name="search" size={20} color="white" /></TouchableOpacity>
      </View>

      <View style={styles.webviewContainer}>
        {/* @ts-ignore */}
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          onNavigationStateChange={(nav: any) => {
            setCurrentUrl(nav.url);
            setCanGoBack(nav.canGoBack);
            if (nav.url.startsWith('http') && nav.url !== url) setUrl(nav.url);
          }}
          onMessage={handleMessage}
          injectedJavaScript={hunterScript}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator size="large" color="#6366F1" style={styles.loading} />}
        />
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => webViewRef.current?.goBack()} disabled={!canGoBack} style={[styles.navButton, !canGoBack && styles.disabledBtn]}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.captureButton} onPress={captureVideo}>
          <Ionicons name="scan-circle" size={28} color="white" />
          <Text style={styles.captureText}>ESCANEAR TELA</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.navButton}>
          <Ionicons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  addressBar: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#1E1E24', borderBottomWidth: 1, borderBottomColor: '#333' },
  iconButton: { padding: 8 },
  input: { flex: 1, backgroundColor: '#2A2A35', color: 'white', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8, fontSize: 14 },
  webviewContainer: { flex: 1, position: 'relative' },
  loading: { position: 'absolute', top: '50%', left: '50%', zIndex: 10 },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#1E1E24', borderTopWidth: 1, borderTopColor: '#333' },
  navButton: { padding: 10 },
  disabledBtn: { opacity: 0.3 },
  captureButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 30, elevation: 5 },
  captureText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});