# CineSync - TODO

## Autenticação e Usuários
- [ ] Implementar login com email/senha
- [ ] Implementar registro de novo usuário
- [ ] Persistência de sessão (AsyncStorage)
- [ ] Tela de perfil do usuário
- [ ] Logout

## Telas Principais
- [x] Tela Home com lista de salas
- [x] Tela de criação de sala
- [x] Tela de sala (player + chat)
- [x] Tela de configurações
- [x] Navegação entre telas (tab bar)

## Funcionalidade de Salas
- [x] Criar nova sala
- [x] Listar salas disponíveis
- [x] Entrar em uma sala
- [x] Sair de uma sala
- [x] Deletar sala (apenas criador)
- [x] Exibir número de usuários online

## Player de Vídeo
- [ ] Integração com YouTube IFrame API
- [ ] Integração com Google Drive
- [ ] Controles básicos (play/pause/seek)
- [ ] Indicador de progresso
- [ ] Controle de volume
- [ ] Modo fullscreen
- [ ] Exibir título e duração do vídeo

## Sincronização de Vídeo
- [ ] Sincronizar play/pause entre usuários
- [ ] Sincronizar posição do vídeo (seek)
- [ ] Usar timestamp do servidor como referência
- [ ] Tolerar pequenas diferenças de sincronização
- [ ] Indicador visual de sincronização

## Chat em Tempo Real
- [ ] Enviar mensagens de texto
- [ ] Receber mensagens em tempo real
- [ ] Exibir histórico de chat
- [ ] Mostrar nome do usuário e avatar
- [ ] Timestamp das mensagens
- [ ] Scroll automático para novas mensagens
- [ ] Indicador de digitação (opcional)

## Áudio (Futuro)
- [ ] Ícone de toggle de áudio
- [ ] Integração com WebRTC (básica)
- [ ] Controle de microfone
- [ ] Controle de volume de áudio

## Integração com APIs
- [x] Configurar servidor backend (Node.js + Express)
- [x] Implementar banco de dados (MySQL com Drizzle)
- [x] Criar endpoints REST para salas
- [x] Criar endpoints REST para chat
- [ ] Implementar WebSocket para tempo real
- [x] Autenticação JWT (Manus OAuth)

## Design e Interface
- [x] Aplicar paleta de cores
- [x] Implementar tema claro/escuro
- [x] Criar componentes reutilizáveis
- [x] Garantir responsividade em portrait
- [ ] Testar em diferentes tamanhos de tela

## Testes
- [x] Testes unitários para componentes
- [ ] Testes de integração para fluxos
- [ ] Testes de sincronização de vídeo
- [ ] Testes de chat em tempo real
- [ ] Testes em dispositivos reais (iOS/Android)

## Otimização e Deployment
- [ ] Otimizar performance do app
- [ ] Testar em conexões lentas
- [ ] Preparar para build de produção
- [ ] Configurar CI/CD
- [ ] Documentação de deployment


## Bugs & Correções
- [x] Corrigir fluxo OAuth (erro: Missing code or state parameter)
- [x] Implementar login com usuário de teste
- [ ] Testar autenticação em diferentes plataformas
- [x] Bug: Criar sala não está funcionando
- [x] Bug: Criação de sala ainda não está funcionando (usuário reportou)
- [x] Bug: Player de vídeo não roda (mostrar vídeo real do YouTube)
- [x] Bug: Salas criadas não aparecem na lista (usuário reportou)
- [x] Bug: Buscador de salas não funciona
- [x] Bug: Salas criadas não aparecem até reiniciar o app
- [x] Feature: Sincronização de vídeo em tempo real entre usuários (Polling)
- [x] Feature: Sincronizar tempo do vídeo (currentTime) para novos usuários
- [x] Feature: Criar player de vídeo próprio com expo-video para sincronização completa
- [x] Bug: Player de vídeo não funciona (usuário reportou)
- [x] Feature: Otimizar e corrigir chat das salas
- [x] Feature: Notificações em tempo real para entrada/saída de usuários

## Reanálise Completa - Fazer App Funcionar
- [x] Verificar e corrigir fluxo de login
- [x] Verificar e corrigir criação de salas
- [x] Verificar e corrigir entrada em salas existentes
- [x] Implementar player de vídeo YouTube funcional com controle real
- [x] Sincronização de vídeo entre usuários (play/pause/seek)
- [x] Chat funcionando em tempo real
- [x] Testar fluxo completo end-to-end

## Melhorias do Player e Persistência
- [x] Melhorar qualidade visual do player (controles, barra de progresso)
- [x] Implementar persistência do tempo do vídeo mesmo sem usuários na sala
- [x] Salvar currentTime automaticamente no banco de dados
- [x] Carregar tempo salvo quando usuário entra na sala

## Player Independente (expo-video)
- [x] Criar player com expo-video para controle total de reprodução
- [x] Implementar sincronização real de tempo entre usuários
- [x] Suportar URLs diretas de vídeo (MP4, WebM, HLS)
- [x] Atualizar criação de sala para aceitar URLs diretas
- [x] Testar sincronização entre múltiplos usuários

- [x] Bug: Player dá erro ao carregar vídeo e fica em loop infinito ao tentar novamente

## Player Próprio v2 - Desenvolvimento Completo
- [x] Criar player HTML5 robusto com controles nativos
- [x] Implementar play/pause com feedback visual
- [x] Implementar barra de progresso clicável
- [x] Implementar controle de volume
- [x] Implementar fullscreen
- [x] Implementar sincronização de tempo entre usuários
- [ ] Testar com vídeos MP4 reais
- [x] Garantir funcionamento em web e mobile

- [x] Bug: Player mostra "Formato não suportado" ao carregar vídeo

- [x] Bug: YouTube e Google Drive mostram erro de CORS - implementar iframe

## Arquitetura Controller Proxy - YouTube IFrame
- [x] Criar player YouTube com IFrame API e controles nativos ocultos
- [x] Implementar overlay UI com controles customizados (play/pause, seek, volume)
- [x] Implementar comunicação via postMessage para controlar o player
- [x] Integrar sincronização de tempo entre usuários
- [x] Testar player com vídeos do YouTube

## Correção YouTube IFrame Player
- [x] Adicionar opção YouTube na tela de criação de sala
- [x] Corrigir detecção automática de URLs do YouTube no player
- [x] Testar player com URL do YouTube

## Sincronização via Eventos (WebSocket-like)
- [x] Criar endpoints de eventos no servidor (play_request, pause_request, seek_request)
- [x] Modificar botões para emitir eventos em vez de executar ações locais
- [x] Implementar listeners de comandos (play_command, pause_command, seek_command)
- [x] Implementar time_sync do Host a cada 2 segundos
- [x] Implementar correção automática de tempo nos participantes (tolerância 2s)
- [x] Testar sincronização entre múltiplos usuários

## Sincronização Estilo Rave (Socket.IO)
- [x] Instalar dependências (react-native-youtube-iframe, socket.io-client, socket.io)
- [x] Criar servidor Socket.IO (socket-server.ts) na porta 4000
- [x] Reescrever VideoPlayerSync com overlay de controles
- [x] Implementar lógica de marionete (emit -> on -> execute)
- [x] Integrar Socket.IO na tela de sala
- [x] Testar sincronização em tempo real
