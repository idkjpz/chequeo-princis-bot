const bcrypt = require('bcryptjs');

async function testLogin() {
    const password = 'admin123';
    const hash = '$2b$10$GVSfrxWcA7tqs1itet8t4eeE4JGlN21JkRjEN/DCMsQhznJmI6dvi';

    console.log('Testing password:', password);
    console.log('Against hash:', hash);

    const match = await bcrypt.compare(password, hash);
    console.log('\n✅ Result:', match ? 'PASSWORD MATCHES!' : '❌ PASSWORD DOES NOT MATCH');

    if (!match) {
        console.log('\n🔧 Generating new hash for admin123...');
        const newHash = await bcrypt.hash('admin123', 10);
        console.log('New hash:', newHash);
    }
}

testLogin();
