# Field Day Logger - Release Notes

## Version 2.0.1 (Latest Updates)

### 🔧 Recent Improvements

#### ARRL Section & Division Updates
- **Corrected ARRL Division Assignments**: Updated all division mappings to match current ARRL structure
  - **Division 0**: CO, IA, KS, MN, MO, ND, NE, SD
  - **Division 1**: CT, EMA, ME, NH, RI, VT, WMA (New England)
  - **Division 2**: ENY, NLI, NNJ, NNY, SNJ, WNY (Hudson)
  - **Division 3**: DE, EPA, MDC, WPA (Atlantic)
  - **Division 4**: AL, GA, KY, NC, NFL, PR, SC, SFL, TN, VA, VI, WCF (Southeast)
  - **Division 5**: AR, LA, MS, NM, NTX, OK, STX, WTX (West Gulf)
  - **Division 6**: EB, LAX, ORG, PAC, SB, SCV, SDG, SF, SJV, SV (Pacific)
  - **Division 7**: AK, AZ, EWA, ID, MT, NV, OR, UT, WWA, WY (Northwestern)
  - **Division 8**: MI, OH (Great Lakes)
  - **Division 9**: IL, IN, WI (Central)
  - **Canada**: AB, BC, GTA, MAR, MB, NL, NT, ONE, ONN, ONS, QC, SK
  - **DX**: DX
- **Section Code Corrections**: Fixed section assignments including WCF and NM
- **Removed Duplicate Assignments**: Eliminated WV appearing in multiple divisions

#### Electron Offline Improvements
- **Eliminated Network Fetch Errors**: Fixed "Failed to fetch" errors in Electron mode
- **Full Offline Operation**: Electron app now operates completely offline using local file storage
- **Skip Server API Calls**: QSO sync and message functions automatically detect Electron environment
- **Local File Storage Priority**: All data operations use local storage in Electron mode
- **Improved Console Output**: Better logging for debugging and status monitoring

#### Development & Testing Improvements
- **Test Script Organization**: Moved development test scripts to separate `test-scripts/` folder
- **Cleaner Repository**: Development test scripts now ignored by git to reduce repository clutter
- **Maintained Unit Tests**: Proper unit tests remain in `tests/unit/` for continuous integration

### 🐛 Bug Fixes
- **Fixed WV Section Assignment**: Corrected West Virginia assignment to Division 4 only
- **Section Map Display**: Updated section progress and map components with correct divisions
- **Achievement System**: Division completion notifications now use correct section assignments
- **Network Sync**: Eliminated unnecessary network calls in Electron standalone mode

---

## Version 2.0.0 (Current)

### 🎉 Major Release - Complete Overhaul

This release represents a complete modernization of the Field Day Logger with significant improvements to reliability, usability, and functionality.

### 🔥 Breaking Changes

- **Storage Migration**: Migrated from localStorage to file-based storage system
  - QSOs now stored in `shared-qsos.json` for better persistence and sharing
  - All user data will need to be re-entered or imported from backup
- **Network Configuration**: Standardized all instances to use port 8080
  - Simplified setup eliminates port configuration complexity
  - Auto-discovery works seamlessly across local networks
- **HTTPS Required**: All network communication now uses HTTPS with self-signed certificates
  - Enhanced security for Field Day operations
  - May require browser security exception acceptance

### ✨ New Features

#### Multi-Station Messaging System
- **Broadcast Messages**: Send announcements to all connected stations
- **Message Types**: Regular messages and important announcements with visual distinction
- **Real-Time Sync**: Messages propagate instantly across all stations
- **Message History**: View latest 5 messages with sender and timestamp information
- **GUID Deduplication**: Prevents duplicate messages across network

#### Advanced Statistics & Analytics
- **Statistics Modal**: Comprehensive QSO analytics with interactive charts
  - QSOs over time with hourly breakdown
  - Top operator performance metrics
  - Band and mode distribution analysis
  - Station activity timeline
- **Real-Time Updates**: All statistics update automatically as QSOs are added
- **Full-Screen Experience**: Statistics modal uses entire screen for detailed analysis

#### Achievement & Notification System
- **Smart Notifications**: Automatic alerts for important milestones
  - Division completions (e.g., "PHONE 1 just completed out New England!")
  - Multiplier achievements
  - Bonus point opportunities
- **Trophy Indicators**: Visual trophies appear for completed divisions
- **System Integration**: Achievements automatically broadcast to all stations

#### Enhanced Network Operations
- **Connected Station Counter**: Header shows number of connected stations in real-time
- **Improved Discovery**: More reliable station detection and connection
- **Robust Sync**: Enhanced QSO synchronization with conflict resolution
- **Network Health**: Better connection status indicators and error handling

#### User Interface Improvements
- **Header Consistency**: All panels now have matching header styles and button layouts
- **Responsive Design**: Better mobile and tablet support
- **Theme Enhancements**: Improved dark theme with better contrast and readability
- **Section Map Improvements**: 
  - Standardized section tag heights for consistent appearance
  - Aligned progress bars at bottom of division boxes
  - Visual hierarchy improvements with blue accent lines

