# Field Day Logger

A modern, offline-capable Field Day logging application built with Vue.js, TypeScript, and Electron for ARRL Field Day operations.

## Key Features

- **🌐 Offline Operation**: Works completely without internet access for remote Field Day locations
- **🔄 Multi-Station Sync**: Real-time QSO synchronization across multiple logging stations
- **📊 Live Statistics**: Real-time scoring, progress tracking, and analytics
- **💬 Station Messaging**: Send messages and announcements between all connected stations
- **🏆 Achievement Tracking**: Automatic notifications for divisions, multipliers, and bonuses
- **📁 File-Based Storage**: Robust data persistence with shared QSO files
- **🔒 HTTPS Security**: Secure connections with self-signed certificates
- **🎨 Modern UI**: Beautiful, responsive interface with light/dark theme support
- **📱 Cross-Platform**: Runs as web app or standalone Electron application

## Documentation

- **[Build Instructions](BUILD.md)** - Complete build and distribution guide
- **[In-App Help](public/docs/README.md)** - User guide accessible via F1 or ? button
- **[Release Notes](RELEASE-NOTES.md)** - Latest features, fixes, and version history

## Quick Start

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd field-day

# Install dependencies
npm install

# Start development server
npm run dev
```

Access the application at `https://localhost:8080`

### Production Build
```bash
# Build web application
npm run build

# Preview production build
npm run serve

# Build Electron desktop app
npm run electron:build
```

### Testing
```bash
npm run test           # Run all tests (unit + UI validation)
npm run test:unit      # Run unit tests only
npm run test:ui        # Run UI validation tests
npm run test:pipeline  # Run complete test pipeline
npm run lint           # Check code style
```

## Network Setup for Field Day

Field Day operations typically involve multiple logging stations. This application makes multi-station setup simple:

### Single Station
1. Start the application: `npm run dev`
2. Access at `https://localhost:8080`
3. Begin logging QSOs

### Multi-Station Network
1. **All Stations**: Start app, mesh networking is automatic
2. **Backend Service**: Runs on port 3030 and handles station discovery
3. **Frontend Service**: Runs on port 8080 and displays discovered stations
4. All QSOs, messages, and scores sync automatically in real-time via mesh discovery

### Quick Scripts
```bash
# Windows
start-station.bat "W3AO" "2A" 

# Linux/Mac  
./start-station.sh "W3AO" "2A"
```

## Architecture

### Storage System
- **File-Based Persistence**: QSOs stored in `shared-qsos.json` for cross-instance sharing
- **Real-Time Sync**: Automatic file watching and synchronization
- **No Browser Dependencies**: Eliminated localStorage for improved reliability

### Network Protocol
- **HTTPS Only**: Self-signed certificates for secure local network communication
- **Port 8080**: Standardized port for all instances simplifies Field Day setup
- **Auto-Discovery**: Scans local network to find other logging stations
- **Heartbeat Sync**: Regular QSO and message synchronization between stations

### Modern Stack
- **Vue 3**: Modern reactive frontend framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build system and dev server
- **Electron**: Cross-platform desktop application
- **SCSS**: Advanced styling with theme support

## Features in Detail

### QSO Management
- **Smart Entry Forms**: Auto-complete for callsigns, sections, and exchanges
- **Duplicate Detection**: Real-time checking across all connected stations
- **Band/Mode Tracking**: Complete logging with power and antenna information
- **Contact Numbering**: Sequential numbering maintained across all stations

### Scoring & Progress
- **Live Scoring**: Real-time point calculation and multiplier tracking
- **Section Progress**: Visual map showing contacted ARRL sections
- **Statistics**: Comprehensive analytics with graphs and breakdowns
- **Bonus Points**: Easy bonus claim tracking with validation

### Station Messaging
- **Broadcast Messages**: Send announcements to all connected stations
- **Achievement Notifications**: Automatic alerts for milestones and completions
- **Message History**: View latest messages with timestamps and sender info
- **Real-Time Delivery**: Messages sync instantly across all stations

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile screens
- **Theme Support**: Light and dark modes with user preference
- **Keyboard Shortcuts**: Efficient operation with hotkeys (F1 for help, etc.)
- **Material Design**: Clean, modern interface following Material Design principles

## Development

### Project Structure
```
field-day/
├── src/                    # Source code
│   ├── components/         # Vue components
│   ├── services/          # Business logic and API clients
│   ├── store/             # Pinia state management
│   ├── views/             # Page-level components
│   ├── assets/            # Static resources and styles
│   ├── api/               # API server implementation
│   ├── background/        # Background services
│   ├── constants/         # Application constants
│   └── router/            # Vue Router configuration
├── public/                # Static assets
│   ├── docs/              # User documentation
│   └── fonts/             # Icon fonts and typography
├── tests/                 # Test scripts and utilities
│   └── unit/              # Unit test specifications
├── installer/             # Electron installer configuration
├── electron-main.js       # Electron main process
├── package.json           # Dependencies and scripts
├── BUILD.md              # Build and distribution guide
└── README.md             # This file
```

### Key Services
- **FileStorageService**: Handles all data persistence and file operations
- **NetworkService**: Manages station discovery and QSO synchronization
- **AchievementService**: Tracks and announces milestones and bonuses
- **ApiServer**: Provides HTTP endpoints for network communication

### Technology Stack
- **Frontend**: Vue.js 3 with TypeScript and Composition API
- **Build System**: Vite with hot module replacement
- **Desktop**: Electron for cross-platform native applications
- **Styling**: SCSS with Material Design principles
- **Testing**: Mocha for unit tests, custom validation for integration
- **Security**: HTTPS with self-signed certificates for network sync

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run tests: `npm run test`
5. Submit a pull request

## License

This project is open source and available under the MIT License.
