# CineSync - Design de Interface

## Visão Geral
CineSync é um aplicativo de visualização compartilhada de vídeos que permite que múltiplos usuários assistam a conteúdo de diversas plataformas (YouTube, Google Drive, Netflix, Prime Video) simultaneamente em uma sala, com chat sincronizado e áudio opcional.

**Orientação:** Retrato (9:16) | **Uso:** Uma mão | **Estilo:** iOS-first, limpo e intuitivo

---

## Paleta de Cores

| Elemento | Cor | Uso |
|----------|-----|-----|
| **Primary** | `#6366F1` (Indigo) | Botões principais, destaques, ações |
| **Secondary** | `#8B5CF6` (Roxo) | Elementos secundários, acentos |
| **Background** | `#FFFFFF` (Branco) / `#0F172A` (Escuro) | Fundo geral |
| **Surface** | `#F8FAFC` (Cinza claro) / `#1E293B` (Cinza escuro) | Cards, superfícies elevadas |
| **Text Primary** | `#0F172A` (Quase preto) / `#F1F5F9` (Quase branco) | Texto principal |
| **Text Secondary** | `#64748B` (Cinza médio) / `#94A3B8` (Cinza médio claro) | Texto secundário |
| **Success** | `#10B981` (Verde) | Confirmações, usuários online |
| **Error** | `#EF4444` (Vermelho) | Erros, avisos |
| **Border** | `#E2E8F0` (Cinza muito claro) / `#334155` (Cinza escuro) | Divisores, bordas |

---

## Telas Principais

### 1. **Tela de Autenticação (Login/Registro)**
**Objetivo:** Permitir que usuários criem conta ou façam login

**Conteúdo:**
- Logo do CineSync (topo)
- Campo de email
- Campo de senha
- Botão "Entrar" (primário)
- Link "Criar conta" (secundário)
- Opção de login social (opcional)

**Funcionalidade:**
- Validação de email em tempo real
- Feedback visual de erros
- Carregamento durante autenticação

---

### 2. **Tela Home (Lista de Salas)**
**Objetivo:** Exibir salas disponíveis e permitir criar/entrar em uma sala

**Conteúdo:**
- Header com "CineSync" + ícone de perfil
- Botão flutuante "Criar Sala" (FAB)
- Lista de salas com:
  - Thumbnail do vídeo em exibição
  - Título da sala
  - Número de pessoas online
  - Título do vídeo atual
  - Tempo decorrido do vídeo

**Funcionalidade:**
- Busca/filtro de salas
- Atualização automática da lista
- Tap para entrar em uma sala

---

### 3. **Tela de Criação de Sala**
**Objetivo:** Permitir que o usuário crie uma nova sala

**Conteúdo:**
- Campo "Nome da Sala"
- Seletor de plataforma de vídeo:
  - YouTube
  - Google Drive
  - Netflix (link/ID)
  - Prime Video (link/ID)
- Campo "URL/ID do Vídeo"
- Botão "Criar Sala" (primário)
- Botão "Cancelar" (secundário)

**Funcionalidade:**
- Validação de URL/ID
- Preview do vídeo (se possível)
- Criação e redirecionamento automático

---

### 4. **Tela Principal - Sala (Player + Chat)**
**Objetivo:** Exibir o vídeo sincronizado e permitir interação via chat

**Layout (Portrait):**
```
┌─────────────────────────┐
│   [Header: Nome Sala]   │
├─────────────────────────┤
│                         │
│   [Video Player]        │ ← 60% da altura
│   [Play/Pause/Seek]     │
│                         │
├─────────────────────────┤
│ [Usuários Online: 3]    │
├─────────────────────────┤
│                         │
│   [Chat Messages]       │ ← 30% da altura
│   [Scroll Area]         │
│                         │
├─────────────────────────┤
│ [Input Chat + Enviar]   │
└─────────────────────────┘
```

**Conteúdo:**
- **Header:** Nome da sala + ícone de saída + ícone de áudio (on/off)
- **Player:** Video player com controles (play/pause, seek bar, volume, fullscreen)
- **Info Usuários:** Badge mostrando número de pessoas online
- **Chat:** 
  - Mensagens com avatar do usuário, nome e timestamp
  - Diferenciação visual para próprias mensagens
  - Scroll automático para novas mensagens
- **Input:** Campo de texto + botão enviar

**Funcionalidade:**
- Sincronização de play/pause entre usuários
- Chat em tempo real
- Indicador de digitação
- Áudio opcional (WebRTC ou similar)
- Controle de volume
- Modo fullscreen

---

### 5. **Tela de Configurações**
**Objetivo:** Permitir que o usuário customize preferências

**Conteúdo:**
- Informações do perfil (nome, email, avatar)
- Preferências de notificação
- Modo escuro/claro
- Sair da conta

**Funcionalidade:**
- Edição de perfil
- Toggle de notificações
- Toggle de tema

---

## Fluxos de Usuário Principais

### Fluxo 1: Criar e Entrar em uma Sala
```
Home → Botão "Criar Sala" → Preencher dados → Criar → Sala (Player + Chat)
```

### Fluxo 2: Entrar em uma Sala Existente
```
Home → Tap em sala → Sala (Player + Chat)
```

### Fluxo 3: Assistir e Conversar
```
Sala → Play/Pause sincronizado → Chat em tempo real → Sair da sala → Home
```

### Fluxo 4: Áudio Compartilhado (Futuro)
```
Sala → Ícone de áudio → Solicitar permissão → Conectar → Conversa de áudio
```

---

## Componentes Reutilizáveis

| Componente | Uso |
|-----------|-----|
| `RoomCard` | Exibir salas na Home |
| `ChatMessage` | Exibir mensagens no chat |
| `VideoPlayer` | Player de vídeo sincronizado |
| `UserBadge` | Exibir usuários online |
| `Button` | Botões primários/secundários |
| `InputField` | Campos de texto |

---

## Considerações Técnicas

### Sincronização de Vídeo
- Usar timestamp do servidor como referência
- Sincronizar play/pause entre clientes
- Tolerar pequenas diferenças (< 2 segundos)

### Chat em Tempo Real
- WebSocket ou similar para mensagens instantâneas
- Histórico de chat (últimas 100 mensagens)
- Indicador de digitação

### Suporte a Múltiplas Plataformas
- **YouTube:** IFrame API
- **Google Drive:** Streaming direto (se público)
- **Netflix/Prime:** Apenas links (sem embedding direto por restrições)

### Áudio (Futuro)
- WebRTC para comunicação P2P
- Fallback para chat de texto

---

## Prioridade de Implementação

1. **MVP (Fase 1):** Home, Criar Sala, Player básico, Chat de texto
2. **Fase 2:** Sincronização avançada, Áudio, Configurações
3. **Fase 3:** Histórico de salas, Recomendações, Notificações