#### Documentation & Help System
- **In-App Documentation**: Built-in help system accessible via F1 or ? button
- **Markdown Rendering**: Rich documentation with proper formatting
- **Context-Sensitive Help**: Help content relevant to current functionality
- **User Guides**: Comprehensive guides for setup, networking, and operations

#### Data Management Overhaul
- **System Data vs Reporting**: Reorganized import/export into logical categories
  - System Data: QSO backups, configuration, station settings
  - Reporting: ADIF exports, Cabrillo format, duplicate sheets
- **Enhanced Export Formats**: 
  - Cabrillo contest format export
  - Duplicate contact sheet generation
  - Improved ADIF compatibility
- **Backup & Restore**: Simplified backup and restoration workflows

### 🔧 Technical Improvements

#### Storage & Persistence
- **File-Based Architecture**: Eliminated browser storage dependencies
- **Cross-Instance Sharing**: Multiple server instances automatically share data
- **Automatic Persistence**: QSOs saved immediately with no data loss risk
- **File Watching**: Real-time detection of external file changes

#### Network & Security
- **HTTPS Implementation**: Self-signed certificate support for secure local networks
- **Standardized Ports**: All instances use port 8080 for simplified configuration
- **Connection Resilience**: Better handling of network interruptions and reconnections
- **Protocol Improvements**: More efficient data synchronization

#### Performance & Reliability
- **TypeScript Migration**: Improved type safety and development experience
- **Modern Build System**: Vite-based build for faster development and smaller bundles
- **Memory Management**: Better resource usage and cleanup
- **Error Handling**: Comprehensive error catching and user feedback

#### Cross-Platform Support
- **Electron Integration**: Native desktop application support
- **Build Pipeline**: Automated cross-platform building and packaging
- **Installer Creation**: Windows installer with proper application registration
- **GitHub Actions**: Automated CI/CD pipeline for releases

### 🐛 Bug Fixes

- **QSO Synchronization**: Fixed duplicate QSO issues and sync conflicts
- **Contact Numbering**: Resolved sequential numbering problems across stations
- **Theme Switching**: Fixed theme persistence and dark mode display issues
- **Network Discovery**: Improved reliability of station discovery and connection
- **Form Validation**: Better input validation and error messaging
- **Memory Leaks**: Resolved various memory management issues
- **UI Consistency**: Fixed layout and styling inconsistencies across components

### 🛠 Developer Experience

- **Automated Testing**: Comprehensive test suite for UI and functionality
- **Build Automation**: Streamlined build and release processes
- **Code Quality**: Improved linting, formatting, and code organization
- **Documentation**: Enhanced inline documentation and README files
- **Debugging Tools**: Better development and debugging capabilities

### 📋 Migration Guide

#### From Version 1.x

1. **Backup Your Data**: Export all QSOs and configuration before upgrading
2. **Fresh Installation**: Recommended to start with clean installation
3. **Data Import**: Use the new System Data import to restore QSOs
4. **Network Reconfiguration**: Update network settings for new port 8080 standard
5. **Certificate Acceptance**: Accept browser security warnings for HTTPS

#### Configuration Changes

- **Network Settings**: All instances now default to port 8080
- **Storage Location**: QSOs now stored in `shared-qsos.json` file
- **Theme Settings**: Theme preferences saved in new configuration format
- **Station Identity**: Station information now part of comprehensive configuration

### 🔮 Known Issues

- **Browser Security Warnings**: HTTPS with self-signed certificates may trigger warnings
- **First-Time Setup**: Initial certificate acceptance required for network features
- **Large QSO Files**: Very large QSO counts (>10,000) may impact performance
- **Mobile Interface**: Some advanced features work better on desktop/tablet

### 🎯 Upcoming Features

- **Contest Integration**: Support for other contest formats beyond Field Day
- **Advanced Filtering**: Enhanced QSO search and filtering capabilities
- **Cloud Backup**: Optional cloud storage integration for backup
- **Mobile App**: Native mobile application development
- **Plugin System**: Extensible architecture for custom features

---

## Version 1.x (Legacy)

### Key Features
- Basic QSO logging with localStorage persistence
- Simple network synchronization
- ARRL Field Day scoring
- Basic duplicate detection
- Light/dark theme support

### Limitations
- Browser-dependent storage
- Manual port configuration required
- Limited multi-station capabilities
- Basic user interface
- No messaging system

---

## Getting Started

For complete setup and usage instructions, see:
- **[README.md](README.md)** - Quick start and overview
- **[BUILD.md](BUILD.md)** - Building and distribution
- **[In-App Help](public/docs/README.md)** - Detailed user guide (F1 in application)

## Support

For issues, questions, or contributions:
- GitHub Issues: Report bugs and request features
- Documentation: Comprehensive help available in-app
- Community: Share experiences and get help from other Field Day operators
