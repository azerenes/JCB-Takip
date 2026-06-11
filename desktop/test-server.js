// Quick test server - does NOT open Electron window
process.env.JCB_PORT = process.env.JCB_PORT || '3001';
process.env.REQUIRE_SETUP = process.env.REQUIRE_SETUP || 'false';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@jcbtracker.com';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-jwt-key-2024';

async function main() {
    const { createServer } = require('./src/server');
    const { server } = await createServer();
    const port = process.env.JCB_PORT;
    server.listen(port, '127.0.0.1', () => {
        console.log(`[TEST] Server ready at http://127.0.0.1:${port}`);
        console.log('[TEST] Press Ctrl+C to stop');
    });
}

main().catch(err => { console.error(err); process.exit(1); });
