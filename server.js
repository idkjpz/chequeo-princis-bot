const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const TelegramBot = require('./telegram-bot');
const cron = require('node-cron');
const multer = require('multer');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Initialize users on startup (important for Railway/production)
async function initializeUsers() {
    const dataDir = path.join(__dirname, 'data');
    const usersFile = path.join(dataDir, 'users.json');

    try {
        await fs.mkdir(dataDir, { recursive: true });

        try {
            await fs.access(usersFile);
            console.log('✅ users.json exists');
        } catch {
            const bcrypt = require('bcryptjs');
            const adminPassword = await bcrypt.hash('admin123', 10);
            const defaultUsers = [{
                username: 'admin',
                password: adminPassword,
                role: 'admin',
                assignedShifts: ['morning', 'afternoon', 'night'],
                createdAt: new Date().toISOString()
            }];
            await fs.writeFile(usersFile, JSON.stringify(defaultUsers, null, 2));
            console.log('✅ Created default admin user (username: admin, password: admin123)');
        }
    } catch (error) {
        console.error('❌ Error initializing users:', error);
    }
}

// Run initialization
initializeUsers();

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'temp-uploads');
        // Use regular fs for mkdir with callback
        require('fs').mkdir(uploadDir, { recursive: true }, (err) => {
            cb(null, uploadDir);
        });
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}_${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Allow images and common documents
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'));
        }
    }
});

// Middleware
app.use(cors());
// Skip JSON parsing for file upload route
app.use((req, res, next) => {
    if (req.path === '/api/telegram/send-file') {
        return next();
    }
    express.json()(req, res, next);
});
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const result = await auth.login(username, password);
        if (!result) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Login failure' });
    }
});

