const { app, BrowserWindow, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Desktop app defaults - auto-setup, admin credentials
process.env.REQUIRE_SETUP = 'false';
if (!process.env.ADMIN_EMAIL) process.env.ADMIN_EMAIL = 'admin@jcbtracker.com';
if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = 'admin123';

// Log all uncaught errors to a file
function getLogPath() {
    try { return path.join(app.getPath('userData'), 'crash.log'); } catch (_) { return 'crash.log'; }
}
process.on('uncaughtException', (err) => {
    try { fs.writeFileSync(getLogPath(), new Date().toISOString() + ' UNCAUGHT: ' + (err && err.stack ? err.stack : String(err)) + '\n'); } catch (_) {}
});
process.on('unhandledRejection', (err) => {
    try { fs.appendFileSync(getLogPath(), new Date().toISOString() + ' REJECTION: ' + (err && err.stack ? err.stack : String(err)) + '\n'); } catch (_) {}
});

const { createServer } = require('./server');

let mainWindow = null;
let tray = null;
let serverInstance = null;
let serverPort = 3000;

function findAvailablePort(startPort) {
    const net = require('net');
    return new Promise((resolve) => {
        const srv = net.createServer();
        const timeout = setTimeout(() => { srv.close(); resolve(startPort); }, 3000);
        srv.listen(startPort, '127.0.0.1', () => {
            clearTimeout(timeout);
            const port = srv.address().port;
            srv.close(() => resolve(port));
        });
        srv.on('error', () => {
            clearTimeout(timeout);
            resolve(findAvailablePort(startPort + 1));
        });
    });
}

async function startServer() {
    try {
        serverPort = await findAvailablePort(parseInt(process.env.JCB_PORT || '3000', 10));
        console.log('[Desktop] Port bulundu:', serverPort);
        const { server } = await createServer();
        console.log('[Desktop] Server olusturuldu');

        serverInstance = server;
        server.listen(serverPort, '127.0.0.1', () => {
            console.log(`[Desktop] Sunucu baslatildi: http://localhost:${serverPort}`);
            createWindow();
        });
        server.on('error', (err) => {
            console.error('[Desktop] Server listen error:', err);
        });
    } catch (err) {
        console.error('[Desktop] Sunucu hatasi:', err);
        dialog.showErrorBox('Sunucu Hatasi', 'JCB Tracker baslatilamadi: ' + (err && err.message));
        app.quit();
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'JCB Tracker',
        icon: path.join(__dirname, '../public/favicon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false
    });

    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('close', (event) => {
        // Minimize to tray instead of closing
        if (tray) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    createTray();
}

function createTray() {
    // Create a simple 16x16 tray icon
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'JCB Tracker\'i Ac',
            click: () => {
                if (mainWindow) mainWindow.show();
                else createWindow();
            }
        },
        { type: 'separator' },
        {
            label: 'Cikis',
            click: () => {
                tray = null;
                if (serverInstance) serverInstance.close();
                app.quit();
            }
        }
    ]);

    tray.setToolTip('JCB Tracker');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) mainWindow.show();
        else createWindow();
    });
}

app.whenReady().then(startServer);

app.on('window-all-closed', (event) => {
    // Don't quit on window close (tray stays)
    event.preventDefault();
});

app.on('activate', () => {
    if (mainWindow === null && serverInstance) {
        createWindow();
    }
});

app.on('before-quit', () => {
    tray = null;
    if (serverInstance) serverInstance.close();
});
