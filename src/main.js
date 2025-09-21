const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let filamentData = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Start scanning for filament files
    scanForFilamentFiles();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Filter out harmless DevTools warnings
  mainWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('Autofill.enable') || 
        message.includes('Autofill.setAddresses') ||
        message.includes("'Autofill.enable' wasn't found") ||
        message.includes("'Autofill.setAddresses' wasn't found")) {
      // Don't log these harmless DevTools warnings
      return;
    }
  });
}

function getSlicerPaths() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  let basePath;
  switch (platform) {
    case 'darwin': // macOS
      basePath = path.join(homeDir, 'Library', 'Application Support');
      break;
    case 'win32': // Windows
      basePath = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
      break;
    case 'linux': // Linux
      basePath = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
      break;
    default:
      return [];
  }
  
  return [
    { name: 'BambuStudio', path: path.join(basePath, 'BambuStudio', 'user') },
    { name: 'OrcaSlicer', path: path.join(basePath, 'OrcaSlicer', 'user') }
  ];
}

async function scanForFilamentFiles() {
  try {
    updateStatus('Scanning for slicer directories...');
    
    const slicerPaths = getSlicerPaths();
    if (slicerPaths.length === 0) {
      updateStatus('Platform not supported');
      return;
    }

    let totalFilesFound = 0;
    let totalFilesLoaded = 0;
    let foundSlicers = [];

    // Check each slicer directory
    for (const slicer of slicerPaths) {
      if (fs.existsSync(slicer.path)) {
        foundSlicers.push(slicer.name);
        updateStatus(`Found ${slicer.name} directory, scanning for filament data...`);

        // Get all subdirectories in the user path
        const userSubdirs = fs.readdirSync(slicer.path, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name);

        // Look for filament/base in each subdirectory
        for (const subdir of userSubdirs) {
          const filamentBasePath = path.join(slicer.path, subdir, 'filament', 'base');
          
          if (fs.existsSync(filamentBasePath)) {
            const jsonFiles = fs.readdirSync(filamentBasePath)
              .filter(file => path.extname(file).toLowerCase() === '.json');
            
            totalFilesFound += jsonFiles.length;
            
            for (const jsonFile of jsonFiles) {
              const filePath = path.join(filamentBasePath, jsonFile);
              try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const jsonData = JSON.parse(fileContent);
                
                // Store in memory with a unique key including slicer name
                const key = `${slicer.name}/${subdir}/${jsonFile}`;
                filamentData[key] = {
                  ...jsonData,
                  _metadata: {
                    slicer: slicer.name,
                    subdirectory: subdir,
                    filename: jsonFile,
                    filePath: filePath
                  }
                };
                totalFilesLoaded++;
                
                //console.log(`Loaded filament data: ${key}`);
              } catch (parseError) {
                console.error(`Invalid JSON in file ${filePath}:`, parseError.message);
              }
            }
          }
        }
      }
    }

    if (foundSlicers.length === 0) {
      updateStatus('Scan complete - No slicer directories found');
    } else if (totalFilesFound === 0) {
      updateStatus(`Scan complete - Found ${foundSlicers.join(', ')} but no filament JSON files`);
    } else {
      updateStatus(`Scan complete - Loaded ${totalFilesLoaded} of ${totalFilesFound} filament files from ${foundSlicers.join(', ')}`);
    }

    // Send summary data to renderer for display
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('scan-complete', {
        totalFiles: totalFilesLoaded,
        foundSlicers: foundSlicers,
        filamentKeys: Object.keys(filamentData)
      });
    }

  } catch (error) {
    console.error('Error during filament scan:', error);
    updateStatus('Scan complete - Error occurred during scan');
  }
}

function updateStatus(message) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('status-update', message);
  }
}

// IPC handlers
ipcMain.handle('get-filament-data', () => {
  return filamentData;
});

ipcMain.handle('get-filament-count', () => {
  return Object.keys(filamentData).length;
});

ipcMain.handle('get-filament-summary', () => {
  const slicers = {};
  const summary = {
    totalFiles: Object.keys(filamentData).length,
    bySource: {},
    bySubdirectory: {},
    files: []
  };

  Object.keys(filamentData).forEach(key => {
    const data = filamentData[key];
    const metadata = data._metadata || {};
    const slicer = metadata.slicer || 'Unknown';
    const subdirectory = metadata.subdirectory || 'Unknown';

    // Count by slicer
    summary.bySource[slicer] = (summary.bySource[slicer] || 0) + 1;
    
    // Count by subdirectory
    const subKey = `${slicer}/${subdirectory}`;
    summary.bySubdirectory[subKey] = (summary.bySubdirectory[subKey] || 0) + 1;

    // Add file info
    summary.files.push({
      key: key,
      slicer: slicer,
      subdirectory: subdirectory,
      filename: metadata.filename || 'Unknown',
      hasName: !!(data.name || data.filament_id),
      name: data.name || data.filament_id || 'Unnamed'
    });
  });

  return summary;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Export filamentData for potential future use
module.exports = { filamentData };