// User Management (Admin Only)
app.get('/api/users', auth.middleware(), auth.roleMiddleware(['admin']), async (req, res) => {
    try {
        const users = await auth.loadUsers();
        // Don't send passwords back
        const safeUsers = users.map(u => ({
            username: u.username,
            role: u.role,
            assignedShifts: u.assignedShifts,
            createdAt: u.createdAt
        }));
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.post('/api/users', auth.middleware(), auth.roleMiddleware(['admin']), async (req, res) => {
    try {
        const result = await auth.register(req.body, req.user.role);
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/users/:username', auth.middleware(), auth.roleMiddleware(['admin']), async (req, res) => {
    try {
        const users = await auth.loadUsers();
        const filtered = users.filter(u => u.username !== req.params.username);

        if (users.length === filtered.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (req.params.username === req.user.username) {
            return res.status(400).json({ error: 'Cannot delete yourself' });
        }

        await auth.saveUsers(filtered);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Initialize Telegram Bot
let telegramBot = null;
require('dotenv').config();

if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    try {
        telegramBot = new TelegramBot(
            process.env.TELEGRAM_BOT_TOKEN,
            process.env.TELEGRAM_CHAT_ID
        );

        telegramBot.start().then(success => {
            if (success) {
                console.log('🔄 Starting Telegram polling...');
                telegramBot.poll();
                console.log('✅ Telegram bot is running');
            }
        }).catch(error => {
            console.error('❌ Error starting Telegram bot:', error.message);
        });
    } catch (error) {
        console.error('❌ Error initializing Telegram bot:', error.message);
    }
} else {
    console.log('⚠️  Telegram bot not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID)');
}

// Load data from file
async function loadData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// Save data to file
async function saveData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        return false;
    }
}

// API Routes

// Get all data
// Load initial data
app.get('/api/data', auth.middleware(), async (req, res) => {
    try {
        const data = await loadData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error loading data' });
    }
});

// Get data for specific date
// Load data for a specific date
app.get('/api/data/:date', auth.middleware(), async (req, res) => {
    try {
        const data = await loadData();
        const dateData = data[req.params.date] || {};
        res.json(dateData);
    } catch (error) {
        res.status(500).json({ error: 'Error loading data' });
    }
});

// Save phone status
// Save phone status
app.post('/api/status', auth.middleware(), async (req, res) => {
    try {
        const { date, phone, period, time, status } = req.body;

        if (!date || !phone || !period || !time || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const data = await loadData();

        if (!data[date]) {
            data[date] = {};
        }

        const key = `${date}_${phone}_${period}_${time} `;

        // Get previous status if exists
        const oldStatus = data[date][key] ? data[date][key].status : 'none';

        data[date][key] = {
            phone,
            period,
            time,
            status,
            timestamp: new Date().toISOString()
        };

        // Save to history
        await saveHistory({
            phoneId: phone,
            user: req.body.userName || 'Usuario', // Will be replaced by real user in Phase 3
            fromStatus: oldStatus,
            toStatus: status,
            date: date,
            timeLabel: time,
            periodLabel: period
        });

        await saveData(data);
        res.json({ success: true, data: data[date][key] });
    } catch (error) {
        console.error('Error saving status:', error);
        res.status(500).json({ error: 'Error saving status' });
    }
});

// Save notes
// Save notes
app.post('/api/notes', auth.middleware(), async (req, res) => {
    try {
        const { date, notes } = req.body;

        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const data = await loadData();

        if (!data[date]) {
            data[date] = {};
        }

        data[date]._notes = notes;
        await saveData(data);

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving notes:', error);
        res.status(500).json({ error: 'Error saving notes' });
    }
});

// Save data endpoint
app.post('/api/save-data', async (req, res) => {
    try {
        const data = req.body;
        await saveData(data);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// Get notes for a specific phone
// Get notes for a specific phone
app.get('/api/notes/:phone', auth.middleware(), async (req, res) => {
    try {
        const { phone } = req.params;
        const notesPath = path.join(__dirname, 'data', 'notes.json');

        let notes = {};
        try {
            const data = await fs.readFile(notesPath, 'utf-8');
            notes = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, return empty
        }

        res.json({ note: notes[phone] || '' });
    } catch (error) {
        console.error('Error getting notes:', error);
        res.status(500).json({ error: 'Failed to get notes' });
    }
});

// Helper to save history
async function saveHistory(entry) {
    try {
        const historyPath = path.join(__dirname, 'data', 'history.json');
        let history = [];

        try {
            const fileData = await fs.readFile(historyPath, 'utf8');
            history = JSON.parse(fileData);
        } catch (e) {
            // File doesn't exist
        }

        // Add timestamp to entry
        entry.timestamp = new Date().toISOString();
        history.push(entry);

        // Keep last 1000 entries
        if (history.length > 1000) {
            history = history.slice(-1000);
        }

        await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('Error saving history:', error);
    }
}

// Get history for a specific phone
// Get history for a specific phone
app.get('/api/history/:phone', auth.middleware(), async (req, res) => {
    try {
        const { phone } = req.params;
        const historyPath = path.join(__dirname, 'data', 'history.json');

        let history = [];
        try {
            const fileData = await fs.readFile(historyPath, 'utf8');
            history = JSON.parse(fileData);
        } catch (e) {
            // No history yet
        }

        // Filter by phone and sort by timestamp decending
        const phoneHistory = history
            .filter(h => h.phoneId == phone)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, history: phoneHistory });
    } catch (error) {
        console.error('Error getting history:', error);
        res.status(500).json({ error: 'Failed' });
    }
});

// Save note for a specific phone
// Save note for a specific phone
app.post('/api/notes/:phone', auth.middleware(), async (req, res) => {
    try {
        const { phone } = req.params;
        const { note } = req.body;
        const notesPath = path.join(__dirname, 'data', 'notes.json');

        let notes = {};
        try {
            const data = await fs.readFile(notesPath, 'utf-8');
            notes = JSON.parse(data);
        } catch (error) {
            // File doesn't exist yet, create new object
        }

        if (note && note.trim()) {
            notes[phone] = note.trim();
        } else {
            delete notes[phone]; // Remove if empty
        }

        await fs.writeFile(notesPath, JSON.stringify(notes, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving note:', error);
        res.status(500).json({ error: 'Failed to save note' });
    }
});

// Send report to Discord
// Send report to Discord
app.post('/api/send-discord', auth.middleware(), async (req, res) => {
    try {
        const { report, embedData } = req.body;

        // Load environment variables
        require('dotenv').config();
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

        if (!webhookUrl) {
            return res.status(400).json({
                error: 'Webhook URL no configurado',
                details: 'Por favor configura DISCORD_WEBHOOK_URL en el archivo .env'
            });
        }

        if (!embedData) {
            return res.status(400).json({ error: 'Report data is required' });
        }

        // Send as Discord Embed
        await axios.post(webhookUrl, {
            embeds: [embedData]
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending to Discord:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Error sending to Discord',
            details: error.response?.data?.message || error.message
        });
    }
});

// Send report to Telegram
// Send report to Telegram
app.post('/api/send-telegram', auth.middleware(), async (req, res) => {
    try {
        const { message } = req.body;

        require('dotenv').config();
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;

        if (!botToken || !chatId) {
            return res.status(400).json({
                error: 'Telegram no configurado',
                details: 'Por favor configura TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en el archivo .env'
            });
        }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Send message to Telegram
        const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
        await axios.post(telegramUrl, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending to Telegram:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Error sending to Telegram',
            details: error.response?.data?.description || error.message
        });
    }
});

// Get message history
// Get messages for the chat history
app.get('/api/telegram/messages', auth.middleware(), async (req, res) => {
    try {
        if (!telegramBot) {
            return res.status(400).json({ error: 'Telegram bot not configured' });
        }

        const messages = await telegramBot.getMessages();
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ error: 'Error getting messages' });
    }
});

// Send message to Telegram
app.post('/api/telegram/send-message', auth.middleware(), async (req, res) => {
    try {
        if (!telegramBot) {
            return res.status(400).json({ error: 'Telegram bot not configured' });
        }

        const { message, replyToId } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        await telegramBot.sendMessage(message, null, replyToId);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Error sending message' });
    }
});

// Upload and send file to Telegram
// Send a file from the web admin
app.post('/api/telegram/send-file', auth.middleware(), upload.single('file'), async (req, res) => {
    try {
        console.log('📎 File upload request received');

        if (!telegramBot) {
            console.error('❌ Telegram bot not configured');
            return res.status(400).json({ error: 'Telegram bot not configured' });
        }

        if (!req.file) {
            console.error('❌ No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('📄 File received:', req.file.originalname, 'Size:', req.file.size);

        const { caption, replyToId } = req.body;
        const filePath = req.file.path;
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        // Determine if it's an image or document
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
        const isImage = imageExtensions.includes(fileExt);

        console.log('📤 Sending to Telegram as', isImage ? 'photo' : 'document');
        if (replyToId) {
            console.log('↩️ Replying to message ID:', replyToId);
        }

        if (isImage) {
            await telegramBot.sendPhoto(filePath, caption || '', null, replyToId);
        } else {
            await telegramBot.sendDocument(filePath, caption || '', null, replyToId);
        }

        // Delete temporary file after sending
        await fs.unlink(filePath);
        console.log('✅ File sent and cleaned up successfully');

        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error sending file:', error.message);
        console.error('Stack:', error.stack);
        // Clean up file on error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error deleting temp file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'Error sending file', details: error.message });
    }
});

// Get new messages since timestamp
// Long polling for new updates
app.get('/api/telegram/updates', auth.middleware(), async (req, res) => {
    try {
        if (!telegramBot) {
            return res.status(400).json({ error: 'Telegram bot not configured' });
        }

        const since = req.query.since;
        const messages = await telegramBot.getNewMessages(since);
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Error getting updates:', error);
        res.status(500).json({ error: 'Error getting updates' });
    }
});



// Generate and send automated report
async function sendAutomatedReport(webhookUrl) {
    try {
        const data = await loadData();
        const today = new Date().toISOString().split('T')[0];
        const todayData = data[today] || {};

        // Generate report (similar to frontend logic)
        let report = `**📱 CONTROL DE PRINCIPALES - REPORTE AUTOMÁTICO**\n`;
        report += `**Fecha:** ${formatDate(today)}\n\n`;

        const notes = todayData._notes || 'Sin observaciones';

        // Add summary
        const totalChecks = Object.keys(todayData).filter(k => !k.startsWith('_')).length;
        report += `**Total de chequeos realizados:** ${totalChecks}\n\n`;

        report += `**📝 NOTAS:**\n${notes}`;

        await axios.post(webhookUrl, {
            content: report
        });

        console.log('Automated report sent successfully');
    } catch (error) {
        console.error('Error sending automated report:', error);
    }
}

// Schedule automated reports (optional)
// Uncomment and configure webhook URL to enable
/*
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

if (DISCORD_WEBHOOK_URL) {
    // Send report every day at 23:00
    cron.schedule('0 23 * * *', () => {
        console.log('Sending automated daily report...');
        sendAutomatedReport(DISCORD_WEBHOOK_URL);
    });
}
*/

// Utility function
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Phone Monitoring System is ready!`);
});

module.exports = app;
