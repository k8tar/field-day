# K8TAR Field Day Logger - User Documentation

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Main Screen Overview](#main-screen-overview)
3. [QSO Entry Form](#qso-entry-form)
4. [Recent Contacts](#recent-contacts)
5. [Score Statistics](#score-statistics)
6. [Station Information](#station-information)
7. [Possible Duplicates](#possible-duplicates)
8. [Section Progress & Map](#section-progress--map)
9. [Network Configuration](#network-configuration)
10. [Station Configuration](#station-configuration)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

The K8TAR Field Day Logger is designed for ARRL Field Day operations, allowing multiple stations to log QSOs and sync data in real-time.

### Quick Start
1. **Launch the application** - The logger opens directly to the main logging screen
2. **Configure your station** - Click the settings icon to set your callsign and station designator
3. **Connect to network** - Use the network icon to connect multiple stations
4. **Start logging** - Enter callsigns in the QSO Entry Form and press Enter to log contacts

---

## 🖥️ Main Screen Overview

The main screen is organized into functional areas for efficient Field Day operations:

```
┌─────────────────── Header ──────────────────┐
│  Station Info  │  Mode/Band/Op  │  Network   │
├────────────────┼───────────────┼─────────────┤
│ Recent Contacts                │ Score Stats │
├────────────────┼───────────────┼─────────────┤
│ Station Info   │               │             │
├────────────────┤               │             │
│ QSO Entry Form │               │             │
├────────────────┤  Section      │             │
│ Possible Dupes │  Progress     │             │
├────────────────┤               │             │
│ Messages       │               │             │
└────────────────┴───────────────┴─────────────┘
```

### Header Controls
- **Station Designator**: Shows your current station (e.g., "K8TAR")
- **Mode Selection**: Choose PH (Phone), CW, or DIG (Digital)
- **Band Selection**: Select operating band (160m-2m)
- **Operator Selection**: Choose current operator
- **Network Status**: Shows connection status (WiFi icon)
- **Settings**: Access station configuration
- **Theme Toggle**: Switch between light/dark themes

---

## 📝 QSO Entry Form

The heart of the logging operation - designed for fast, accurate contact entry.

### Fields
- **Call**: Station callsign (auto-converts to uppercase)
- **Class**: Field Day class (1A, 2A, etc.)
- **Section**: ARRL section (automatically suggested)
- **Band**: Operating band (inherited from header)
- **Mode**: Operating mode (inherited from header)

### Usage
1. **Enter callsign** in the Call field
2. **Tab or click** to move to Class field
3. **Enter class** (e.g., "2A")
4. **Tab to Section** and enter section (e.g., "OH")
5. **Press Enter** or click "Log QSO" to save

### Smart Features
- **Duplicate Detection**: Automatically checks for duplicates
- **Section Validation**: Validates ARRL sections
- **Auto-Completion**: Suggests previously worked stations
- **Quick Entry**: Press Enter from any field to log

---

## 📞 Recent Contacts

Displays the most recent QSOs in chronological order.

### Information Shown
- **Callsign**: Station worked
- **Class/Section**: Field Day exchange received
- **Band/Mode**: Operating parameters
- **Time**: When the contact was made
- **Operator**: Who made the contact

### Features
- **Real-time Updates**: New QSOs appear immediately
- **Scroll View**: Shows last 50 contacts
- **Network Sync**: Updates from all connected stations
- **Color Coding**: Different modes may have different colors

---

## 🏆 Score Statistics

Real-time scoring information for your Field Day operation.

### Metrics Displayed
- **Total QSOs**: Number of contacts made
- **Total Score**: Points earned (CW/Digital = 2pts, Phone = 1pt)
- **QSOs by Band**: Breakdown per band
- **QSOs by Mode**: Breakdown per mode
- **Sections Worked**: Unique ARRL sections contacted
- **Rate Information**: QSOs per hour

### Scoring Rules
- **Phone Contacts**: 1 point each
- **CW Contacts**: 2 points each
- **Digital Contacts**: 2 points each
- **Multipliers**: Each ARRL section counts once per band

---

## 🎛️ Station Information

Shows current station configuration and status.

### Information Displayed
- **Station Callsign**: Your Field Day callsign
- **Station Designator**: Your station role (e.g., "PHONE 1")
- **Current Operator**: Who is currently operating
- **Network Status**: Connection status to other stations
- **Software Version**: Logger version information

### Configuration
Click the settings icon in the header to modify:
- Station callsign
- Station designator
- Operator list
- Network settings

---

## ⚠️ Possible Duplicates

Automatically detects potential duplicate QSOs as you type.

### Detection Logic
- **Same callsign** on the **same band**
- Checks all modes (phone, CW, digital are separate)
- Shows matching QSOs with details

### Display Information
- **Previous QSO**: When and how you worked them before
- **Band/Mode**: What band and mode was used
- **Class/Section**: What exchange was received
- **Action Options**: Add anyway or skip

### Best Practices
- **Review carefully**: Ensure it's actually a duplicate
- **Check time**: Field Day allows re-working after time interval
- **Verify exchange**: Class/section might have changed

---

## 🗺️ Section Progress & Map

Track your progress working all ARRL sections.

### Section Progress Panel
- **Visual Grid**: Shows all ARRL sections
- **Color Coding**: 
  - Green = Worked
  - Red = Not worked
  - Yellow = Worked on some bands
- **Click to View**: Click any section for details

### Section Map Modal
- **Interactive Map**: Visual representation of sections
- **Regional Organization**: Sections grouped by region
- **Progress Tracking**: See which regions need work
- **Strategic Planning**: Identify areas to focus on

---

## 🌐 Network Configuration

Connect multiple stations for real-time data synchronization.

### Network Modes
- **Host Mode**: Create a network for others to join
- **Client Mode**: Connect to an existing network

### Setup Process
1. **Click network icon** in header
2. **Choose mode**: Host or Join
3. **Host**: Click "Start Hosting" - others can connect to your IP
4. **Client**: Enter host IP address and click "Connect"

### Network Features
- **Real-time Sync**: QSOs sync between all stations
- **Automatic Discovery**: Stations appear when discovered
- **Heartbeat Monitoring**: Detects connection issues
- **Secure HTTPS**: Encrypted communication between stations

### Status Indicators
- **Connected**: Green WiFi icon
- **Disconnected**: Red WiFi icon with slash
- **Searching**: Animated WiFi icon

---

## ⚙️ Station Configuration

Configure your station settings for Field Day operation.

### Configuration Options

#### Station Information
- **Callsign**: Your Field Day callsign (e.g., "K8TAR")
- **Designator**: Station role (e.g., "PHONE 1", "CW", "DIGITAL")

#### Operators
- **Add Operators**: List all operators for the event
- **Remove Operators**: Clean up the list
- **Current Operator**: Select who is currently operating

#### Network Settings
- **Port**: Fixed at 8080 for consistency
- **Discovery**: Enable/disable automatic station discovery
- **Sync Settings**: Configure data synchronization options

### Access Configuration
- Click the **settings icon** (gear) in the header
- Make changes in the modal dialog
- Click **Save** to apply changes

---

## ⌨️ Keyboard Shortcuts

Optimize your logging speed with keyboard shortcuts.

### QSO Entry
- **Tab**: Move to next field
- **Shift+Tab**: Move to previous field
- **Enter**: Log the QSO (from any field)
- **Escape**: Clear the form

### Navigation
- **Ctrl+N**: Focus on callsign field
- **Ctrl+S**: Open settings
- **Ctrl+M**: Toggle network modal
- **F1**: Open help documentation

### Quick Actions
- **Space**: In callsign field, convert to uppercase
- **Ctrl+D**: View duplicates for current callsign
- **Ctrl+L**: View last 10 QSOs

---

## 🔧 Troubleshooting

Common issues and solutions.

### Connection Issues
**Problem**: Cannot connect to other stations
**Solutions**:
- Verify both stations are on the same network
- Check firewall settings (port 8080 must be open)
- Ensure HTTPS certificates are accepted
- Try restarting both applications

### Sync Issues
**Problem**: QSOs not appearing on other stations
**Solutions**:
- Check network connection status
- Verify heartbeat is active (watch console logs)
- Try disconnecting and reconnecting
- Restart the application if needed

### Performance Issues
**Problem**: Application running slowly
**Solutions**:
- Check for large numbers of QSOs (>1000)
- Clear browser cache
- Close other applications
- Restart the logger

### Data Issues
**Problem**: Missing or incorrect QSOs
**Solutions**:
- Check file storage integrity
- Verify network sync is working
- Look at console logs for errors
- Back up data files regularly

### Browser Issues
**Problem**: Application not loading properly
**Solutions**:
- Use a modern browser (Chrome, Firefox, Safari)
- Enable JavaScript
- Accept HTTPS certificates
- Clear browser cache

---

## 📊 Data Management

Understanding how your data is stored and managed.

### File Storage
- **Local Storage**: QSOs saved to local files automatically
- **Shared Storage**: Network sync maintains shared QSO database
- **Backup Files**: Automatic backup creation
- **Export Options**: Data can be exported for other applications

### Data Sync
- **Real-time**: Changes sync immediately between stations
- **Conflict Resolution**: Handles simultaneous entries
- **Network Recovery**: Restores sync after disconnections
- **Data Integrity**: Checksums verify data accuracy

---

## 🆘 Getting Help

When you need assistance:

1. **Check this documentation** for answers to common questions
2. **View console logs** (F12 in browser) for error messages
3. **Test network connectivity** using the diagnostic tools
4. **Contact K8TAR** for technical support

### Support Information
- **Software**: K8TAR Field Day Logger v1.0.0
- **Platform**: Web-based application
- **Requirements**: Modern web browser, network connectivity
- **Documentation**: Always available via Help link

---

*Last updated: July 2025*
