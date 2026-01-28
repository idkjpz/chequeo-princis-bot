const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
const USERS_PATH = path.join(__dirname, 'data', 'users.json');

class AuthService {
    async loadUsers() {
        try {
            const data = await fs.readFile(USERS_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    async saveUsers(users) {
        await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
    }

    async login(username, password) {
        const users = await this.loadUsers();
        const user = users.find(u => u.username === username);

        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        const token = jwt.sign(
            { username: user.username, role: user.role, assignedShifts: user.assignedShifts },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return { token, user: { username: user.username, role: user.role, assignedShifts: user.assignedShifts } };
    }

    async register(userData, currentUserRole) {
        if (currentUserRole !== 'admin') {
            throw new Error('Only admins can register new users');
        }

        const users = await this.loadUsers();
        if (users.find(u => u.username === userData.username)) {
            throw new Error('Username already exists');
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const newUser = {
            ...userData,
            password: hashedPassword,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);
        await this.saveUsers(users);
        return { username: newUser.username, role: newUser.role };
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    middleware() {
        return (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: 'No token provided' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = this.verifyToken(token);

            if (!decoded) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }

            req.user = decoded;
            next();
        };
    }

    roleMiddleware(roles) {
        return (req, res, next) => {
            if (!req.user || !roles.includes(req.user.role)) {
                return res.status(403).json({ error: 'Access denied: insufficient permissions' });
            }
            next();
        };
    }
}

module.exports = new AuthService();
