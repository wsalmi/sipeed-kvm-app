# Salmer KVM Studio

<div align="center">

**Multiplatform Desktop Manager for Sipeed NanoKVM Devices**

[🇺🇸 English](#-english) • [🇪🇸 Español](#-español) • [🇧🇷 Português](#-português)

</div>

---

<a id="-english"></a>
## 🇺🇸 English

A modern, multiplatform desktop application (**macOS, Windows, and Linux**) built with **Electron + React + TypeScript + Vite**, designed for managing fleets of Sipeed KVM devices, with primary focus on **NanoKVM Go** (and **Go+**), alongside support for NanoKVM Lite, Full, and USB.

### 🌟 Key Features

1. **Multilingual Support & System Locale Auto-Detection**:
   - Seamlessly switch between **English (EN)**, **Spanish (ES)**, and **Portuguese (PT)** directly from the top-right corner of the application or inside Settings.
   - Automatically detects the host operating system's language on initial launch.
   - Saves your selected language preference persistently across sessions via local storage and secure desktop settings.

2. **Device Catalog & 1-Click Connection**:
   - Save multiple NanoKVM devices with custom names, local IP addresses or Tailscale MagicDNS (`device.ts.net`), ports, and passwords encrypted natively with OS hardware keychain (`safeStorage`).
   - Flexible organization using Groups & Environments (*Datacenter*, *Lab Bench*, *Mobile Devices*, *Remote*).
   - **Quick Connect** feature for instant, ad-hoc access to any KVM without catalog registration.
   - Backup import and export in JSON format.

3. **Real-time Status Monitoring (Health Check)**:
   - Background latency and connectivity health checks with live operational badges (🟢 Online, 🟡 Degraded, 🔴 Offline).

4. **Multiple Active Sessions & Grid Layouts**:
   - **Tab System**: Instant switching between active KVM sessions without reloading or interrupting video streams.
   - **Multi-View Grid**: Monitor up to 9 KVMs simultaneously in **1x2** (side-by-side), **2x2** (quad-view), or **3x3** layouts. Double-click any quadrant to expand into focus view.
   - **Pop-out Windows**: Detach any active session into an independent Electron window for multi-monitor workspaces.

5. **Gaming Mode & Gamepad / Joystick Support**:
   - Low-latency detection of game controllers connected via USB or Bluetooth (Xbox, PlayStation DualSense/DualShock, Nintendo Switch Pro, and standard HID gamepads).
   - Analog stick deadzone calibration in Settings.
   - **Exclusive Fullscreen Mode**: Pointer Lock and Keyboard Lock APIs keep your mouse trapped and capture OS shortcuts for uninterrupted remote gaming.
   - **Custom Exit Shortcut**: Press **`F11`** (configurable) to toggle fullscreen and exclusive lock, with an unobtrusive top HUD overlay.

6. **Specialized Hardware Toolbar (NanoKVM Go)**:
   - 1-click keyboard macros: `Ctrl+Alt+Del`, `Win/Super`, `Cmd+Space` (Spotlight), `Alt+Tab`, `Cmd+Tab`, `TaskMgr`.
   - **iOS Mouse Wake-up**: Dedicated trigger sending initial right-click to wake up HID cursor on iPhone/iPad connected to NanoKVM Go.
   - Instant screenshot capture (copied to clipboard and saved to Pictures folder).

### 🚀 Getting Started

#### Prerequisites
- Node.js 18+ (Node.js 20 or 22 recommended)
- npm or yarn

#### Install & Run in Development
```bash
# Install dependencies
npm install

# Start development server (Vite + Electron)
npm run dev
```

#### Code Quality & Type Check
```bash
# Static TypeScript verification
npm run typecheck

# Build Vite frontend bundle
npm run build:vite
```

#### Packaging Desktop Installers
```bash
# Build desktop package for current OS
npm run build

# Or target specific operating systems
npm run build:mac    # macOS (.dmg and .zip for Apple Silicon & Intel)
npm run build:win    # Windows (.exe 64-bit installer)
npm run build:linux  # Linux (.AppImage and .deb)
```

#### 🚀 Automated CI/CD & GitHub Releases
Releases are automatically built and published across **macOS, Windows, and Linux** using GitHub Actions:
- **Automatic Release on Tag**: Push a git tag formatted as `v*` (e.g., `v1.0.1`):
  ```bash
  git tag v1.0.1
  git push origin v1.0.1
  ```
- **Manual Trigger**: Run the `Release Pipeline` workflow directly from the **Actions** tab on GitHub with custom tag, draft, or pre-release options.
- **Automated Changelog**: Each release automatically aggregates commit changes and categorizes updates into Features, Fixes, and Improvements.

### 🛠️ Technology Stack
- **Desktop Shell**: Electron 32 (Chromium 128 / Node.js 20)
- **Frontend**: React 18, TypeScript (Strict Mode)
- **Bundler**: Vite 5 + vite-plugin-electron
- **Styling**: Vanilla CSS with modern HSL Design Tokens (Dark Cyber/Industrial Theme)
- **Icons**: Lucide Icons
- **Security**: ContextBridge with typed IPC and OS credential encryption (`safeStorage`)

---

<a id="-español"></a>
## 🇪🇸 Español

Una aplicación de escritorio multiplataforma (**macOS, Windows y Linux**) desarrollada con **Electron + React + TypeScript + Vite**, diseñada para administrar flotas de dispositivos Sipeed KVM, con enfoque principal en **NanoKVM Go** (y **Go+**), además de soporte para NanoKVM Lite, Full y USB.

### 🌟 Características Principales

1. **Soporte Multilingüe y Detección Automática del SO**:
   - Cambie fácilmente entre **Inglés (EN)**, **Español (ES)** y **Portugués (PT)** desde la esquina superior derecha de la pantalla o en Configuración.
   - Detección automática del idioma del sistema operativo anfitrión en el primer inicio.
   - Almacenamiento persistente del último idioma utilizado para sesiones futuras.

2. **Catálogo de Dispositivos y Conexión en 1 Clic**:
   - Guarde múltiples NanoKVM con nombres amigables, IP local o Tailscale MagicDNS (`device.ts.net`), puerto y credenciales cifradas con el llavero del SO (`safeStorage`).
   - Organización por Grupos y Entornos (*Datacenter*, *Banco de Lab*, *Dispositivos Móviles*, *Remoto*).
   - Función **Quick Connect** para acceso inmediato a cualquier KVM sin registrarlo previamente.
   - Importación y exportación del catálogo en formato JSON.

3. **Monitorización de Estado en Tiempo Real (Health Check)**:
   - Monitorización continua en segundo plano que comprueba conectividad, latencia en milisegundos y estado operativo (🟢 En Línea, 🟡 Degradado, 🔴 Desconectado).

4. **Múltiples Sesiones Activas Simultáneas**:
   - **Sistema de Pestañas**: Alterne entre sesiones activas al instante sin desconectar ni recargar la transmisión de vídeo.
   - **Cuadrícula Multi-View**: Supervise hasta 9 KVM al mismo tiempo en formatos **1x2** (lado a lado), **2x2** (4 pantallas) o **3x3**. Haga doble clic en cualquier cuadrante para enfocarlo.
   - **Ventanas Independientes (Pop-out)**: Separe cualquier sesión en una ventana independiente para configuraciones multimonitor.

5. **Modo Gaming y Soporte para Mandos / Joysticks**:
   - Detección de baja latencia para mandos USB o Bluetooth (Xbox, PlayStation DualSense/DualShock, Nintendo Switch Pro y mandos HID genéricos).
   - Calibración de zona muerta (deadzone) de analógicos en Configuración.
   - **Modo Pantalla Exclusiva**: Bloqueo de puntero (Pointer Lock) y de teclas del sistema (Keyboard Lock API) para jugar sin interrupciones.
   - **Atajo Personalizable de Salida**: Presione **`F11`** (configurable) para alternar el modo exclusivo con HUD superior discreto.

6. **Barra de Herramientas KVM Especializada (NanoKVM Go)**:
   - Macros con 1 clic: `Ctrl+Alt+Del`, `Win/Super`, `Cmd+Space` (Spotlight), `Alt+Tab`, `Cmd+Tab`, `TaskMgr`.
   - **Activación de Ratón iOS**: Botón dedicado para enviar clic derecho inicial y despertar el cursor HID en iPhone/iPad.
   - Captura de pantalla instantánea (copia al portapapeles y guarda en la carpeta de Imágenes).

### 🚀 Ejecución Local

#### Requisitos Previos
- Node.js 18+ (se recomienda Node.js 20 o 22)
- npm o yarn

#### Instalación y Modo Desarrollo
```bash
# Instalar dependencias
npm install

# Iniciar en modo desarrollo (Vite + Electron)
npm run dev
```

#### Validación y Tipado
```bash
# Comprobación de tipos con TypeScript
npm run typecheck

# Compilar frontend con Vite
npm run build:vite
```

#### Empaquetado para Escritorio
```bash
# Generar instalador para su sistema operativo actual
npm run build

# O compilar para sistemas operativos específicos
npm run build:mac    # macOS (.dmg y .zip para Apple Silicon e Intel)
npm run build:win    # Windows (instalador .exe de 64 bits)
npm run build:linux  # Linux (.AppImage y .deb)
```

#### 🚀 CI/CD y Releases Automáticas en GitHub
Los instaladores se compilan y publican automáticamente para **macOS, Windows y Linux** a través de GitHub Actions:
- **Publicación Automática por Tag**: Cree y suba una etiqueta git con formato `v*` (ej: `v1.0.1`):
  ```bash
  git tag v1.0.1
  git push origin v1.0.1
  ```
- **Disparador Manual**: Ejecute el flujo `Release Pipeline` directamente desde la pestaña **Actions** en GitHub con opciones de tag personalizado, borrador (draft) o versión previa.
- **Resumen Automático de Cambios**: Cada release genera automáticamente un registro de cambios agrupando funciones, correcciones y tareas de mantenimiento.


### 🛠️ Tecnologías Utilizadas
- **Shell de Escritorio**: Electron 32 (Chromium 128 / Node.js 20)
- **Frontend**: React 18, TypeScript (Modo Estricto)
- **Empaquetador**: Vite 5 + vite-plugin-electron
- **Estilos**: Vanilla CSS con Design Tokens HSL (Tema Dark Cyber/Industrial)
- **Iconos**: Lucide Icons
- **Seguridad**: ContextBridge con IPC tipado y cifrado nativo via `safeStorage`

---

<a id="-português"></a>
## 🇧🇷 Português

Um aplicativo desktop multiplataforma (**macOS, Windows e Linux**) desenvolvido com **Electron + React + TypeScript + Vite**, projetado para gerenciar frotas de dispositivos KVM da Sipeed, com foco inicial no modelo **NanoKVM Go** (e **Go+**), além de suporte para NanoKVM Lite, Full e USB.

### 🌟 Principais Recursos

1. **Suporte Multilíngue e Detecção Automática do SO**:
   - Alterne instantaneamente entre **Português (PT)**, **Inglês (EN)** e **Espanhol (ES)** pelo seletor no canto superior direito da tela ou no menu de Configurações.
   - Detecção automática do idioma configurado no sistema operacional do usuário na primeira inicialização.
   - Armazenamento persistente do último idioma selecionado para sessões futuras em `localStorage` e nas preferências do app.

2. **Catálogo de Dispositivos & Conexão em 1 Clique**:
   - Salve múltiplos NanoKVMs com nomes amigáveis, IP local ou Tailscale MagicDNS (`device.ts.net`), porta e credenciais criptografadas nativamente com o chaveiro do SO (`safeStorage`).
   - Organização flexível por Grupos e Ambientes (*Datacenter*, *Bancada Lab*, *Dispositivos Móveis*, *Remoto*).
   - Recurso **Quick Connect** para acesso imediato a qualquer KVM sem necessidade de cadastro prévio.
   - Importação e exportação de inventário em formato JSON.

3. **Monitoramento de Status em Tempo Real (Health Check)**:
   - Monitoramento contínuo em segundo plano que afere conectividade, latência em milissegundos e status operacional (🟢 Online, 🟡 Degradado/Alerta, 🔴 Offline).

4. **Múltiplas Conexões Ativas Simultâneas**:
   - **Sistema de Abas**: Alterne entre múltiplos KVMs instantaneamente sem desconectar ou recarregar a transmissão de vídeo.
   - **Mural em Grade (Multi-View Grid)**: Monitore até 9 KVMs ao mesmo tempo nos formatos **1x2** (lado a lado), **2x2** (4 telas) ou **3x3** (9 telas). Dê duplo clique em qualquer quadrante para expandi-lo.
   - **Janelas Destacadas (Pop-out)**: Destaque qualquer sessão para uma janela separada do Electron para uso em múltiplos monitores.

5. **Gaming Mode & Suporte a Joystick/Gamepad**:
   - Detecção em alta frequência de controles conectados via USB ou Bluetooth (Xbox, PlayStation DualSense/DualShock, Nintendo Switch Pro e genéricos HID).
   - Calibração de deadzone dos analógicos nas Configurações.
   - **Modo Tela Exclusiva**: Bloqueia a interceptação de teclas do navegador e do sistema operacional local com Pointer Lock e Keyboard Lock API, permitindo jogar sem interrupções de atalhos.
   - **Atalho Configurável de Saída**: Pressione **`F11`** (personalizável nas Configurações) para alternar o modo exclusivo, com HUD translúcido discreto de aviso.

6. **Barra de Ferramentas KVM Especializada (NanoKVM Go)**:
   - Macros de teclado com 1 clique: `Ctrl+Alt+Del`, `Win/Super`, `Cmd+Space` (Spotlight), `Alt+Tab`, `Cmd+Tab`, `TaskMgr`.
   - **Wake-up de Mouse iOS**: Botão específico para ativar o cursor HID no iPhone/iPad conectado ao NanoKVM Go através do envio do clique com botão direito inicial.
   - Captura de screenshot instantânea (copia para o clipboard e salva automaticamente na pasta de Imagens).

### 🚀 Como Executar Localmente

#### Pré-requisitos
- Node.js 18+ (recomendado Node.js 20 ou 22)
- npm ou yarn

#### Instalação e Execução em Modo de Desenvolvimento
```bash
# Instalar dependências
npm install

# Iniciar em modo de desenvolvimento (Vite + Electron)
npm run dev
```

#### Validação de Código e Tipagem
```bash
# Checagem de tipos estáticos TypeScript
npm run typecheck

# Compilar bundle de produção com Vite
npm run build:vite
```

#### Empacotamento de Executáveis Desktop
```bash
# Gerar instaladores para o seu sistema operacional atual
npm run build

# Ou compilar diretamente para sistemas operacionais específicos
npm run build:mac    # macOS (.dmg e .zip para Apple Silicon e Intel)
npm run build:win    # Windows (instalador NSIS .exe 64-bit)
npm run build:linux  # Linux (.AppImage e pacote .deb)
```

#### 🚀 CI/CD e Releases Automáticas no GitHub
As compilações e releases para **macOS, Windows e Linux** são geradas automaticamente pelo GitHub Actions:
- **Publicação Automática por Tag**: Crie e envie uma tag git no padrão `v*` (ex: `v1.0.1`):
  ```bash
  git tag v1.0.1
  git push origin v1.0.1
  ```
- **Disparo Manual**: Execute o workflow `Release Pipeline` pela aba **Actions** no GitHub com suporte a tag personalizada, rascunho (draft) e pré-lançamento.
- **Resumo Automático de Mudanças**: A release extrai o log de commits e organiza as novidades por Funcionalidades, Correções e Manutenção.


### 🛠️ Tecnologias Utilizadas
- **Shell Desktop**: Electron 32 (Chromium 128 / Node.js 20)
- **Frontend**: React 18, TypeScript (Strict Mode)
- **Bundler**: Vite 5 + vite-plugin-electron
- **Estilização**: Vanilla CSS com Design Tokens modernos HSL (Dark Cyber/Industrial Theme)
- **Ícones**: Lucide Icons
- **Segurança**: ContextBridge isolado com IPC tipado e senhas criptografadas via `safeStorage`
