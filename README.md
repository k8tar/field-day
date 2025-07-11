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

- **[Build Instructions](BUILD.md)** - How to build and distribute the application
- **[In-App Help](public/docs/README.md)** - User guide and feature documentation (accessible via F1 or ? button)
- **[Release Notes](RELEASE-NOTES.md)** - Latest features, fixes, and changes

## Quick Start

### Development Setup
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
npm run preview
```

### Electron App
```bash
npm run electron:dev    # Development
npm run electron:build  # Build executable
```

### Testing
```bash
npm run test           # Run unit tests
npm run test:ui        # Run UI automation tests
npm run lint           # Check code style
```

## Network Setup for Field Day

Field Day operations typically involve multiple logging stations. This application makes multi-station setup simple:

### Single Station
1. Start the application: `npm run dev`
2. Access at `https://localhost:8080`
3. Begin logging QSOs

### Multi-Station Network
1. **Host Station**: Start app, click Network icon, select "Host"
2. **Additional Stations**: Start app, click Network icon, select "Auto" for discovery
3. All QSOs, messages, and scores sync automatically in real-time

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
src/
├── components/          # Vue components
├── services/           # Business logic and API clients  
├── store/              # Pinia state management
├── views/              # Page-level components
├── assets/             # Static resources
└── router/             # Vue Router configuration

tests/                  # Test scripts and utilities
public/                 # Static assets and documentation
installer/              # Electron installer configuration
```

### Key Services
- **FileStorageService**: Handles all data persistence
- **NetworkService**: Manages station discovery and synchronization
- **AchievementService**: Tracks and announces milestones
- **WebSocketSync**: Real-time communication between stations

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Run tests: `npm run test`
5. Submit a pull request

## License

This project is open source and available under the MIT License.
