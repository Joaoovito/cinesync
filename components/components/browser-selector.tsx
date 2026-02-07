import React, { useState, useRef } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

interface BrowserSelectorProps {
  initialUrl?: string; // Permite abrir direto no YouTube ou Google
  onVideoSelect: (videoId: string) => void; // Devolve o ID para a Home
  onClose: () => void;
}

export function BrowserSelector({ initialUrl = 'https://m.youtube.com', onVideoSelect, onClose }: BrowserSelectorProps) {
  const [url, setUrl] = useState(initialUrl);
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [canGoBack, setCanGoBack] = useState(false);
  
  const webViewRef = useRef<WebView>(null);

  // Função de Navegar (Barra de Endereço)
  const handleGo = () => {
    let target = url.toLowerCase();
    if (!target.startsWith('http')) target = 'https://' + target;
    // Se não tiver ponto (ex: "trailer matrix"), pesquisa no Google
    if (!target.includes('.') || target.includes(' ')) {
      target = 'https://www.google.com/search?q=' + encodeURIComponent(url);
    }
    setUrl(target);
  };

  // Monitora a mudança de página para atualizar a barra e botão voltar
  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);
    setCanGoBack(navState.canGoBack);
    
    // Atualiza o texto da barra apenas se não for uma URL interna feia do Google
    if (!navState.url.includes('google.com/search')) {
        setUrl(navState.url);
    }
  };

  // Lógica de Captura do Vídeo
  const captureVideo = () => {
    // Regex poderosa para pegar ID de qualquer link do YouTube (curto, longo, embed, mobile)
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = currentUrl.match(regex);

    if (match && match[1]) {
      const videoId = match[1];
      Alert.alert(
        "Vídeo Encontrado!",
        "Deseja criar uma sala com este vídeo?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sim, Criar Sala", onPress: () => onVideoSelect(videoId) }
        ]
      );
    } else {
      Alert.alert(
        "Nenhum vídeo detectado", 
        "Navegue até a página de um vídeo do YouTube para selecioná-lo."
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* BARRA DE ENDEREÇO */}
      <View style={styles.addressBar}>
        <TouchableOpacity onPress={onClose} style={styles.iconButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          value={url}
          onChangeText={setUrl}
          onSubmitEditing={handleGo}
          placeholder="Pesquise ou digite URL"
          placeholderTextColor="#999"
          autoCapitalize="none"
          keyboardType="web-search"
          selectTextOnFocus
        />
        
        <TouchableOpacity onPress={handleGo} style={styles.iconButton}>
          <Ionicons name="search" size={20} color="white" />
        </TouchableOpacity>
      </View>

      {/* NAVEGADOR WEB */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          onNavigationStateChange={handleNavigationStateChange}
          startInLoadingState={true}
          renderLoading={() => <ActivityIndicator size="large" color="#6366F1" style={styles.loading} />}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
        />
      </View>

      {/* RODAPÉ DE CONTROLE */}
      <View style={styles.bottomBar}>
        <TouchableOpacity 
          onPress={() => webViewRef.current?.goBack()} 
          disabled={!canGoBack}
          style={[styles.navButton, !canGoBack && styles.disabledBtn]}
        >
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {/* BOTÃO PRINCIPAL: CAPTURAR */}
        <TouchableOpacity style={styles.captureButton} onPress={captureVideo}>
          <Ionicons name="play-circle" size={24} color="white" />
          <Text style={styles.captureText}>Selecionar Vídeo</Text>
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
  addressBar: { 
    flexDirection: 'row', alignItems: 'center', padding: 8, paddingTop: 12,
    backgroundColor: '#1E1E24', borderBottomWidth: 1, borderBottomColor: '#333' 
  },
  iconButton: { padding: 8 },
  input: { 
    flex: 1, backgroundColor: '#2A2A35', color: 'white', 
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8,
    fontSize: 14
  },
  webviewContainer: { flex: 1, position: 'relative' },
  loading: { position: 'absolute', top: '50%', left: '50%', zIndex: 10 },
  
  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: '#1E1E24', borderTopWidth: 1, borderTopColor: '#333'
  },
  navButton: { padding: 10 },
  disabledBtn: { opacity: 0.3 },
  
  captureButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: 30, elevation: 5, shadowColor: '#6366F1', shadowOpacity: 0.4
  },
  captureText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});