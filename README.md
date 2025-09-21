# BambuStudio & OrcaSlicer Filament Scanner

A cross-platform Electron application that scans for BambuStudio and OrcaSlicer filament JSON files and loads them into memory.

## Features

- Cross-platform support (macOS, Windows, Linux)
- Automatic detection of both BambuStudio and OrcaSlicer user directories
- Scans for filament JSON files in subdirectories
- Loads valid JSON files into memory as objects with metadata
- Simple status display UI with visual debug view
- Silent operation when directories/files not found
- Console logging for invalid JSON files
- Visual representation of loaded data for debugging

## Installation

1. Clone or extract the project files
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Building Distributables
```bash
npm run dist
```

## How it works

The application searches for slicer user directories in platform-specific locations:

### BambuStudio & OrcaSlicer paths:
- **macOS**: 
  - `~/Library/Application Support/BambuStudio/user`
  - `~/Library/Application Support/OrcaSlicer/user`
- **Windows**: 
  - `%APPDATA%/BambuStudio/user`
  - `%APPDATA%/OrcaSlicer/user`
- **Linux**: 
  - `~/.config/BambuStudio/user`
  - `~/.config/OrcaSlicer/user`

For each subdirectory found, it looks for the path `filament/base/` and loads all `.json` files found there into memory as JavaScript objects.

## Debug Features

- **Toggle Debug View**: Click the "Toggle Debug View" button to see a visual representation of loaded data
- **Summary View**: Shows file counts by slicer and subdirectory
- **Files Table**: Lists the first 20 loaded files with their metadata
- **Console Logging**: Double-click anywhere to log all data to console

## File Structure

```
src/
├── main.js        # Main Electron process
├── preload.js     # Preload script for secure IPC
└── index.html     # Renderer UI with debug view
package.json       # Project configuration
README.md         # This file
```

## Accessing Loaded Data

The filament data is stored in memory in the main process with additional metadata:

- **From renderer process**: 
  - `window.electronAPI.getFilamentData()` - Returns all data
  - `window.electronAPI.getFilamentSummary()` - Returns organized summary
- **From main process**: The `filamentData` object contains all loaded files
- **Console access**: Double-click the app window to log all data to console

### Data Structure

Each file is stored with a key format: `{SlicerName}/{subdirectory}/{filename.json}`

Each loaded object includes:
- Original JSON data from the file
- `_metadata` object containing:
  - `slicer`: "BambuStudio" or "OrcaSlicer"
  - `subdirectory`: The subdirectory name
  - `filename`: The original filename
  - `filePath`: Full path to the file

## Error Handling

- Missing slicer directories: App completes silently
- No JSON files found: App completes silently  
- Invalid JSON files: Logged to console with error details
- Other errors: Logged to console

## Development Notes

- Uses Electron's context isolation for security
- IPC communication between main and renderer processes
- Platform-specific path resolution for both slicers
- Graceful error handling throughout the scanning process
- Enhanced metadata tracking for better organization
- Visual debugging interface for easier development