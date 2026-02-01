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
