const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let db = null;
let SQL = null;

function getDbPath() {
    const dataDir = process.env.JCB_DATA_DIR || path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    return path.join(dataDir, 'jcb_tracker.db');
}

async function connect() {
    if (db) return db;
    SQL = await initSqlJs();
    const dbPath = getDbPath();
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }
    db.run('PRAGMA foreign_keys = ON');
    return db;
}

function getDb() {
    if (!db) throw new Error('Database not initialized. Call connect() first.');
    return db;
}

function saveDb() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(getDbPath(), buffer);
}

function close() {
    if (db) {
        saveDb();
        db.close();
        db = null;
    }
}

function initSchema() {
    const db = getDb();

    // Migration helper: add column if not exists
    function migrateAddColumn(table, column, definition) {
        try {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        } catch (e) {
            // Column already exists, ignore
        }
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS tenants (
            _id TEXT PRIMARY KEY,
            companyName TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            contactEmail TEXT,
            contactPhone TEXT,
            address TEXT,
            taxNumber TEXT,
            licenseType TEXT DEFAULT 'trial',
            deviceLimit INTEGER DEFAULT 10,
            userLimit INTEGER DEFAULT 5,
            activatedAt TEXT,
            expiresAt TEXT,
            isActive INTEGER DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
            _id TEXT PRIMARY KEY,
            tenantId TEXT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            isSuperAdmin INTEGER DEFAULT 0,
            isActive INTEGER DEFAULT 1,
            permissions TEXT DEFAULT '{}',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (tenantId) REFERENCES tenants(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenantId);

        CREATE TABLE IF NOT EXISTS devices (
            _id TEXT PRIMARY KEY,
            tenantId TEXT,
            deviceId TEXT UNIQUE NOT NULL,
            name TEXT,
            imei TEXT,
            simCardNumber TEXT,
            vehiclePlate TEXT,
            vehicleType TEXT,
            groupName TEXT,
            firmwareVersion TEXT DEFAULT '1.0.0',
            apiKey TEXT,
            lastLatitude REAL DEFAULT 0,
            lastLongitude REAL DEFAULT 0,
            lastSpeed REAL DEFAULT 0,
            lastIgnition INTEGER DEFAULT 0,
            lastBatteryLevel REAL DEFAULT 100,
            lastFuelLevel REAL DEFAULT 100,
            lastEngineHours REAL DEFAULT 0,
            lastUpdate TEXT,
            status TEXT DEFAULT 'offline',
            isOnline INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (tenantId) REFERENCES tenants(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_devices_tenant ON devices(tenantId);
        CREATE INDEX IF NOT EXISTS idx_devices_deviceId ON devices(deviceId);

        CREATE TABLE IF NOT EXISTS location_logs (
            _id TEXT PRIMARY KEY,
            deviceId TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            speed REAL DEFAULT 0,
            ignition INTEGER DEFAULT 0,
            batteryLevel REAL DEFAULT 0,
            fuelLevel REAL DEFAULT 0,
            engineHours REAL DEFAULT 0,
            timestamp TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (deviceId) REFERENCES devices(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_location_device ON location_logs(deviceId);
        CREATE INDEX IF NOT EXISTS idx_location_ts ON location_logs(timestamp);

        CREATE TABLE IF NOT EXISTS alerts (
            _id TEXT PRIMARY KEY,
            deviceId TEXT NOT NULL,
            tenantId TEXT,
            type TEXT NOT NULL,
            severity TEXT DEFAULT 'info',
            message TEXT,
            acknowledged INTEGER DEFAULT 0,
            acknowledgedBy TEXT,
            acknowledgedAt TEXT,
            timestamp TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (deviceId) REFERENCES devices(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(deviceId);
        CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenantId);

        CREATE TABLE IF NOT EXISTS anomaly_logs (
            _id TEXT PRIMARY KEY,
            deviceId TEXT NOT NULL,
            type TEXT NOT NULL,
            severity TEXT DEFAULT 'medium',
            description TEXT,
            acknowledged INTEGER DEFAULT 0,
            acknowledgedBy TEXT,
            acknowledgedAt TEXT,
            createdAt TEXT NOT NULL,
            FOREIGN KEY (deviceId) REFERENCES devices(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_anomaly_device ON anomaly_logs(deviceId);

        CREATE TABLE IF NOT EXISTS driver_logs (
            _id TEXT PRIMARY KEY,
            deviceId TEXT NOT NULL,
            driverName TEXT,
            driverId TEXT,
            vehiclePlate TEXT,
            startTime TEXT,
            endTime TEXT,
            startOdometer REAL DEFAULT 0,
            endOdometer REAL DEFAULT 0,
            startLocation TEXT,
            endLocation TEXT,
            notes TEXT,
            distance REAL DEFAULT 0,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (deviceId) REFERENCES devices(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_driver_device ON driver_logs(deviceId);

        CREATE TABLE IF NOT EXISTS geofences (
            _id TEXT PRIMARY KEY,
            tenantId TEXT,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'circle',
            coordinates TEXT NOT NULL,
            color TEXT DEFAULT '#ff4444',
            radius REAL DEFAULT 100,
            enabled INTEGER DEFAULT 1,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (tenantId) REFERENCES tenants(_id)
        );
        CREATE INDEX IF NOT EXISTS idx_geofence_tenant ON geofences(tenantId);

        CREATE TABLE IF NOT EXISTS license_activations (
            _id TEXT PRIMARY KEY,
            activationKey TEXT UNIQUE NOT NULL,
            licenseType TEXT DEFAULT 'standard',
            isUsed INTEGER DEFAULT 0,
            activatedBy TEXT,
            activatedAt TEXT,
            expiresAt TEXT,
            createdAt TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_license_key ON license_activations(activationKey);

        CREATE TABLE IF NOT EXISTS system_config (
            _id TEXT PRIMARY KEY DEFAULT 'default',
            setupComplete INTEGER DEFAULT 0,
            setupStep INTEGER DEFAULT 0,
            companyName TEXT DEFAULT 'JCB Tracker',
            primaryColor TEXT DEFAULT '#2563eb',
            logoUrl TEXT,
            licenseType TEXT DEFAULT 'trial',
            defaultLanguage TEXT DEFAULT 'tr',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
    `);

    // Column migrations for existing databases
    migrateAddColumn('users', 'isActive', 'INTEGER DEFAULT 1');
    migrateAddColumn('location_logs', 'createdAt', 'TEXT NOT NULL DEFAULT \'\'');
    migrateAddColumn('location_logs', 'updatedAt', 'TEXT NOT NULL DEFAULT \'\'');
    migrateAddColumn('alerts', 'updatedAt', 'TEXT NOT NULL DEFAULT \'\'');

    saveDb();
}

module.exports = { connect, getDb, close, saveDb, initSchema };
