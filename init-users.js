const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

async function initializeUsers() {
    const dataDir = path.join(__dirname, 'data');
    const usersFile = path.join(dataDir, 'users.json');

    try {
        // Create data directory if it doesn't exist
        await fs.mkdir(dataDir, { recursive: true });

        // Check if users.json already exists
        try {
            await fs.access(usersFile);
            console.log('✅ users.json already exists');
            return;
        } catch {
            // File doesn't exist, create it
        }

        // Create default admin user
        const adminPassword = await bcrypt.hash('admin123', 10);
        const defaultUsers = [
            {
                username: 'admin',
                password: adminPassword,
                role: 'admin',
                assignedShifts: ['morning', 'afternoon', 'night'],
                createdAt: new Date().toISOString()
            }
        ];

        await fs.writeFile(usersFile, JSON.stringify(defaultUsers, null, 2));
        console.log('✅ Created users.json with default admin user');
        console.log('   Username: admin');
        console.log('   Password: admin123');
    } catch (error) {
        console.error('❌ Error initializing users:', error);
    }
}

initializeUsers();
