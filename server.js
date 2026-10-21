const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', true);
const db = require('./db');
const initDb = require('./init_db');
const PORT = process.env.PORT || 3000;
const { getAiResponse } = require('./chat-ai');

// Auto-initialize DB tables on boot
initDb().catch(err => console.error('Database auto-initialization error:', err));

// Admin credentials are now loaded from .env

// Email transporter setup
let transporter;

const smtpHost = (process.env.SMTP_HOST && !process.env.SMTP_HOST.includes('hostinger')) ? process.env.SMTP_HOST : 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT) || 465;
const smtpUser = (process.env.SMTP_USER && !process.env.SMTP_USER.includes('winningedgeinvestment')) ? process.env.SMTP_USER : 'eaap2026@eventslabs.org';
const smtpPass = (process.env.SMTP_PASS && process.env.SMTP_PASS !== 'Brutality@54') ? process.env.SMTP_PASS : 'okuptszlekbildxn';

transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  connectionTimeout: 5000, // 5 seconds
  greetingTimeout: 5000,   // 5 seconds
  socketTimeout: 7000      // 7 seconds
});
console.log('Email transporter configured with user:', smtpUser);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabling CSP for now to prevent breaking existing inline scripts/styles
}));

// Rate Limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login requests per windowMs
  validate: { trustProxy: false },
  message: { success: false, message: 'Too many login attempts, please try again after 15 minutes' }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the project root
const publicPath = path.join(__dirname);
app.use(express.static(publicPath, {
  etag: false,
  maxAge: 0,
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Serve static directories explicitly
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/vendor', express.static(path.join(__dirname, 'vendor')));
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use /tmp in production (Vercel) because the root is read-only
        const dir = process.env.NODE_ENV === 'production' ? '/tmp' : './uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage: storage });

// Helper to generate unique credit/debit card details for an account
function generateCardForAccount(accountNumber, accountType, accountId) {
    const typeStr = String(accountType || '').toLowerCase();
    const accStr = String(accountNumber || '').replace(/\D/g, '');
    const idSeed = parseInt(String(accountId || '1').replace(/\D/g, ''), 10) || 1;
    const accNum = parseInt(accStr, 10) || 12345678;

    // Distinct Visa BIN prefixes for each facility type:
    // 4829: Visa Metal Signature (Fiat & Crypto Wallet / Current)
    // 4532: Visa Platinum Debit (Crypto Debit Card / ISA)
    // 4716: Visa Vault Reserve (Crypto Earn & Savings Vault / Savings)
    // 4916: Visa Business Commercial (Business & Treasury / Business)
    let bin = '4829';
    let expYear = '29';
    
    if (typeStr.includes('debit') || typeStr.includes('isa')) {
        bin = '4532';
        expYear = '31';
    } else if (typeStr.includes('earn') || typeStr.includes('saving') || typeStr.includes('vault')) {
        bin = '4716';
        expYear = '30';
    } else if (typeStr.includes('business') || typeStr.includes('treasury')) {
        bin = '4916';
        expYear = '31';
    } else {
        bin = '4829';
        expYear = '29';
    }

    const seed1 = (accNum * 69069 + idSeed * 982451653 + parseInt(bin, 10) * 104729) >>> 0;
    const seed2 = (seed1 * 1664525 + 1013904223) >>> 0;
    const seed3 = (seed2 * 1103515245 + 12345) >>> 0;

    let block2 = String(1000 + (seed1 % 9000)).padStart(4, '0');
    let block3 = String(1000 + (seed2 % 9000)).padStart(4, '0');
    let block4 = String(1000 + (seed3 % 9000)).padStart(4, '0');

    // Never repeat the 923 account prefix in any block
    if (block2.startsWith('923')) block2 = '3' + block2.slice(1);
    if (block3.startsWith('923')) block3 = '7' + block3.slice(1);
    if (block4.startsWith('923')) block4 = '5' + block4.slice(1);

    const formattedCard = `${bin} ${block2} ${block3} ${block4}`;
    const cvvSeed = (seed3 * 48271 + 397204257) >>> 0;
    const cvv = String(100 + (cvvSeed % 900));

    const expMonths = ['03', '05', '07', '09', '11', '12'];
    const selectedMonth = expMonths[(seed1 + idSeed) % expMonths.length];
    const exp = `${selectedMonth}/${expYear}`;

    return { card_number: formattedCard, card_cvv: cvv, card_exp: exp };
}

// Helper to generate a unique 8-digit account number starting with 923
async function generateUniqueAccountNumber() {
    let accountNumber;
    let isUnique = false;
    while (!isUnique) {
        // Generate 5 random digits to append to 923
        const randomPart = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        accountNumber = '923' + randomPart;
        const { rows } = await db.query('SELECT id FROM accounts WHERE account_number = $1', [accountNumber]);
        if (rows.length === 0) {
            isUnique = true;
        }
    }
    return accountNumber;
}

// Generate JWT token
function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1d' });
}

// Middleware to check Admin authentication
function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        if (decoded.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// Middleware to check Customer authentication
function requireCustomerAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = decoded; // Contains customer username, etc.
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
}

// API Routes

// Helper to log login attempts to database (detects real client IP and browser User Agent)
async function logLoginAttempt(username, reqOrIp, status, reason) {
    try {
        let ip = '127.0.0.1';
        let ua = 'unknown';
        if (typeof reqOrIp === 'string') {
            ip = reqOrIp;
        } else if (reqOrIp && typeof reqOrIp === 'object') {
            ip = reqOrIp.headers?.['x-forwarded-for']?.split(',')[0].trim() || reqOrIp.ip || reqOrIp.socket?.remoteAddress || '127.0.0.1';
            ua = reqOrIp.headers?.['user-agent'] || 'unknown';
        }
        if (ip === '::1' || ip === '::' || ip === 'unknown') ip = '127.0.0.1';
        if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');
        await db.query(
            `INSERT INTO login_audit_logs (username, ip_address, user_agent, status, reason) VALUES ($1, $2, $3, $4, $5)`,
            [username || 'unknown', ip, ua, status, reason]
        );
    } catch (err) {
        console.error('Error writing login audit log:', err);
    }
}

// Admin login
app.post('/api/admin/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        await logLoginAttempt(username, req, 'failure', 'Username or password missing');
        return res.status(400).json({ success: false, message: 'Username and password required' });
    }
    
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    // Check credentials
    if (username === adminUsername && password === adminPassword) {
        const token = generateToken({ role: 'admin', username });
        await logLoginAttempt(username, req, 'success', 'Admin login successful');
        res.json({ 
            success: true, 
            message: 'Login successful',
            token: token
        });
    } else {
        await logLoginAttempt(username, req, 'failure', 'Invalid admin credentials');
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Verify token
app.post('/api/admin/verify', requireAuth, (req, res) => {
    // If requireAuth passes, token is valid
    res.json({ success: true, message: 'Token valid' });
});

// Submit contact form
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id`,
            [name, email, subject, message]
        );
        res.json({ success: true, message: 'Message sent successfully', messageId: result.rows[0].id });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error saving message' });
    }
});

// Handle Registration
app.post('/api/register', upload.array('idDocument', 5), async (req, res) => {
    const {
        firstname, middlename, surname, dob, address,
        email, phone, account_types, username, password
    } = req.body;

    const id_number = req.body.id_number || req.body.id || null;
    let id_document_path = null;
    if (req.files && req.files.length > 0) {
        id_document_path = req.files.map(f => f.path.replace(/\\/g, '/')).join(';');
    } else if (req.file) {
        id_document_path = req.file.path.replace(/\\/g, '/');
    }

    // Convert date format for PostgreSQL (supports MM/DD/YYYY, DD/MM/YYYY, or YYYY-MM-DD)
    let formattedDob = null;
    if (dob && typeof dob === 'string') {
        const trimmed = dob.trim();
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
            formattedDob = trimmed;
        } else if (trimmed.includes('/') || trimmed.includes('-')) {
            const sep = trimmed.includes('/') ? '/' : '-';
            const parts = trimmed.split(sep);
            if (parts.length === 3) {
                if (parts[2].length === 4) {
                    const p0 = parseInt(parts[0], 10);
                    const p1 = parseInt(parts[1], 10);
                    const year = parts[2];
                    if (p0 > 12) {
                        // Day first: DD/MM/YYYY
                        formattedDob = `${year}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
                    } else {
                        // USA standard: MM/DD/YYYY
                        formattedDob = `${year}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
                    }
                }
            }
        }
    }

    try {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const rawAccountTypes = account_types ? String(account_types).trim() : '';
        const finalAccountTypes = rawAccountTypes || 'Fiat & Crypto Wallet';

        const query = `
            INSERT INTO registrations (
                firstname, middlename, surname, dob, id_number, address,
                email, phone, account_types, id_document_path, username, password
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        const values = [
            firstname, middlename, surname, formattedDob, id_number, address,
            email, phone, finalAccountTypes, id_document_path, username, hashedPassword
        ];
        await db.query(query, values);
        res.json({ success: true, message: 'Registration successful' });
    } catch (err) {
        console.error('Database error:', err);
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ success: false, message: 'Username or email already exists.' });
        }
        return res.status(500).json({ success: false, message: 'Error saving registration' });
    }
});

// Customer Login
app.post('/api/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body;

    try {
        const { rows } = await db.query(
            `SELECT * FROM registrations WHERE username = $1`,
            [username]
        );
        const user = rows[0];

        if (!user) {
            await logLoginAttempt(username, req, 'failure', 'User not found');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            await logLoginAttempt(username, req, 'failure', 'Invalid password');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (user.status === 'blocked') {
            await logLoginAttempt(username, req, 'failure', 'Account blocked');
            return res.status(401).json({ success: false, message: 'Your account has been blocked. Please contact support.' });
        }
        if (user.status !== 'approved' && user.status !== 'suspended') { 
            await logLoginAttempt(username, req, 'failure', `Account status is: ${user.status}`);
            return res.status(401).json({ success: false, message: 'Account application is under review' }); 
        }

        // Generate customer JWT
        const token = generateToken({ role: 'customer', username: user.username });
        await logLoginAttempt(username, req, 'success', 'Customer login successful');
        res.json({ 
            success: true, 
            message: 'Login successful', 
            token: token,
            user: { 
                username: user.username,
                firstname: user.firstname, 
                surname: user.surname,
                email: user.email,
                phone: user.phone
            } 
        });
    } catch (err) {
        console.error('Database error:', err);
        await logLoginAttempt(username, req, 'failure', `Database error: ${err.message}`);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Get user dashboard data
app.get('/api/user/:username/dashboard', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    try {
        // Get user details
        const userRes = await db.query('SELECT id, firstname, surname, email, phone, status, crypto_balances FROM registrations WHERE username = $1', [username]);
        const user = userRes.rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.status === 'blocked') {
            return res.status(403).json({ success: false, status: 'blocked', message: 'Your account is blocked. Please contact support.' });
        }

        // Get accounts
        const accountsRes = await db.query('SELECT * FROM accounts WHERE registration_id = $1', [user.id]);
        
        res.json({
            success: true,
            user: {
                firstname: user.firstname,
                surname: user.surname,
                status: user.status
            },
            accounts: accountsRes.rows,
            crypto_balances: user.crypto_balances || { btc: 0, eth: 0, sol: 0, usdt: 0 }
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching dashboard data' });
    }
});

// Get user profile (all fields except password)
app.get('/api/user/:username/profile', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    
    try {
        const { rows } = await db.query(
            `SELECT firstname, middlename, surname, dob, id_number, address, email, phone, account_types, status, email_notifications
             FROM registrations WHERE username = $1`,
            [username]
        );
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, profile: user, user: user });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching profile' });
    }
});

// Update user profile (email, phone, password optional)
app.put('/api/user/:username/profile', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    const { email, phone, oldPassword, newPassword, emailNotifications } = req.body;

    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM registrations WHERE username = $1', [username]);
        const user = rows[0];
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const updates = [];
        const params = [];
        let idx = 1;
        if (email && email !== user.email) {
            updates.push(`email = $${idx++}`);
            params.push(email);
        }
        if (phone && phone !== user.phone) {
            updates.push(`phone = $${idx++}`);
            params.push(phone);
        }
        if (emailNotifications !== undefined && emailNotifications !== user.email_notifications) {
            updates.push(`email_notifications = $${idx++}`);
            params.push(emailNotifications);
        }
        if (newPassword) {
            // require oldPassword match
            if (!oldPassword) {
                return res.status(400).json({ success: false, message: 'Old password required to change password' });
            }
            const match = await bcrypt.compare(oldPassword, user.password);
            if (!match) {
                return res.status(401).json({ success: false, message: 'Old password incorrect' });
            }
            const hashed = await bcrypt.hash(newPassword, 10);
            updates.push(`password = $${idx++}`);
            params.push(hashed);
        }
        if (updates.length === 0) {
            return res.json({ success: true, message: 'No changes to update' });
        }
        params.push(username);
        const query = `UPDATE registrations SET ${updates.join(', ')} WHERE username = $${idx}`;
        await db.query(query, params);
        res.json({ success: true, message: 'Profile updated' });
    } catch (err) {
        console.error('Database error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: 'Email already in use' });
        }
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// Toggle card frozen status for specific account
app.post('/api/user/:username/card/freeze', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    const { accountNumber, frozen } = req.body;

    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    try {
        const userRes = await db.query('SELECT id FROM registrations WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const registrationId = userRes.rows[0].id;
        const result = await db.query(
            `UPDATE accounts SET card_frozen = $1 
             WHERE registration_id = $2 AND account_number = $3 
             RETURNING id, account_number, account_type, card_frozen`,
            [Boolean(frozen), registrationId, accountNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        res.json({ success: true, account: result.rows[0], card_frozen: result.rows[0].card_frozen });
    } catch (err) {
        console.error('Error freezing card:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Get unread notifications
app.get('/api/user/:username/notifications', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        const { rows } = await db.query(
            'SELECT * FROM notifications WHERE username = $1 ORDER BY created_at DESC LIMIT 50',
            [username]
        );
        res.json({ success: true, notifications: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching notifications' });
    }
});

// Mark notifications as read
app.put('/api/user/:username/notifications/read', requireCustomerAuth, async (req, res) => {
    const { username } = req.params;
    if (req.user.username !== username) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    try {
        await db.query(
            'UPDATE notifications SET is_read = TRUE WHERE username = $1 AND is_read = FALSE',
            [username]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating notifications' });
    }
});

// Get transactions for a specific account
app.get('/api/account/:accountNumber/transactions', requireCustomerAuth, async (req, res) => {
    const { accountNumber } = req.params;
    const { limit, startDate, endDate, month, year, period } = req.query;
    
    try {
        const accountRes = await db.query('SELECT id, balance FROM accounts WHERE account_number = $1', [accountNumber]);
        const account = accountRes.rows[0];

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // build dynamic query - exclude any admin deductions from user transaction history per requirement
        let queryText = "SELECT * FROM transactions WHERE account_id = $1 AND NOT (transaction_type = 'Debit' AND (description ILIKE '%Admin%' OR description ILIKE '%deduction%'))";
        const params = [account.id];
        let idx = 2;

        // Resolve month and year from either query params or period string
        let filterMonth = month ? parseInt(month, 10) : null;
        let filterYear = year ? parseInt(year, 10) : null;

        if (period && period !== 'all' && period !== 'undefined' && period !== 'null') {
            if (period === 'current' || period === 'mtd') {
                const now = new Date();
                filterMonth = now.getMonth() + 1;
                filterYear = now.getFullYear();
            } else if (period.includes('-')) {
                const parts = period.split('-');
                if (parts[0].length === 4) {
                    filterYear = parseInt(parts[0], 10);
                    filterMonth = parseInt(parts[1], 10);
                } else {
                    filterMonth = parseInt(parts[0], 10);
                    filterYear = parseInt(parts[1], 10);
                }
            }
        }

        // Support for specific month/year filtering (Statement view)
        if (filterMonth && filterYear && !isNaN(filterMonth) && !isNaN(filterYear)) {
            queryText += ` AND EXTRACT(MONTH FROM created_at) = $${idx++} AND EXTRACT(YEAR FROM created_at) = $${idx++}`;
            params.push(filterMonth);
            params.push(filterYear);
        }

        queryText += ' ORDER BY created_at DESC';
        if (limit) {
            queryText += ` LIMIT $${idx++}`;
            params.push(parseInt(limit, 10));
        }

        const transactionsRes = await db.query(queryText, params);
        
        res.json({
            success: true,
            accountBalance: account.balance,
            period: period || 'all',
            filterMonth,
            filterYear,
            transactions: transactionsRes.rows
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching transactions' });
    }
});

// Get available statement periods (months with transactions)
app.get('/api/account/:accountNumber/statement-periods', requireCustomerAuth, async (req, res) => {
    const { accountNumber } = req.params;
    
    try {
        const accountRes = await db.query('SELECT id, balance FROM accounts WHERE account_number = $1', [accountNumber]);
        const account = accountRes.rows[0];

        if (!account) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        // Get distinct months from transactions
        const query = `
            SELECT DISTINCT 
                EXTRACT(MONTH FROM created_at)::int as month,
                EXTRACT(YEAR FROM created_at)::int as year,
                TO_CHAR(created_at, 'FMMonth YYYY') as label
            FROM transactions 
            WHERE account_id = $1
            ORDER BY year DESC, month DESC
        `;
        
        const { rows } = await db.query(query, [account.id]);
        
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1-12
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        const periods = [];
        const seenMonths = new Set();

        // 1. "All Activity (Complete History)"
        periods.push({
            value: 'all',
            label: 'All Activity (Complete History)',
            month: null,
            year: null,
            isCurrent: false
        });

        // 2. Add all months that have recorded transactions
        rows.forEach(r => {
            const m = parseInt(r.month, 10);
            const y = parseInt(r.year, 10);
            const key = `${y}-${String(m).padStart(2, '0')}`;
            seenMonths.add(key);
            const isCur = (y === currentYear && m === currentMonth);
            periods.push({
                value: key,
                label: `${r.label || (monthNames[m - 1] + ' ' + y)}${isCur ? ' (Current MTD)' : ''}`,
                month: m,
                year: y,
                isCurrent: isCur
            });
        });

        // 3. Ensure current month is always present even if no transactions occurred yet
        const currentKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        if (!seenMonths.has(currentKey)) {
            periods.splice(1, 0, {
                value: currentKey,
                label: `${monthNames[currentMonth - 1]} ${currentYear} (Current MTD)`,
                month: currentMonth,
                year: currentYear,
                isCurrent: true
            });
            seenMonths.add(currentKey);
        }

        // 4. Also provide past 2 months as standard calendar cycles if not already present
        for (let i = 1; i <= 2; i++) {
            let m = currentMonth - i;
            let y = currentYear;
            while (m <= 0) {
                m += 12;
                y -= 1;
            }
            const key = `${y}-${String(m).padStart(2, '0')}`;
            if (!seenMonths.has(key)) {
                periods.push({
                    value: key,
                    label: `${monthNames[m - 1]} ${y}`,
                    month: m,
                    year: y,
                    isCurrent: false
                });
                seenMonths.add(key);
            }
        }
        
        res.json({ success: true, periods: periods, currentBalance: account.balance });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error fetching statement periods' });
    }
});

// Helper to track and handle invalid security authorization code attempts
async function handleInvalidSecurityCode(user) {
    const currentAttempts = (parseInt(user.failed_code_attempts, 10) || 0) + 1;
    if (currentAttempts >= 5) {
        await db.query(
            `UPDATE registrations SET status = 'blocked', failed_code_attempts = $1 WHERE id = $2`,
            [currentAttempts, user.id]
        );

        try {
            await db.query(
                `INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`,
                [user.username, 'Security Alert: Account has been locked due to 5 consecutive invalid authorization code attempts.', 'security']
            );
        } catch (nErr) {
            console.error('Failed to insert lockout notification:', nErr);
        }

        if (transporter && user.email) {
            try {
                await transporter.sendMail({
                    from: `${process.env.SMTP_FROM_NAME || 'CryptoPay Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: user.email,
                    subject: 'Security Alert: CryptoPay Account Locked',
                    html: `
                        <h2>Account Locked</h2>
                        <p>Dear ${user.firstname || 'Customer'},</p>
                        <p>Your CryptoPay account has been locked after 5 consecutive invalid security authorization code attempts.</p>
                        <p>If you did not authorize these attempts or need assistance unlocking your account, please contact our support team immediately.</p>
                    `
                });
            } catch (mailErr) {
                console.error('Failed to send lockout email:', mailErr);
            }
        }

        return {
            locked: true,
            attempts: currentAttempts,
            remaining: 0,
            message: 'Account locked due to 5 consecutive invalid code attempts. Please contact customer support.'
        };
    } else {
        await db.query(
            `UPDATE registrations SET failed_code_attempts = $1 WHERE id = $2`,
            [currentAttempts, user.id]
        );
        const remaining = 5 - currentAttempts;
        return {
            locked: false,
            attempts: currentAttempts,
            remaining: remaining,
            message: `Invalid code. Please try again. (${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining)`
        };
    }
}

// Create a transfer/payment between accounts
app.post(['/api/transfer', '/api/user/transfer'], requireCustomerAuth, async (req, res) => {
    const fromAccount = req.body.fromAccount || req.body.from_account;
    const toAccount = req.body.toAccount || req.body.to_account;
    const amount = req.body.amount;
    const description = req.body.description || req.body.reference;
    const code = (req.body.verification_code || req.body.transactionCode || req.body.routingCode || req.body.routing_code || req.body.code || '').toString().trim();

    if (!fromAccount || !toAccount || !amount) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    try {
        // load both accounts
        const fromRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [fromAccount]);
        const toRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [toAccount]);
        const fromAcc = fromRes.rows[0];
        const toAcc = toRes.rows[0];

        if (!fromAcc) {
            return res.status(404).json({ success: false, message: 'Source account not found' });
        }
        // We removed the strictly internal destination check here to allow external transfers
        
        // Check if user is suspended/blocked and verify transaction code
        const userRes = await db.query(
            'SELECT id, username, email, firstname, surname, status, transaction_code, COALESCE(failed_code_attempts, 0) AS failed_code_attempts FROM registrations WHERE id = $1',
            [fromAcc.registration_id]
        );
        const user = userRes.rows[0];

        if (user) {
            if (user.status === 'blocked') {
                return res.status(403).json({ success: false, locked: true, message: 'Your account is blocked. Please contact customer support.' });
            }

            if (user.status === 'suspended') {
                return res.status(403).json({ success: false, message: 'Account is suspended. Transactions are disabled. Please contact support.' });
            }
            
            const expectedCode = String(user.transaction_code || '123456789').trim();
            if (!code || code !== expectedCode) {
                const failResult = await handleInvalidSecurityCode(user);
                return res.status(failResult.locked ? 403 : 400).json({
                    success: false,
                    locked: failResult.locked,
                    remainingAttempts: failResult.remaining,
                    message: failResult.message
                });
            }

            // Code is valid! Reset failed attempts counter if it was > 0
            if (parseInt(user.failed_code_attempts, 10) > 0) {
                await db.query(`UPDATE registrations SET failed_code_attempts = 0 WHERE id = $1`, [user.id]);
            }
        }

        if (parseFloat(fromAcc.balance) < amt) {
            return res.status(400).json({ success: false, message: 'Insufficient funds' });
        }

        // perform update inside transaction
        await db.query('BEGIN');

        const newFromBal = parseFloat(fromAcc.balance) - amt;
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBal, fromAcc.id]);

        const now = new Date();
        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromAcc.id, 'Debit', amt, description || `Transfer to ${toAccount}`, newFromBal, now]
        );

        let newToBal = null;
        if (toAcc) {
            newToBal = parseFloat(toAcc.balance) + amt;
            await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newToBal, toAcc.id]);
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [toAcc.id, 'Credit', amt, description || `Transfer from ${fromAccount}`, newToBal, now]
            );
        }

        await db.query('COMMIT');

        // Insert notification for sender
        try {
            await db.query(`INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`, [req.user.username, `You successfully transferred $${amt.toFixed(2)} to account ${toAccount}.`, 'transfer']);
            
            // Lookup receiver username if internal account
            if (toAcc) {
                const toUserRes = await db.query('SELECT username FROM registrations WHERE id = $1', [toAcc.registration_id]);
                if (toUserRes.rows[0]) {
                    await db.query(`INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`, [toUserRes.rows[0].username, `You received a transfer of $${amt.toFixed(2)} from account ${fromAccount}.`, 'transfer']);
                }
            }
        } catch (notifErr) {
            console.error('Failed to create transfer notifications:', notifErr);
        }

        const txnRef = 'TXN-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);
        res.json({ 
            success: true, 
            message: 'Transfer completed successfully', 
            transactionId: txnRef,
            reference: txnRef,
            amount: amt,
            fromAccount: fromAcc.account_number,
            fromAccountType: fromAcc.account_type,
            toAccount: toAccount,
            description: description || `Transfer to ${toAccount}`,
            fromBalance: newFromBal, 
            toBalance: newToBal,
            timestamp: now.toISOString(),
            status: 'Settled & Cleared'
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during transfer:', err);
        res.status(500).json({ success: false, message: 'Error processing transfer' });
    }
});

// Process customer withdrawal (Wire, ACH, or Crypto)
app.post(['/api/withdraw', '/api/user/withdraw'], requireCustomerAuth, async (req, res) => {
    const fromAccount = req.body.fromAccount || req.body.from_account;
    const amount = req.body.amount;
    const method = req.body.method || req.body.withdrawalMethod || 'Bank Wire';
    const beneficiary = req.body.beneficiary || req.body.beneficiaryName || req.body.beneficiary_name || '';
    const bankName = req.body.bankName || req.body.bank_name || '';
    const routingNumber = req.body.routingNumber || req.body.routing_number || '';
    const destinationAccount = req.body.destinationAccount || req.body.destination_account || req.body.cryptoAddress || req.body.crypto_address || '';
    const description = req.body.description || req.body.reference || req.body.memo || `Outbound Withdrawal via ${method}`;
    const code = (req.body.verification_code || req.body.transactionCode || req.body.routingCode || req.body.routing_code || req.body.code || '').toString().trim();

    if (!fromAccount || !amount || !destinationAccount) {
        return res.status(400).json({ success: false, message: 'Source account, destination, and amount are required.' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount.' });
    }

    try {
        const cryptoKeys = ['btc', 'eth', 'sol', 'usdt'];
        const isCryptoSource = cryptoKeys.includes(String(fromAccount).toLowerCase());

        let user = null;
        let fromAcc = null;
        let newFromBal = 0;
        let cryptoBalances = null;
        const now = new Date();
        const txnRef = 'WD-' + Date.now().toString().slice(-8) + '-' + Math.floor(1000 + Math.random() * 9000);

        if (isCryptoSource) {
            const assetKey = String(fromAccount).toLowerCase();
            const userRes = await db.query(
                'SELECT id, username, email, firstname, surname, status, transaction_code, crypto_balances, COALESCE(failed_code_attempts, 0) AS failed_code_attempts FROM registrations WHERE username = $1',
                [req.user.username]
            );
            user = userRes.rows[0];
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found.' });
            }

            if (user.status === 'blocked') {
                return res.status(403).json({ success: false, locked: true, message: 'Your account is blocked. Please contact customer support.' });
            }
            if (user.status === 'suspended') {
                return res.status(403).json({ success: false, message: 'Outbound withdrawals are restricted on suspended accounts. Please contact priority support.' });
            }

            const expectedCode = String(user.transaction_code || '123456789').trim();
            if (!code || code !== expectedCode) {
                const failResult = await handleInvalidSecurityCode(user);
                return res.status(failResult.locked ? 403 : 400).json({
                    success: false,
                    locked: failResult.locked,
                    remainingAttempts: failResult.remaining,
                    message: failResult.message
                });
            }

            if (parseInt(user.failed_code_attempts, 10) > 0) {
                await db.query('UPDATE registrations SET failed_code_attempts = 0 WHERE id = $1', [user.id]);
            }

            cryptoBalances = user.crypto_balances || { btc: 0, eth: 0, sol: 0, usdt: 0 };
            cryptoBalances = {
                btc: parseFloat(cryptoBalances.btc) || 0,
                eth: parseFloat(cryptoBalances.eth) || 0,
                sol: parseFloat(cryptoBalances.sol) || 0,
                usdt: parseFloat(cryptoBalances.usdt) || 0
            };

            const currentCryptoBal = cryptoBalances[assetKey] || 0;
            if (currentCryptoBal < amt) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient ${fromAccount.toUpperCase()} balance. Available: ${currentCryptoBal} ${fromAccount.toUpperCase()}`
                });
            }

            newFromBal = currentCryptoBal - amt;
            cryptoBalances[assetKey] = newFromBal;

            await db.query('BEGIN');
            await db.query('UPDATE registrations SET crypto_balances = $1 WHERE id = $2', [JSON.stringify(cryptoBalances), user.id]);

            const primaryAccRes = await db.query('SELECT * FROM accounts WHERE registration_id = $1 ORDER BY id ASC LIMIT 1', [user.id]);
            fromAcc = primaryAccRes.rows[0];

            const fullDesc = `Crypto Withdrawal (${fromAccount.toUpperCase()} via ${method}) to ${destinationAccount}${beneficiary ? ' (' + beneficiary + ')' : ''}`;
            if (fromAcc) {
                await db.query(
                    `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [fromAcc.id, 'Debit', amt, fullDesc, fromAcc.balance, now]
                );
            }
            await db.query('COMMIT');

            try {
                await db.query(
                    `INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`,
                    [user.username, `Withdrawal of ${amt} ${fromAccount.toUpperCase()} to ${destinationAccount} submitted successfully (Ref: ${txnRef}).`, 'withdrawal']
                );
            } catch(notifErr) {
                console.error('Failed to create crypto withdrawal notification:', notifErr);
            }

            return res.json({
                success: true,
                message: 'Withdrawal processed and settled successfully',
                transactionId: txnRef,
                reference: txnRef,
                amount: amt,
                asset: fromAccount.toUpperCase(),
                fromAccount: `${fromAccount.toUpperCase()} Multi-Chain Wallet`,
                fromAccountType: `${fromAccount.toUpperCase()} Digital Asset Wallet`,
                destination: destinationAccount,
                beneficiary: beneficiary || 'Authorized Recipient',
                bankName: bankName || `${fromAccount.toUpperCase()} Network`,
                routingNumber: routingNumber,
                method: method,
                fee: 0.00,
                timestamp: now.toISOString(),
                newBalance: newFromBal,
                cryptoBalances: cryptoBalances,
                status: 'Settled & Cleared'
            });
        }

        // Standard Fiat Account Withdrawal
        const fromRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [fromAccount]);
        fromAcc = fromRes.rows[0];

        if (!fromAcc) {
            return res.status(404).json({ success: false, message: 'Source account not found.' });
        }

        // Verify user ownership and check status
        const userRes = await db.query(
            'SELECT id, username, email, firstname, surname, status, transaction_code, COALESCE(failed_code_attempts, 0) AS failed_code_attempts FROM registrations WHERE id = $1',
            [fromAcc.registration_id]
        );
        user = userRes.rows[0];

        if (user) {
            if (user.status === 'blocked') {
                return res.status(403).json({ success: false, locked: true, message: 'Your account is blocked. Please contact customer support.' });
            }
            if (user.status === 'suspended') {
                return res.status(403).json({ success: false, message: 'Outbound withdrawals are restricted on suspended accounts. Please contact priority support.' });
            }

            const expectedCode = String(user.transaction_code || '123456789').trim();
            if (!code || code !== expectedCode) {
                const failResult = await handleInvalidSecurityCode(user);
                return res.status(failResult.locked ? 403 : 400).json({
                    success: false,
                    locked: failResult.locked,
                    remainingAttempts: failResult.remaining,
                    message: failResult.message
                });
            }

            // Reset failed attempts on success
            if (parseInt(user.failed_code_attempts, 10) > 0) {
                await db.query('UPDATE registrations SET failed_code_attempts = 0 WHERE id = $1', [user.id]);
            }
        }

        if (parseFloat(fromAcc.balance) < amt) {
            return res.status(400).json({ success: false, message: `Insufficient funds. Available reserve: $${parseFloat(fromAcc.balance).toFixed(2)} USD` });
        }

        // Execute withdrawal inside transaction
        await db.query('BEGIN');

        newFromBal = parseFloat(fromAcc.balance) - amt;
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBal, fromAcc.id]);

        const fullDesc = `Withdrawal (${method}) to ${destinationAccount}${bankName ? ' - ' + bankName : ''}${beneficiary ? ' (' + beneficiary + ')' : ''}`;

        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromAcc.id, 'Debit', amt, fullDesc, newFromBal, now]
        );

        await db.query('COMMIT');

        // Audit notification
        try {
            await db.query(
                `INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`,
                [req.user.username, `Withdrawal of $${amt.toFixed(2)} USD via ${method} processed successfully (Ref: ${txnRef}).`, 'withdrawal']
            );
        } catch(notifErr) {
            console.error('Failed to create withdrawal notification:', notifErr);
        }

        res.json({
            success: true,
            message: 'Withdrawal processed and settled successfully',
            transactionId: txnRef,
            reference: txnRef,
            amount: amt,
            asset: 'USD',
            fromAccount: fromAcc.account_number,
            fromAccountType: fromAcc.account_type,
            destination: destinationAccount,
            beneficiary: beneficiary || 'Authorized Recipient',
            bankName: bankName,
            routingNumber: routingNumber,
            method: method,
            fee: 0.00,
            timestamp: now.toISOString(),
            newBalance: newFromBal,
            status: 'Settled & Cleared'
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during withdrawal:', err);
        res.status(500).json({ success: false, message: 'Error processing withdrawal. Please try again.' });
    }
});

// Submit deposit notice for admin confirmation (Customer)
app.post('/api/user/deposit-request', requireCustomerAuth, async (req, res) => {
    const { accountNumber, amount, method, referenceNumber } = req.body;
    const username = req.user.username;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid deposit amount.' });
    }

    try {
        let accNum = accountNumber;
        let accType = 'Fiat & Crypto Wallet';

        const accRes = await db.query(
            `SELECT a.* FROM accounts a 
             JOIN registrations r ON a.registration_id = r.id 
             WHERE r.username = $1 AND (a.account_number = $2 OR $2 IS NULL)
             LIMIT 1`,
            [username, accountNumber || null]
        );

        if (accRes.rows.length > 0) {
            accNum = accRes.rows[0].account_number;
            accType = accRes.rows[0].account_type;
        }

        const insertRes = await db.query(
            `INSERT INTO deposit_requests (username, account_number, account_type, amount, method, reference_number, status)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending')
             RETURNING id, created_at`,
            [username, accNum || 'Primary USD', accType, amt, method || 'Domestic Wire Transfer', referenceNumber || 'Pending Ref']
        );

        await db.query(
            `INSERT INTO notifications (username, message, type)
             VALUES ($1, $2, 'alert')`,
            [username, `Deposit notice of $${amt.toFixed(2)} USD submitted. Status: Pending Admin Confirmation.`]
        );

        res.json({
            success: true,
            message: 'Deposit notification submitted successfully. Your deposit is pending administrative confirmation.',
            deposit: insertRes.rows[0]
        });
    } catch (err) {
        console.error('Error submitting deposit notice:', err);
        res.status(500).json({ success: false, message: 'Failed to record deposit notice.' });
    }
});

// Get customer deposit requests
app.get('/api/user/deposit-requests', requireCustomerAuth, async (req, res) => {
    try {
        const username = req.user.username;
        const result = await db.query(
            `SELECT * FROM deposit_requests WHERE username = $1 ORDER BY created_at DESC LIMIT 20`,
            [username]
        );
        res.json({ success: true, deposits: result.rows, requests: result.rows });
    } catch (err) {
        console.error('Error fetching user deposits:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve deposit history.' });
    }
});

const SWAP_RATES = {
    BTC: 68420.00,
    ETH: 3514.80,
    SOL: 184.20,
    USDT: 1.00,
    USD: 1.00,
    BNB: 592.50
};

// Execute crypto / USD spot conversion
app.post('/api/user/swap', requireCustomerAuth, async (req, res) => {
    const { fromAsset, toAsset, amount, accountNumber } = req.body;
    const fromAmt = parseFloat(amount);

    if (!fromAsset || !toAsset || isNaN(fromAmt) || fromAmt <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid conversion parameters' });
    }

    if (fromAsset === toAsset) {
        return res.status(400).json({ success: false, message: 'Source and destination assets must be different' });
    }

    const rateFrom = SWAP_RATES[fromAsset] || 1;
    const rateTo = SWAP_RATES[toAsset] || 1;
    const toAmt = (fromAmt * rateFrom) / rateTo;

    try {
        const userRes = await db.query(
            'SELECT id, username, status, crypto_balances FROM registrations WHERE username = $1',
            [req.user.username]
        );
        const user = userRes.rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.status === 'blocked') {
            return res.status(403).json({ success: false, message: 'Your account is blocked. Please contact customer support.' });
        }

        if (user.status === 'suspended') {
            return res.status(403).json({ success: false, message: 'Your account is suspended. Conversions are disabled.' });
        }

        let cryptoBalances = user.crypto_balances || { btc: 0, eth: 0, sol: 0, usdt: 0 };
        cryptoBalances = {
            btc: parseFloat(cryptoBalances.btc) || 0,
            eth: parseFloat(cryptoBalances.eth) || 0,
            sol: parseFloat(cryptoBalances.sol) || 0,
            usdt: parseFloat(cryptoBalances.usdt) || 0
        };

        let newUsdBalance = null;

        await db.query('BEGIN');

        if (fromAsset === 'USD') {
            // Buying crypto with USD: Deduct from user's USD account
            const accRes = accountNumber 
                ? await db.query('SELECT * FROM accounts WHERE account_number = $1 AND registration_id = $2', [accountNumber, user.id])
                : await db.query('SELECT * FROM accounts WHERE registration_id = $1 ORDER BY balance DESC LIMIT 1', [user.id]);
            const acc = accRes.rows[0];

            if (!acc) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'USD account not found' });
            }

            const currentBal = parseFloat(acc.balance);
            if (currentBal < fromAmt) {
                await db.query('ROLLBACK');
                return res.status(400).json({ success: false, message: `Insufficient USD cash reserve. Available: $${currentBal.toFixed(2)} USD` });
            }

            newUsdBalance = currentBal - fromAmt;
            await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newUsdBalance, acc.id]);

            const toAssetKey = toAsset.toLowerCase();
            cryptoBalances[toAssetKey] = (cryptoBalances[toAssetKey] || 0) + toAmt;

            await db.query('UPDATE registrations SET crypto_balances = $1 WHERE id = $2', [JSON.stringify(cryptoBalances), user.id]);

            const now = new Date();
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                 VALUES ($1, 'Debit', $2, $3, $4, $5)`,
                [acc.id, fromAmt, `Spot Asset Buy: Swapped $${fromAmt.toFixed(2)} USD for ${toAmt.toFixed(6)} ${toAsset}`, newUsdBalance, now]
            );

            await db.query(
                `INSERT INTO notifications (username, message, type) VALUES ($1, $2, 'swap')`,
                [user.username, `Spot Purchase: Converted $${fromAmt.toFixed(2)} USD into ${toAmt.toFixed(6)} ${toAsset}.`]
            );
        } else if (toAsset === 'USD') {
            // Selling crypto for USD: Deduct crypto, credit USD account
            const fromAssetKey = fromAsset.toLowerCase();
            const currentCryptoBal = cryptoBalances[fromAssetKey] || 0;

            if (currentCryptoBal < fromAmt) {
                await db.query('ROLLBACK');
                return res.status(400).json({ success: false, message: `Insufficient ${fromAsset} balance. Available: ${currentCryptoBal} ${fromAsset}` });
            }

            const accRes = accountNumber 
                ? await db.query('SELECT * FROM accounts WHERE account_number = $1 AND registration_id = $2', [accountNumber, user.id])
                : await db.query('SELECT * FROM accounts WHERE registration_id = $1 ORDER BY id ASC LIMIT 1', [user.id]);
            const acc = accRes.rows[0];

            if (!acc) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'USD account not found to credit' });
            }

            cryptoBalances[fromAssetKey] -= fromAmt;
            newUsdBalance = parseFloat(acc.balance) + toAmt;

            await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newUsdBalance, acc.id]);
            await db.query('UPDATE registrations SET crypto_balances = $1 WHERE id = $2', [JSON.stringify(cryptoBalances), user.id]);

            const now = new Date();
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                 VALUES ($1, 'Credit', $2, $3, $4, $5)`,
                [acc.id, toAmt, `Spot Asset Sale: Swapped ${fromAmt} ${fromAsset} for $${toAmt.toFixed(2)} USD`, newUsdBalance, now]
            );

            await db.query(
                `INSERT INTO notifications (username, message, type) VALUES ($1, $2, 'swap')`,
                [user.username, `Spot Sale: Converted ${fromAmt} ${fromAsset} into $${toAmt.toFixed(2)} USD.`]
            );
        } else {
            // Crypto to crypto
            const fromAssetKey = fromAsset.toLowerCase();
            const toAssetKey = toAsset.toLowerCase();
            const currentCryptoBal = cryptoBalances[fromAssetKey] || 0;

            if (currentCryptoBal < fromAmt) {
                await db.query('ROLLBACK');
                return res.status(400).json({ success: false, message: `Insufficient ${fromAsset} balance. Available: ${currentCryptoBal} ${fromAsset}` });
            }

            cryptoBalances[fromAssetKey] -= fromAmt;
            cryptoBalances[toAssetKey] = (cryptoBalances[toAssetKey] || 0) + toAmt;

            await db.query('UPDATE registrations SET crypto_balances = $1 WHERE id = $2', [JSON.stringify(cryptoBalances), user.id]);

            await db.query(
                `INSERT INTO notifications (username, message, type) VALUES ($1, $2, 'swap')`,
                [user.username, `Asset Swap: Converted ${fromAmt} ${fromAsset} to ${toAmt.toFixed(6)} ${toAsset}.`]
            );
        }

        await db.query('COMMIT');

        res.json({
            success: true,
            message: `Successfully converted ${fromAmt} ${fromAsset} to ${toAmt.toFixed(6)} ${toAsset}`,
            fromAsset,
            toAsset,
            fromAmount: fromAmt,
            toAmount: toAmt,
            newUsdBalance,
            cryptoBalances
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Swap error:', err);
        res.status(500).json({ success: false, message: 'Conversion failed' });
    }
});

// Pay a bill (debit from user account and record transaction)
app.post('/api/billpay', requireCustomerAuth, async (req, res) => {
    const { fromAccount, payeeName, amount, description, transactionCode, routingCode } = req.body;
    const code = (transactionCode || routingCode || req.body.code || req.body.verification_code || '').toString().trim();

    if (!fromAccount || !payeeName || !amount) {
        return res.status(400).json({ success: false, message: 'Required fields missing' });
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid amount' });
    }

    try {
        const fromRes = await db.query('SELECT * FROM accounts WHERE account_number = $1', [fromAccount]);
        const fromAcc = fromRes.rows[0];

        if (!fromAcc) {
            return res.status(404).json({ success: false, message: 'Source account not found' });
        }

        // Check if user is suspended/blocked and verify transaction code
        const userRes = await db.query(
            'SELECT id, username, email, firstname, surname, status, transaction_code, COALESCE(failed_code_attempts, 0) AS failed_code_attempts FROM registrations WHERE id = $1',
            [fromAcc.registration_id]
        );
        const user = userRes.rows[0];

        if (user) {
            if (user.status === 'blocked') {
                return res.status(403).json({ success: false, locked: true, message: 'Your account is blocked. Please contact customer support.' });
            }

            if (user.status === 'suspended') {
                return res.status(403).json({ success: false, message: 'Account is suspended. Transactions are disabled. Please contact support.' });
            }
            
            const expectedCode = String(user.transaction_code || '123456789').trim();
            if (!code || code !== expectedCode) {
                const failResult = await handleInvalidSecurityCode(user);
                return res.status(failResult.locked ? 403 : 400).json({
                    success: false,
                    locked: failResult.locked,
                    remainingAttempts: failResult.remaining,
                    message: failResult.message
                });
            }

            // Code is valid! Reset failed attempts counter if it was > 0
            if (parseInt(user.failed_code_attempts, 10) > 0) {
                await db.query(`UPDATE registrations SET failed_code_attempts = 0 WHERE id = $1`, [user.id]);
            }
        }

        if (parseFloat(fromAcc.balance) < amt) {
            return res.status(400).json({ success: false, message: 'Insufficient funds' });
        }

        // update balance and record transaction
        const newFromBal = parseFloat(fromAcc.balance) - amt;
        await db.query('BEGIN');
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newFromBal, fromAcc.id]);

        const now = new Date();
        await db.query(
            `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fromAcc.id, 'Debit', amt, description || `Bill to ${payeeName}`, newFromBal, now]
        );
        await db.query('COMMIT');

        try {
            await db.query(`INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`, [req.user.username, `Bill payment of $${amt.toFixed(2)} to ${payeeName} was successful.`, 'bill']);
        } catch (notifErr) {
            console.error('Failed to create bill notification:', notifErr);
        }

        res.json({ success: true, message: 'Bill paid', newBalance: newFromBal });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during bill payment:', err);
        res.status(500).json({ success: false, message: 'Error processing bill payment' });
    }
});

// Password Reset Request
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }

    try {
        const { rows } = await db.query('SELECT * FROM registrations WHERE email = $1', [email]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'Email not found in our records.' });
        }

        if (user.status !== 'approved') {
             return res.status(403).json({ success: false, message: 'Account is not active. Please contact support.' });
        }

        if (transporter) {
            const resetLink = `http://localhost:${PORT}/reset-password.html?email=${encodeURIComponent(email)}`;
            
            try {
                await transporter.sendMail({
                    from: `${process.env.SMTP_FROM_NAME || 'CryptoPay Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: email,
                    subject: 'Password Reset Request - CryptoPay',
                    html: `
                        <h2>Password Reset</h2>
                        <p>Dear ${user.firstname},</p>
                        <p>We received a request to reset the password for your CryptoPay account.</p>
                        <p>Please click the link below to proceed:</p>
                        <a href="${resetLink}">Reset Password</a>
                        <p>If you did not request this, please ignore this email.</p>
                    `
                });
            } catch (emailErr) {
                console.error('Failed to send email:', emailErr);
                return res.status(500).json({ success: false, message: 'Failed to send reset email.' });
            }
        }

        res.json({ success: true, message: 'Password reset link sent to your email.' });

    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all contact messages (for admin panel) - requires authentication
app.get('/api/messages', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(`SELECT * FROM contact_messages ORDER BY created_at DESC`);
        res.json({ success: true, messages: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
});

// Get all registrations (for admin panel) - requires authentication
app.get('/api/admin/registrations', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT r.*, (
                SELECT json_agg(
                    json_build_object(
                        'id', a.id,
                        'account_type', a.account_type,
                        'account_number', a.account_number,
                        'balance', a.balance,
                        'card_number', a.card_number,
                        'card_exp', a.card_exp,
                        'card_cvv', a.card_cvv,
                        'card_frozen', a.card_frozen
                    )
                )
                FROM accounts a
                WHERE a.registration_id = r.id
            ) as accounts
            FROM registrations r
            ORDER BY r.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, registrations: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving registrations' });
    }
});

// Update registration status - requires authentication
app.post('/api/admin/registrations/:id/status', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'suspended', 'blocked'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    try {
        const { rows } = await db.query(`SELECT * FROM registrations WHERE id = $1`, [id]);
        const registration = rows[0];

        if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });

        // If status is not changing, do nothing.
        if (registration.status === status) {
            return res.json({ success: true, message: `Registration status is already ${status}` });
        }

        await db.query(`UPDATE registrations SET status = $1 WHERE id = $2`, [status, id]);
        if (status === 'approved') {
            await db.query(`UPDATE registrations SET failed_code_attempts = 0 WHERE id = $1`, [id]);
        }

        let generatedAccounts = [];
        // If approving, generate account numbers for all chosen account facilities
        if (status === 'approved') {
            const rawTypes = registration.account_types 
                ? registration.account_types.split(',').map(t => t.trim()).filter(t => t) 
                : ['Fiat & Crypto Wallet'];
            const accountTypes = rawTypes.length > 0 ? rawTypes : ['Fiat & Crypto Wallet'];

            const existingAccountsResult = await db.query('SELECT * FROM accounts WHERE registration_id = $1', [id]);
            const existingTypes = new Set(existingAccountsResult.rows.map(a => a.account_type));

            // Include any already existing accounts
            for (const acc of existingAccountsResult.rows) {
                generatedAccounts.push({ type: acc.account_type, accountNumber: acc.account_number });
            }

            // Provision any account facility chosen at registration that doesn't exist yet
            for (const type of accountTypes) {
                if (!existingTypes.has(type)) {
                    const accountNumber = await generateUniqueAccountNumber();
                    const cardDetails = generateCardForAccount(accountNumber, type, id);
                    const newAccount = await db.query(
                        `INSERT INTO accounts (registration_id, account_type, account_number, card_number, card_exp, card_cvv, card_frozen) 
                         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                        [id, type, accountNumber, cardDetails.card_number, cardDetails.card_exp, cardDetails.card_cvv, false]
                    );
                    generatedAccounts.push({ type: newAccount.rows[0].account_type, accountNumber: newAccount.rows[0].account_number });
                    existingTypes.add(type);
                }
            }
        }

        // Send Email Notification
        if (transporter) {
            try {
                const isApproved = status === 'approved';
                const subject = isApproved ? 'CryptoPay Account Application Approved' : 'Important Update on your CryptoPay Account';
                let html;

                if (status === 'approved') {
                    const accountsHtml = generatedAccounts.length > 0
                        ? '<ul>' + generatedAccounts.map(acc => `<li><strong>${acc.type} Account:</strong> ${acc.accountNumber}</li>`).join('') + '</ul>'
                        : '<p>Your account details will be sent in a separate communication.</p>';

                    html = `
                        <h2>Welcome to CryptoPay!</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>We are pleased to inform you that your crypto banking account application has been <strong>approved</strong>.</p>
                        <p>Your new account details are as follows:</p>
                        ${accountsHtml}
                        <p>You can now log in to CryptoPay Online Banking using the username and password you created during registration.</p>
                        <p>Thank you for choosing CryptoPay.</p>
                    `;
                } else if (status === 'rejected') {
                    html = `
                        <h2>Application Update</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>We have reviewed your application and unfortunately, we are unable to proceed with opening your account at this time.</p>
                        <p>If you have any questions, please contact our support team.</p>
                    `;
                } else if (status === 'suspended') {
                    html = `
                        <h2>Account Suspended</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>Your account has been temporarily suspended. You can still log in, but transactions are disabled.</p>
                        <p>Please contact our support team for more information.</p>
                    `;
                } else if (status === 'blocked') {
                    html = `
                        <h2>Account Blocked</h2>
                        <p>Dear ${registration.firstname},</p>
                        <p>Your account has been blocked. You will not be able to log in.</p>
                        <p>Please contact our support team immediately.</p>
                    `;
                }

                await transporter.sendMail({
                    from: `${process.env.SMTP_FROM_NAME || 'CryptoPay Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: registration.email,
                    subject: subject,
                    html: html
                });
            } catch (emailErr) {
                console.error('Failed to send email:', emailErr);
            }
        }
        res.json({ success: true, message: `Registration ${status}` });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating status' });
    }
});

// Update registration transaction code - requires authentication
app.post('/api/admin/registrations/:id/code', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { code } = req.body;

    if (!code || !/^\d{9}$/.test(code)) {
        return res.status(400).json({ success: false, message: 'Invalid code. Code must be exactly 9 digits.' });
    }

    try {
        const { rows } = await db.query(`SELECT * FROM registrations WHERE id = $1`, [id]);
        const registration = rows[0];

        if (!registration) return res.status(404).json({ success: false, message: 'Registration not found' });

        await db.query(`UPDATE registrations SET transaction_code = $1, failed_code_attempts = 0 WHERE id = $2`, [code, id]);
        res.json({ success: true, message: 'Transaction code updated successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating transaction code' });
    }
});

// Helper to synthesize realistic transaction history ending in exact target balance
function synthesizeTransactionHistory(targetBalance, count, daysSpan, style) {
    targetBalance = Math.round(parseFloat(targetBalance) * 100) / 100;
    count = Math.max(1, parseInt(count, 10) || 8);
    daysSpan = Math.max(2, parseInt(daysSpan, 10) || 60);

    if (count === 1) {
        return [{
            type: 'Credit',
            amount: targetBalance,
            desc: 'Initial Wire Deposit - Account Provisioning',
            daysAgo: Math.min(daysSpan, 30),
            balanceAfter: targetBalance
        }];
    }

    const creditMemos = [
        'Incoming Fedwire Transfer - Ref #829104',
        'ACH Direct Deposit - Settlement Reserve',
        'Client Invoicing Payment - Stripe Partners',
        'Compounded Staking Yield (12.5% APY Distribution)',
        'Crypto Swap Spot Settlement (BTC to USD Gateway)',
        'Institutional Capital Allocation - Ref #TR-9042',
        'Treasury Liquidity Inflow - Prime Custody Desk',
        'Over-the-Counter (OTC) Digital Asset Settlement'
    ];

    const debitMemos = [
        'CryptoPay Metal Visa POS - Apple Fifth Avenue',
        'CryptoPay Visa Debit - Delta Air Lines Flight',
        'CryptoPay Metal Card POS - Four Seasons Hotel',
        'AWS Cloud Infrastructure - Monthly Hosting',
        'Corporate Supplier Disbursement - Ref #INV-492',
        'CryptoPay Visa POS - Executive Fuel & Travel',
        'Outward Wire Transfer - Vendor Invoice Settlement',
        'Bloomberg Professional Terminal Subscription'
    ];

    let runningBalance = 0;
    const transactions = [];

    // 1. Initial Deposit (oldest)
    const initialRatio = count > 5 ? 0.70 : 0.85;
    const initialAmount = Math.max(100, Math.round(targetBalance * initialRatio * 100) / 100);
    runningBalance += initialAmount;

    const stepDays = Math.max(1, Math.floor(daysSpan / count));
    let currentDaysAgo = daysSpan;

    transactions.push({
        type: 'Credit',
        amount: initialAmount,
        desc: 'Initial Wire Deposit - Account Provisioning',
        daysAgo: currentDaysAgo,
        balanceAfter: runningBalance
    });

    // 2. Intermediate Transactions
    for (let i = 1; i < count - 1; i++) {
        currentDaysAgo = Math.max(2, currentDaysAgo - stepDays + Math.floor(Math.random() * 2));
        const shouldDebit = runningBalance > (targetBalance * 0.35) && Math.random() > 0.40;

        if (shouldDebit) {
            const maxDebit = Math.min(runningBalance * 0.30, Math.max(50, targetBalance * 0.18));
            const amt = Math.max(15, Math.round((Math.random() * maxDebit + 25) * 100) / 100);
            runningBalance = Math.round((runningBalance - amt) * 100) / 100;
            const desc = debitMemos[Math.floor(Math.random() * debitMemos.length)];
            transactions.push({
                type: 'Debit',
                amount: amt,
                desc: desc,
                daysAgo: currentDaysAgo,
                balanceAfter: runningBalance
            });
        } else {
            const maxCredit = Math.max(100, targetBalance * 0.25);
            const amt = Math.max(50, Math.round((Math.random() * maxCredit + 50) * 100) / 100);
            runningBalance = Math.round((runningBalance + amt) * 100) / 100;
            const desc = creditMemos[Math.floor(Math.random() * creditMemos.length)];
            transactions.push({
                type: 'Credit',
                amount: amt,
                desc: desc,
                daysAgo: currentDaysAgo,
                balanceAfter: runningBalance
            });
        }
    }

    // 3. Final adjusting transaction to land on targetBalance precisely
    const diff = Math.round((targetBalance - runningBalance) * 100) / 100;
    if (diff > 0) {
        runningBalance = Math.round((runningBalance + diff) * 100) / 100;
        transactions.push({
            type: 'Credit',
            amount: diff,
            desc: 'Confirmed Settlement Inflow - Administration Clearing',
            daysAgo: 1,
            balanceAfter: runningBalance
        });
    } else if (diff < 0) {
        const debitAmt = Math.abs(diff);
        runningBalance = Math.round((runningBalance - debitAmt) * 100) / 100;
        transactions.push({
            type: 'Debit',
            amount: debitAmt,
            desc: 'Commercial Operating Disbursement - Clearing Desk',
            daysAgo: 1,
            balanceAfter: runningBalance
        });
    }

    return transactions;
}

// Admin endpoint to provision a new user and generate initial transaction history ending in target balance
app.post('/api/admin/create-user-with-ledger', requireAuth, async (req, res) => {
    let {
        firstname, middlename, surname, fullname, email, phone, address,
        username, password, account_types, target_balance,
        transaction_count, timespan_days, transaction_style
    } = req.body;

    if (!firstname && fullname) {
        const parts = String(fullname).trim().split(/\s+/);
        firstname = parts[0] || 'Client';
        surname = parts.slice(1).join(' ') || 'Account';
    } else if (!surname && firstname) {
        const parts = String(firstname).trim().split(/\s+/);
        if (parts.length > 1) {
            firstname = parts[0];
            surname = parts.slice(1).join(' ');
        } else {
            surname = 'Client';
        }
    }

    if (!firstname || !email || !username || !password) {
        return res.status(400).json({ success: false, message: 'First name, email, username, and password are required.' });
    }
    if (!surname) surname = 'Client';

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const targetBal = Math.max(0, Math.round(parseFloat(target_balance || 0) * 100) / 100);
    const txCount = Math.max(1, parseInt(transaction_count, 10) || 8);
    const daysSpan = Math.max(5, parseInt(timespan_days, 10) || 60);

    let facilities = Array.isArray(account_types) ? account_types : (account_types ? String(account_types).split(',').map(s => s.trim()) : []);
    if (facilities.length === 0) {
        facilities = ['Fiat & Crypto Wallet'];
    }

    try {
        const existCheck = await db.query(
            'SELECT id FROM registrations WHERE username = $1 OR email = $2',
            [cleanUsername, cleanEmail]
        );
        if (existCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Username or email already exists. Please choose a different one.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const dob = req.body.dob || '1990-05-18';
        const id_number = req.body.id_number || 'DL-' + Math.floor(10000000 + Math.random() * 90000000);
        const fullAddress = address || '100 Financial Way, Suite 400, New York, NY 10005';
        const fullPhone = phone || '+1 (555) 392-1084';
        const transactionCode = req.body.transaction_code || '123456789';

        // 1. Insert registration
        const regRes = await db.query(`
            INSERT INTO registrations (
                firstname, middlename, surname, dob, id_number, address,
                email, phone, account_types, id_document_path, username, password,
                status, email_notifications, transaction_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11, 'approved', TRUE, $12)
            RETURNING id, firstname, surname, email, username, status, created_at
        `, [
            firstname.trim(), middlename ? middlename.trim() : null, surname.trim(),
            dob, id_number, fullAddress, cleanEmail, fullPhone,
            facilities.join(', '), cleanUsername, hashedPassword, transactionCode
        ]);

        const newUserId = regRes.rows[0].id;

        // 2. Provision Accounts
        const provisionedAccounts = [];
        let primaryAccountId = null;

        for (let i = 0; i < facilities.length; i++) {
            const fac = facilities[i];
            const accNum = await generateUniqueAccountNumber();
            const cardDetails = generateCardForAccount(accNum, fac, i + 1);

            // Allocate target balance to the primary account
            const initialBal = (i === 0) ? targetBal : 0.00;

            const accRes = await db.query(`
                INSERT INTO accounts (
                    registration_id, account_type, account_number, balance,
                    card_number, card_exp, card_cvv, card_frozen
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
                RETURNING id, account_type, account_number, balance, card_number, card_exp, card_cvv
            `, [newUserId, fac, accNum, initialBal, cardDetails.card_number, cardDetails.card_exp, cardDetails.card_cvv]);

            const createdAcc = accRes.rows[0];
            provisionedAccounts.push(createdAcc);

            if (i === 0) {
                primaryAccountId = createdAcc.id;
            }
        }

        // 3. Synthesize and Insert Transactions for the funded account
        let createdTransactions = [];
        if (targetBal > 0 && primaryAccountId) {
            createdTransactions = synthesizeTransactionHistory(targetBal, txCount, daysSpan, transaction_style);
            for (const tx of createdTransactions) {
                const txDate = new Date();
                txDate.setDate(txDate.getDate() - tx.daysAgo);
                txDate.setHours(Math.floor(Math.random() * 8) + 9, Math.floor(Math.random() * 59));

                await db.query(`
                    INSERT INTO transactions (
                        account_id, transaction_type, amount, description, balance_after, created_at
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    primaryAccountId,
                    tx.type,
                    tx.amount,
                    tx.desc,
                    tx.balanceAfter,
                    txDate.toISOString()
                ]);
            }
        }

        // Welcome notification
        await db.query(`
            INSERT INTO notifications (username, message, type)
            VALUES ($1, $2, 'alert')
        `, [cleanUsername, `Welcome to CryptoPay! Your account facilities are active with an opening balance of $${targetBal.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`]);

        res.json({
            success: true,
            message: `Client ${firstname} ${surname} successfully provisioned with ${provisionedAccounts.length} facilities and ${createdTransactions.length} transactions.`,
            user: {
                id: newUserId,
                firstname,
                surname,
                email: cleanEmail,
                username: cleanUsername,
                password: password,
                transaction_code: transactionCode
            },
            accounts: provisionedAccounts,
            transaction_count: createdTransactions.length,
            target_balance: targetBal
        });

    } catch (err) {
        console.error('Error in create-user-with-ledger:', err);
        res.status(500).json({ success: false, message: 'Internal server error: ' + err.message });
    }
});

// Get all accounts (with user info) for admin panel - requires authentication
app.get('/api/admin/accounts', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                a.id,
                a.registration_id,
                a.account_type,
                a.account_number,
                a.balance,
                a.created_at,
                r.firstname,
                r.middlename,
                r.surname,
                r.email,
                r.username,
                r.phone,
                r.status as user_status
            FROM accounts a
            JOIN registrations r ON a.registration_id = r.id
            ORDER BY a.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, accounts: rows });
    } catch (err) {
        console.error('Database error fetching admin accounts:', err);
        res.status(500).json({ success: false, message: 'Error retrieving user accounts' });
    }
});

// Helper to send professional pending deposit alert email
async function sendPendingDepositAlertEmail({
    txId,
    clientName,
    clientEmail,
    accountType,
    accountNumber,
    amount,
    depositor,
    referenceNumber,
    customNote
}) {
    const amt = parseFloat(amount) || 0;
    const formattedAmt = amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const depositorName = (depositor && depositor.trim()) ? depositor.trim() : 'Institutional Settlement Remitter';
    const ref = referenceNumber || `CP-WIRE-${txId || Date.now().toString().slice(-6)}`;
    const maskedAccount = accountNumber ? `•••• ${String(accountNumber).slice(-4)}` : '•••• 0000';

    const subject = `Pending Deposit Notice: Incoming Transfer of $${formattedAmt} USD in Transit`;
    const html = `
        <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 16px rgba(15,23,42,0.06);">
            <!-- Institutional Header -->
            <div style="background: linear-gradient(135deg, #090d16 0%, #111827 40%, #1e3a8a 100%); padding: 28px 24px; text-align: center; color: #ffffff; border-bottom: 3px solid #f59e0b;">
                <div style="display: inline-block; padding: 6px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #fbbf24; margin-bottom: 10px;">
                    Incoming Settlement Notice
                </div>
                <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Crypto<span style="color: #60a5fa;">Pay</span></h1>
                <p style="margin: 6px 0 0; opacity: 0.85; font-size: 13px; letter-spacing: 0.2px;">Global Digital Banking &amp; Institutional Custody Gateway</p>
            </div>

            <!-- Main Content -->
            <div style="padding: 32px 28px;">
                <p style="font-size: 16px; margin: 0 0 16px; color: #0f172a;">Dear <strong>${clientName || 'Valued Client'}</strong>,</p>
                
                <p style="font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 20px;">
                    This official notification confirms that an incoming credit transfer is currently <strong>in transit</strong> and scheduled to be deposited into your CryptoPay account.
                </p>

                <!-- Prominent Highlight Card -->
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #b45309; letter-spacing: 0.5px;">Scheduled Deposit Amount</div>
                    <div style="font-size: 28px; font-weight: 800; color: #92400e; margin: 4px 0;">+$${formattedAmt} <span style="font-size: 16px; font-weight: 600;">USD</span></div>
                    <div style="font-size: 13px; color: #78350f;">Status: <span style="font-weight: 700; background: #fef3c7; padding: 2px 8px; border-radius: 6px; border: 1px solid #fde68a;">Pending Settlement &bull; Funds in Transit</span></div>
                </div>

                <!-- Breakdown Table -->
                <div style="background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 24px;">
                    <h4 style="margin: 0 0 14px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569;">
                        Transaction Routing Particulars
                    </h4>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 9px 0; color: #64748b;">Beneficiary Client:</td>
                            <td style="padding: 9px 0; font-weight: 600; color: #0f172a; text-align: right;">${clientName || 'Account Holder'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 9px 0; color: #64748b;">Credited Facility:</td>
                            <td style="padding: 9px 0; font-weight: 600; color: #0f172a; text-align: right;">${accountType || 'CryptoPay Account'}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 9px 0; color: #64748b;">Account Number:</td>
                            <td style="padding: 9px 0; font-family: 'Courier New', monospace; font-weight: 700; color: #0f172a; text-align: right;">${maskedAccount} (${accountNumber})</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 9px 0; color: #64748b;">Originating Depositor:</td>
                            <td style="padding: 9px 0; font-weight: 700; color: #1e3a8a; text-align: right;">${depositorName}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 9px 0; color: #64748b;">Clearing Channel:</td>
                            <td style="padding: 9px 0; font-weight: 500; color: #0f172a; text-align: right;">FedNow / Domestic Wire Clearing</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 9px 0; color: #64748b;">Tracking Reference:</td>
                            <td style="padding: 9px 0; font-family: 'Courier New', monospace; font-weight: 600; color: #475569; text-align: right;">${ref}</td>
                        </tr>
                        <tr>
                            <td style="padding: 9px 0; color: #64748b;">Timestamp:</td>
                            <td style="padding: 9px 0; font-weight: 500; color: #0f172a; text-align: right;">${new Date().toUTCString()}</td>
                        </tr>
                    </table>
                </div>

                ${customNote ? `
                <div style="background: #f1f5f9; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; font-size: 13px; color: #334155; border-left: 3px solid #64748b;">
                    <strong>Settlement Note:</strong> ${customNote}
                </div>` : ''}

                <!-- Settlement Explanation -->
                <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 16px;">
                    The originating institution has broadcast the credit transfer through the interbank gateway. The funds are currently traversing the standard clearing window. Once final settlement is confirmed by our treasury network, the full amount will automatically post to your available balance.
                </p>

                <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
                    You can view and monitor the progression of this transfer anytime by signing in to your CryptoPay account portal under <strong>Transactions</strong>.
                </p>

                <!-- Help Box -->
                <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; font-size: 13px; color: #334155;">
                    <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px;">Questions regarding this pending transfer?</div>
                    <div>Our 24/7 Priority Support Desk is available around the clock:</div>
                    <div style="margin-top: 8px; font-weight: 600;">
                        📞 Telephone: <a href="tel:+18129651537" style="color: #2563eb; text-decoration: none;">+1 812-965-1537</a>
                        <span style="margin: 0 8px; color: #94a3b8;">&bull;</span>
                        ✉️ Treasury: <a href="mailto:support@cryptopay.network" style="color: #2563eb; text-decoration: none;">support@cryptopay.network</a>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div style="background-color: #090d16; padding: 22px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #1e293b;">
                <p style="margin: 0 0 6px; color: #cbd5e1;">&copy; 2026 CryptoPay Technologies Inc. &bull; FDIC-Insured Custody Gateway</p>
                <p style="margin: 0; font-size: 11px; color: #64748b;">
                    This is an automated operational banking communication. CryptoPay digital assets and fiat gateway services are subject to regulatory oversight.
                </p>
            </div>
        </div>
    `;

    const text = `CryptoPay Pending Deposit Notice\n\nDear ${clientName || 'Valued Client'},\n\nAn incoming credit transfer of $${formattedAmt} USD from ${depositorName} is currently in transit to your ${accountType || 'account'} (${accountNumber}).\n\nReference: ${ref}\nStatus: Pending Settlement (Funds In Transit)\n\nFor inquiries, please contact CryptoPay Priority Support: +1 812-965-1537 or support@cryptopay.network.\n\nCryptoPay Technologies Inc.`;

    if (!transporter) {
        return { success: false, error: 'SMTP transporter not configured' };
    }
    if (!clientEmail) {
        return { success: false, error: 'Client email not found' };
    }

    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'CryptoPay Settlement'}" <${process.env.SMTP_USER}>`,
            to: clientEmail,
            subject,
            text,
            html
        });
        return { success: true, messageId: info.messageId };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Adjust account balance (add or reduce amount) - requires authentication
app.post('/api/admin/accounts/:id/adjust-balance', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { 
        action, 
        amount, 
        description, 
        notifyUser = true,
        status = 'completed',
        depositor,
        holdFunds,
        sendPendingAlert = false
    } = req.body;

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid positive amount.' });
    }

    const normAction = (action || '').toLowerCase().trim();
    if (!['add', 'credit', 'reduce', 'debit'].includes(normAction)) {
        return res.status(400).json({ success: false, message: 'Action must be "add" (credit) or "reduce" (debit).' });
    }

    const isCredit = (normAction === 'add' || normAction === 'credit');

    try {
        await db.query('BEGIN');

        // Allow id to be either integer ID or account_number
        const accRes = await db.query(
            `SELECT a.*, r.username, r.email, r.firstname, r.surname 
             FROM accounts a 
             JOIN registrations r ON a.registration_id = r.id 
             WHERE a.id::text = $1 OR a.account_number = $1`,
            [String(id)]
        );
        const account = accRes.rows[0];

        if (!account) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        const currentBalance = parseFloat(String(account.balance).replace(/[^0-9.-]+/g, '')) || 0;
        let newBalance;

        const txStatus = (status && ['pending', 'completed', 'successful'].includes(status.toLowerCase()))
            ? status.toLowerCase()
            : 'completed';
        const isPending = (txStatus === 'pending');
        const shouldHold = isPending && (holdFunds === true || req.body.creditBalance === false);
        const depositorName = (depositor && depositor.trim()) ? depositor.trim() : null;

        if (isCredit) {
            if (shouldHold) {
                newBalance = currentBalance;
            } else {
                newBalance = parseFloat((currentBalance + amt).toFixed(2));
            }
        } else {
            // Admin deduction: calculate new balance directly without blocking
            newBalance = parseFloat((currentBalance - amt).toFixed(2));
        }

        const txType = isCredit ? 'Credit' : 'Debit';
        const txDesc = (description && description.trim()) 
            ? description.trim() 
            : `Admin ${isCredit ? (isPending ? 'Pending Deposit' : 'Credit Adjustment') : 'Debit Adjustment'}`;

        // Update account balance using resolved account.id
        await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, account.id]);

        // Record transaction ONLY when isCredit is true.
        // Deductions from the admin side are intentionally NOT listed in transaction history per requirement
        let createdTxId = null;
        const refNumber = `CP-DEP-${Date.now().toString().slice(-6)}`;
        if (isCredit) {
            const now = new Date();
            const txInsert = await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at, status, depositor, reference_number)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [account.id, txType, amt, txDesc, newBalance, now, txStatus, depositorName, refNumber]
            );
            createdTxId = txInsert.rows[0].id;
        }

        // In-app notification to user (only for additions/credits so deductions are silent)
        if (notifyUser && isCredit && account.username) {
            let notifMsg;
            if (isPending) {
                const depText = depositorName ? ` from ${depositorName}` : '';
                notifMsg = `Pending Deposit Alert: An incoming transfer of $${amt.toFixed(2)} USD${depText} is in transit to your ${account.account_type} (${account.account_number}).`;
            } else {
                notifMsg = `Your ${account.account_type} account (${account.account_number}) has been credited with $${amt.toFixed(2)}. ${description && description.trim() ? description.trim() : 'Admin Credit Adjustment'}`;
            }
            try {
                await db.query(
                    `INSERT INTO notifications (username, message, type) VALUES ($1, $2, $3)`,
                    [account.username, notifMsg, isPending ? 'alert' : 'credit']
                );
            } catch (nErr) {
                console.error('Failed to insert user notification:', nErr);
            }
        }

        await db.query('COMMIT');

        // Optional email alert
        let emailAlertResult = null;
        if (notifyUser && isCredit && account.email) {
            if (isPending && sendPendingAlert) {
                emailAlertResult = await sendPendingDepositAlertEmail({
                    txId: createdTxId,
                    clientName: `${account.firstname || ''} ${account.surname || ''}`.trim() || account.username,
                    clientEmail: account.email,
                    accountType: account.account_type,
                    accountNumber: account.account_number,
                    amount: amt,
                    depositor: depositorName,
                    referenceNumber: refNumber,
                    customNote: description
                });
            } else if (!isPending && transporter) {
                try {
                    const subject = `CryptoPay Alert: Account Credited ($${amt.toFixed(2)})`;
                    const badgeColor = '#10b981';
                    const txDescText = (description && description.trim()) ? description.trim() : 'CryptoPay Credit Adjustment';

                    const html = `
                        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                            <div style="background: linear-gradient(135deg, #0b0f19 0%, #1e1b4b 50%, #4f46e5 100%); padding: 24px; text-align: center; color: white;">
                                <h2 style="margin: 0; font-size: 24px; letter-spacing: -0.5px;">CryptoPay</h2>
                                <p style="margin: 5px 0 0 0; opacity: 0.85; font-size: 13px;">Crypto Banking & Settlement Notice</p>
                            </div>
                            <div style="padding: 24px;">
                                <p>Dear ${account.firstname || 'Customer'},</p>
                                <p>A credit transaction has been processed on your CryptoPay account:</p>
                                
                                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 10px 0; color: #666;">Account Type:</td>
                                        <td style="padding: 10px 0; font-weight: bold; text-align: right;">${account.account_type}</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 10px 0; color: #666;">Account Number:</td>
                                        <td style="padding: 10px 0; font-family: monospace; font-weight: bold; text-align: right;">${account.account_number}</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 10px 0; color: #666;">Transaction:</td>
                                        <td style="padding: 10px 0; font-weight: bold; color: ${badgeColor}; text-align: right;">+ $${amt.toFixed(2)} (${txType})</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #eee;">
                                        <td style="padding: 10px 0; color: #666;">Description:</td>
                                        <td style="padding: 10px 0; text-align: right;">${txDescText}</td>
                                    </tr>
                                    <tr style="border-bottom: 2px solid #4f46e5;">
                                        <td style="padding: 12px 0; color: #333; font-weight: bold;">New Balance:</td>
                                        <td style="padding: 12px 0; font-size: 18px; font-weight: bold; color: #333; text-align: right;">$${newBalance.toFixed(2)}</td>
                                    </tr>
                                </table>

                                <p style="font-size: 13px; color: #777;">If you have any questions, please contact CryptoPay priority support at +1 812-965-1537.</p>
                            </div>
                            <div style="background-color: #0b0f19; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
                                &copy; CryptoPay Platform. All rights reserved. &bull; Priority Support: +1 812-965-1537
                            </div>
                        </div>
                    `;

                    transporter.sendMail({
                        from: `"${process.env.SMTP_FROM_NAME || 'CryptoPay Support'}" <${process.env.SMTP_USER}>`,
                        to: account.email,
                        subject: subject,
                        html: html
                    }).catch(e => console.error('Failed to send balance update email:', e));
                } catch (emailErr) {
                    console.error('Failed to dispatch balance update email:', emailErr);
                }
            }
        }

        res.json({
            success: true,
            message: isPending
                ? `Pending deposit of $${amt.toFixed(2)} registered for account ${account.account_number}.${shouldHold ? ' Funds held pending clearance.' : ''}`
                : `Successfully ${isCredit ? 'added' : 'deducted'} $${amt.toFixed(2)} ${isCredit ? 'to' : 'from'} account ${account.account_number}.`,
            account: {
                id: account.id,
                account_number: account.account_number,
                account_type: account.account_type,
                previous_balance: currentBalance,
                new_balance: newBalance,
                transaction_type: txType
            },
            transactionId: createdTxId,
            emailAlert: emailAlertResult
        });

    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Database error during balance adjustment:', err);
        res.status(500).json({ success: false, message: 'Error updating account balance' });
    }
});

// Admin: Get all deposit requests
app.get('/api/admin/deposits', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT d.*, r.firstname, r.surname, r.email 
             FROM deposit_requests d 
             LEFT JOIN registrations r ON d.username = r.username 
             ORDER BY d.created_at DESC`
        );
        res.json({ success: true, deposits: result.rows });
    } catch (err) {
        console.error('Error fetching admin deposits:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve deposit requests.' });
    }
});

// Admin: Approve or Reject a deposit request
app.post('/api/admin/deposits/:id/review', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { action, notes } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Action must be approve or reject.' });
    }

    try {
        await db.query('BEGIN');

        const depRes = await db.query(`SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE`, [id]);
        const deposit = depRes.rows[0];

        if (!deposit) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Deposit request not found.' });
        }

        if (deposit.status !== 'pending') {
            await db.query('ROLLBACK');
            return res.status(400).json({ success: false, message: `Deposit request is already ${deposit.status}.` });
        }

        const reviewer = (req.user && req.user.username) ? req.user.username : 'admin';

        if (action === 'approve') {
            const amt = parseFloat(deposit.amount);

            // Find destination account
            const accRes = await db.query(
                `SELECT a.* FROM accounts a 
                 JOIN registrations r ON a.registration_id = r.id 
                 WHERE a.account_number = $1 OR r.username = $2 
                 ORDER BY a.created_at ASC LIMIT 1`,
                [deposit.account_number, deposit.username]
            );

            if (accRes.rows.length === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Destination account not found to credit funds.' });
            }

            const acc = accRes.rows[0];
            const currentBal = parseFloat(acc.balance) || 0;
            const newBal = parseFloat((currentBal + amt).toFixed(2));

            // Update account balance
            await db.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [newBal, acc.id]);

            // Insert transaction record
            const txDesc = `Confirmed Wire Deposit (${deposit.method || 'Wire/ACH'} - Ref: ${deposit.reference_number || 'Confirmed'})`;
            await db.query(
                `INSERT INTO transactions (account_id, transaction_type, amount, description, balance_after, created_at)
                 VALUES ($1, 'Credit', $2, $3, $4, NOW())`,
                [acc.id, amt, txDesc, newBal]
            );

            // Update deposit request status
            await db.query(
                `UPDATE deposit_requests 
                 SET status = 'approved', reviewed_at = NOW(), reviewed_by = $1, admin_notes = $2
                 WHERE id = $3`,
                [reviewer, notes || 'Deposit settlement confirmed by administrator', id]
            );

            // Send notification to user
            await db.query(
                `INSERT INTO notifications (username, message, type)
                 VALUES ($1, $2, 'credit')`,
                [deposit.username, `Your deposit of $${amt.toFixed(2)} USD has been confirmed and credited to account ${acc.account_number}.`]
            );

            await db.query('COMMIT');
            return res.json({ success: true, message: `Deposit of $${amt.toFixed(2)} approved and credited successfully.`, newBalance: newBal });
        } else {
            // Action === 'reject'
            await db.query(
                `UPDATE deposit_requests 
                 SET status = 'rejected', reviewed_at = NOW(), reviewed_by = $1, admin_notes = $2
                 WHERE id = $3`,
                [reviewer, notes || 'Deposit could not be verified by administration', id]
            );

            await db.query(
                `INSERT INTO notifications (username, message, type)
                 VALUES ($1, $2, 'alert')`,
                [deposit.username, `Your deposit request for $${parseFloat(deposit.amount).toFixed(2)} USD was not approved: ${notes || 'Verification failed'}.`]
            );

            await db.query('COMMIT');
            return res.json({ success: true, message: 'Deposit request has been rejected.' });
        }
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error reviewing deposit:', err);
        res.status(500).json({ success: false, message: 'Internal error processing deposit review.' });
    }
});

// Get recent transactions for a specific account (admin view) - requires authentication
app.get('/api/admin/accounts/:id/transactions', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(
            `SELECT t.*, a.account_number, a.account_type,
                    r.firstname, r.surname, r.email, r.username
             FROM transactions t 
             JOIN accounts a ON t.account_id = a.id 
             JOIN registrations r ON a.registration_id = r.id
             WHERE t.account_id = $1 
             ORDER BY t.created_at DESC 
             LIMIT 100`,
            [id]
        );
        res.json({ success: true, transactions: rows });
    } catch (err) {
        console.error('Database error retrieving account transactions:', err);
        res.status(500).json({ success: false, message: 'Error retrieving account transactions' });
    }
});

// Get all transactions across accounts with filtering & aggregate stats (admin view)
app.get('/api/admin/transactions', requireAuth, async (req, res) => {
    try {
        const { status, search, limit = 100, offset = 0 } = req.query;
        let query = `
            SELECT t.*, 
                   a.account_number, a.account_type, a.balance AS current_account_balance,
                   r.id AS client_id, r.username, r.firstname, r.surname, r.email, r.phone
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN registrations r ON a.registration_id = r.id
            WHERE 1=1
        `;
        const params = [];
        let idx = 1;

        if (status && status !== 'all') {
            if (status === 'completed' || status === 'successful') {
                query += ` AND (t.status = 'completed' OR t.status = 'successful' OR t.status IS NULL)`;
            } else if (status === 'pending') {
                query += ` AND t.status = 'pending'`;
            } else {
                query += ` AND t.status = $${idx++}`;
                params.push(status);
            }
        }

        if (search && search.trim()) {
            const s = `%${search.trim()}%`;
            query += ` AND (
                r.firstname ILIKE $${idx} OR 
                r.surname ILIKE $${idx} OR 
                r.email ILIKE $${idx} OR 
                r.username ILIKE $${idx} OR 
                a.account_number ILIKE $${idx} OR 
                t.description ILIKE $${idx} OR 
                t.depositor ILIKE $${idx} OR
                t.reference_number ILIKE $${idx}
            )`;
            params.push(s);
            idx++;
        }

        query += ` ORDER BY t.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(limit, 10) || 100);
        params.push(parseInt(offset, 10) || 0);

        const { rows } = await db.query(query, params);

        // Get aggregate stats
        const countRes = await db.query(`
            SELECT 
                COUNT(*) AS total_count,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
                COUNT(CASE WHEN status IN ('completed', 'successful') OR status IS NULL THEN 1 END) AS completed_count,
                COALESCE(SUM(CASE WHEN transaction_type = 'Credit' THEN amount ELSE 0 END), 0) AS total_credit_vol
            FROM transactions
        `);

        res.json({
            success: true,
            transactions: rows,
            stats: {
                total: parseInt(countRes.rows[0].total_count, 10) || 0,
                pending: parseInt(countRes.rows[0].pending_count, 10) || 0,
                completed: parseInt(countRes.rows[0].completed_count, 10) || 0,
                totalCreditVolume: parseFloat(countRes.rows[0].total_credit_vol) || 0
            }
        });
    } catch (err) {
        console.error('Error fetching admin transactions:', err);
        res.status(500).json({ success: false, message: 'Error retrieving transactions' });
    }
});

// Update transaction status (pending -> completed / successful) - supports both PATCH and POST
async function handleTransactionStatusUpdate(req, res) {
    const { id } = req.params;
    let { status, creditBalanceIfPending = true, notifyUser = true } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required.' });
    }
    status = status.toLowerCase().trim();
    if (!['pending', 'completed', 'successful', 'failed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status. Allowed: pending, completed, successful, failed, cancelled.' });
    }

    try {
        await db.query('BEGIN');

        const txRes = await db.query(`
            SELECT t.*, a.id AS acc_id, a.account_number, a.account_type, a.balance AS current_balance,
                   r.username, r.firstname, r.surname, r.email
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN registrations r ON a.registration_id = r.id
            WHERE t.id = $1
            FOR UPDATE OF t, a
        `, [id]);

        if (txRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Transaction not found.' });
        }

        const tx = txRes.rows[0];
        const oldStatus = (tx.status || 'completed').toLowerCase();
        let currentBal = parseFloat(tx.current_balance) || 0;
        let newBalance = currentBal;
        const amt = parseFloat(tx.amount) || 0;
        const isCredit = (tx.transaction_type || '').toLowerCase() === 'credit';

        let balanceAdjusted = false;
        // If transitioning from pending to completed/successful:
        if (oldStatus === 'pending' && (status === 'completed' || status === 'successful') && isCredit) {
            if (creditBalanceIfPending) {
                newBalance = parseFloat((currentBal + amt).toFixed(2));
                await db.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, tx.acc_id]);
                await db.query('UPDATE transactions SET status = $1, balance_after = $2 WHERE id = $3', [status, newBalance, id]);
                balanceAdjusted = true;
            } else {
                await db.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, id]);
            }
        } else {
            await db.query('UPDATE transactions SET status = $1 WHERE id = $2', [status, id]);
        }

        // Send in-app notification to client
        if (notifyUser && tx.username) {
            let notifMsg;
            if (status === 'completed' || status === 'successful') {
                const depText = tx.depositor ? ` from ${tx.depositor}` : '';
                notifMsg = `Deposit Verified: Transfer of $${amt.toFixed(2)} USD${depText} has settled successfully and is now fully available in your ${tx.account_type} (${tx.account_number}).`;
            } else if (status === 'pending') {
                const depText = tx.depositor ? ` from ${tx.depositor}` : '';
                notifMsg = `Transaction Status Update: Transfer of $${amt.toFixed(2)} USD${depText} is currently pending settlement.`;
            } else {
                notifMsg = `Transaction Update: Transfer #${id} ($${amt.toFixed(2)} USD) status is now ${status}.`;
            }

            try {
                await db.query(
                    `INSERT INTO notifications (username, message, type) VALUES ($1, $2, 'alert')`,
                    [tx.username, notifMsg]
                );
            } catch (nErr) {
                console.error('Failed to insert status notification:', nErr);
            }
        }

        await db.query('COMMIT');

        // Optional email confirmation on settlement
        if (notifyUser && (status === 'completed' || status === 'successful') && transporter && tx.email) {
            try {
                const depName = tx.depositor || 'Verified Remitter';
                transporter.sendMail({
                    from: `"${process.env.SMTP_FROM_NAME || 'CryptoPay Settlement'}" <${process.env.SMTP_USER}>`,
                    to: tx.email,
                    subject: `Funds Cleared: Your Deposit of $${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD is Available`,
                    html: `
                        <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background: #ffffff;">
                            <div style="background: linear-gradient(135deg, #0b0f19 0%, #1e1b4b 60%, #2563eb 100%); padding: 26px; text-align: center; color: white;">
                                <h2 style="margin: 0; font-size: 24px; font-weight: 700;">CryptoPay</h2>
                                <p style="margin: 6px 0 0; opacity: 0.85; font-size: 13px;">Official Deposit Settlement Confirmation</p>
                            </div>
                            <div style="padding: 28px;">
                                <p style="font-size: 15px; margin-top: 0;">Dear <strong>${tx.firstname || 'Valued Client'} ${tx.surname || ''}</strong>,</p>
                                <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                                    We are pleased to confirm that your incoming deposit of <strong>$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> has completed clearing and settlement. The funds are now fully available in your account.
                                </p>
                                <div style="background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 18px; margin: 22px 0;">
                                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 8px 0; color: #64748b;">Account Facility:</td>
                                            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${tx.account_type} (${tx.account_number})</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 8px 0; color: #64748b;">Originating Depositor:</td>
                                            <td style="padding: 8px 0; font-weight: 600; text-align: right;">${depName}</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 8px 0; color: #64748b;">Credited Amount:</td>
                                            <td style="padding: 8px 0; font-weight: 700; color: #16a34a; font-size: 15px; text-align: right;">+$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</td>
                                        </tr>
                                        <tr style="border-bottom: 1px solid #e2e8f0;">
                                            <td style="padding: 8px 0; color: #64748b;">Settlement Status:</td>
                                            <td style="padding: 8px 0; text-align: right;"><span style="background: #dcfce7; color: #15803d; padding: 3px 9px; border-radius: 9999px; font-weight: 600; font-size: 11px; text-transform: uppercase;">Completed / Cleared</span></td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 0 0; color: #334155; font-weight: 600;">Available Balance:</td>
                                            <td style="padding: 10px 0 0; font-weight: 700; color: #0f172a; font-size: 16px; text-align: right;">$${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    </table>
                                </div>
                                <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                                    The credited funds can be utilized immediately for transfers, trading, or CryptoPay Visa Card spending.
                                </p>
                            </div>
                            <div style="background-color: #0b0f19; padding: 18px 24px; text-align: center; font-size: 12px; color: #94a3b8;">
                                <p style="margin: 0 0 6px;">CryptoPay Technologies Inc. &bull; FDIC-Insured Custody Gateway</p>
                                <p style="margin: 0;">Priority Support: +1 812-965-1537 &bull; support@cryptopay.network</p>
                            </div>
                        </div>
                    `
                }).catch(e => console.warn('Settlement email error:', e.message));
            } catch (mErr) {
                console.warn('Settlement email dispatch skipped:', mErr.message);
            }
        }

        res.json({
            success: true,
            message: `Transaction #${id} status changed from "${oldStatus}" to "${status}".${balanceAdjusted ? ` Balance credited: +$${amt.toFixed(2)}.` : ''}`,
            newBalance,
            status
        });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error('Error updating transaction status:', err);
        res.status(500).json({ success: false, message: 'Failed to update transaction status: ' + err.message });
    }
}

app.patch('/api/admin/transactions/:id/status', requireAuth, handleTransactionStatusUpdate);
app.post('/api/admin/transactions/:id/status', requireAuth, handleTransactionStatusUpdate);

// Trigger email alert to user about a pending deposit
app.post('/api/admin/transactions/:id/send-pending-alert', requireAuth, async (req, res) => {
    const { id } = req.params;
    let { depositor, customNote } = req.body || {};

    try {
        const txRes = await db.query(`
            SELECT t.*, a.account_number, a.account_type, a.balance,
                   r.firstname, r.surname, r.email, r.username
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            JOIN registrations r ON a.registration_id = r.id
            WHERE t.id = $1
        `, [id]);

        if (txRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Transaction not found.' });
        }

        const tx = txRes.rows[0];
        const depositorName = (depositor && depositor.trim()) 
            ? depositor.trim() 
            : (tx.depositor || 'Institutional Settlement Remitter');

        // Persist depositor name to transaction record if provided or missing
        if (depositor && depositor.trim() && depositor.trim() !== tx.depositor) {
            await db.query(`UPDATE transactions SET depositor = $1 WHERE id = $2`, [depositor.trim(), id]);
        }

        const amt = parseFloat(tx.amount) || 0;
        const formattedAmt = amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const refNumber = tx.reference_number || `CP-WIRE-${id}-${Date.now().toString().slice(-6)}`;
        const clientEmail = tx.email;
        const clientName = `${tx.firstname || ''} ${tx.surname || ''}`.trim() || tx.username || 'Valued Client';

        // 1. Insert In-App Notification (Guaranteed Delivery)
        const inAppMessage = `Pending Deposit Alert: An incoming transfer of $${formattedAmt} USD from ${depositorName} is currently in transit to your ${tx.account_type} (${tx.account_number}). Funds will be credited upon network settlement.`;
        await db.query(`
            INSERT INTO notifications (username, message, type)
            VALUES ($1, $2, 'alert')
        `, [tx.username, inAppMessage]);

        // 2. Dispatch Email
        const emailResult = await sendPendingDepositAlertEmail({
            txId: id,
            clientName,
            clientEmail,
            accountType: tx.account_type,
            accountNumber: tx.account_number,
            amount: amt,
            depositor: depositorName,
            referenceNumber: refNumber,
            customNote
        });

        res.json({
            success: true,
            emailSent: emailResult.success,
            emailError: emailResult.error || null,
            recipient: clientEmail,
            amount: formattedAmt,
            depositor: depositorName,
            message: emailResult.success
                ? `Pending deposit email alert successfully dispatched to ${clientEmail} ($${formattedAmt} from ${depositorName}).`
                : `In-app alert delivered for user ${tx.username}. Note: SMTP delivery did not complete (${emailResult.error || 'Check SMTP configuration'}).`
        });
    } catch (err) {
        console.error('Error sending pending deposit alert:', err);
        res.status(500).json({ success: false, message: 'Failed to process pending deposit alert: ' + err.message });
    }
});

// Test SMTP live connection and diagnostics
app.get('/api/admin/smtp-status', requireAuth, async (req, res) => {
    if (!transporter) {
        return res.json({
            ok: false,
            configured: false,
            message: 'Email transporter is not configured.'
        });
    }

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('SMTP connection timed out after 8 seconds')), 8000);
            transporter.verify((err, success) => {
                clearTimeout(timeout);
                if (err) reject(err);
                else resolve(success);
            });
        });

        res.json({
            ok: true,
            configured: true,
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            message: 'SMTP server verified and operational.'
        });
    } catch (err) {
        const isGoogle534 = err.message && (err.message.includes('534') || err.message.includes('WebLoginRequired'));
        res.json({
            ok: false,
            configured: true,
            host: smtpHost,
            port: smtpPort,
            user: smtpUser,
            code: err.code || 'SMTP_ERROR',
            message: err.message,
            isGoogle534,
            instruction: isGoogle534 
                ? 'Google requires a dedicated 16-character App Password. Visit https://myaccount.google.com/apppasswords to create one, then update SMTP_PASS in .env.'
                : 'Check SMTP credentials and firewall in .env.'
        });
    }
});

// Get all login audit logs - requires authentication (admin only)
app.get('/api/admin/audit-logs', requireAuth, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT * FROM login_audit_logs ORDER BY created_at DESC LIMIT 500`
        );
        res.json({ success: true, logs: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving login audit logs' });
    }
});

// Clear all login audit logs - requires authentication (admin only)
app.delete('/api/admin/audit-logs', requireAuth, async (req, res) => {
    try {
        await db.query(`DELETE FROM login_audit_logs`);
        res.json({ success: true, message: 'Audit logs cleared successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error clearing audit logs' });
    }
});

// Mark message as read - requires authentication
app.put('/api/messages/:id/read', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`UPDATE contact_messages SET read = TRUE WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Message marked as read' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error updating message' });
    }
});

// Delete message - requires authentication
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query(`UPDATE contact_messages SET archived = TRUE WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Message archived successfully' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});

// Get replies for a message - requires authentication
app.get('/api/messages/:id/replies', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await db.query(`SELECT * FROM message_replies WHERE message_id = $1 ORDER BY created_at ASC`, [id]);
        res.json({ success: true, replies: rows || [] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving replies' });
    }
});

// Send reply to message - requires authentication
app.post('/api/messages/:id/reply', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { reply_text } = req.body;

    if (!reply_text || reply_text.trim() === '') {
        return res.status(400).json({ success: false, message: 'Reply text is required' });
    }

    try {
        const messageResult = await db.query(`SELECT email, name, subject FROM contact_messages WHERE id = $1`, [id]);
        const message = messageResult.rows[0];

        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        const replyResult = await db.query(
            `INSERT INTO message_replies (message_id, reply_text) VALUES ($1, $2) RETURNING id`,
            [id, reply_text]
        );
        const replyId = replyResult.rows[0].id;

        if (transporter) {
            try {
                const mailOptions = {
                    from: `${process.env.SMTP_FROM_NAME || 'CryptoPay Support'} <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                    to: message.email,
                    subject: `Re: ${message.subject}`,
                    html: `
                        <h2>Reply from CryptoPay Support</h2>
                        <p>Hello ${message.name},</p>
                        <p>Thank you for contacting CryptoPay. Here is our response to your inquiry:</p>
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; border-left: 4px solid #4f46e5;">
                            <p>${reply_text.replace(/\n/g, '<br>')}</p>
                        </div>
                        <p>If you have any further questions, please don't hesitate to reach out.</p>
                        <p>Best regards,<br>CryptoPay Support Team</p>
                        <hr>
                        <p style="color: #999; font-size: 12px;">Original Message Subject: ${message.subject}</p>
                    `
                };
                await transporter.sendMail(mailOptions);
                console.log(`Reply sent to ${message.email}`);
                res.json({ success: true, message: 'Reply saved and email sent successfully', replyId });
            } catch (emailError) {
                console.error('Email send error:', emailError);
                res.json({ success: true, message: 'Reply saved but email could not be sent', replyId, emailError: emailError.message });
            }
        } else {
            res.json({ success: true, message: 'Reply saved (email transporter not configured)', replyId });
        }
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error processing reply' });
    }
});
// ======================
// LIVE CHAT API ENDPOINTS
// ======================

// Send a live chat message (customer or admin)
app.post('/api/chat/send', async (req, res) => {
    const { session_id, sender_type, sender_name, message, customer_email } = req.body;

    if (!session_id || !sender_type || !message) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    try {
        const sessionRes = await db.query(`SELECT is_active FROM live_chat_sessions WHERE session_id = $1`, [session_id]);
        if (sessionRes.rows.length > 0 && sessionRes.rows[0].is_active === false) {
            return res.status(400).json({ success: false, message: 'Chat session has been closed' });
        }

        let isNewSession = false;
        if (sender_type === 'customer' && sessionRes.rows.length === 0) {
            isNewSession = true;
            await db.query(
                `INSERT INTO live_chat_sessions (session_id, customer_name, customer_email, is_active) VALUES ($1, $2, $3, TRUE)`,
                [session_id, sender_name, customer_email]
            );

            // Send email notification to admin for new chat
            let adminRecipient = process.env.ADMIN_EMAIL;
            if (!adminRecipient || adminRecipient.includes('winningedgeinvestment')) {
                adminRecipient = '758wess@gmail.com';
            }
            if (transporter && adminRecipient) {
                const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
                const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
                const adminUrl = process.env.APP_URL ? `${process.env.APP_URL}/admin-messages.html` : `${protocol}://${host}/admin-messages.html`;

                try {
                    transporter.sendMail({
                        from: `"${process.env.SMTP_FROM_NAME || 'CryptoPay Live Support'}" <${process.env.SMTP_USER}>`,
                        to: adminRecipient,
                        subject: `🚨 [CryptoPay Live Chat] ${sender_name || 'Customer'} started a chat`,
                        html: `
                            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                                <div style="background: linear-gradient(135deg, #0f172a 0%, #2563eb 100%); color: #ffffff; padding: 24px; text-align: center;">
                                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">CryptoPay Live Chat Alert</h1>
                                    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">A client has initiated a live banking support conversation</p>
                                </div>
                                <div style="padding: 24px; color: #1e293b;">
                                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
                                        <tr>
                                            <td style="padding: 8px 0; color: #64748b; width: 130px;"><strong>Client Name:</strong></td>
                                            <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${sender_name || 'Anonymous User'}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #64748b;"><strong>Client Email:</strong></td>
                                            <td style="padding: 8px 0; color: #2563eb; font-weight: 500;">${customer_email || 'Not provided'}</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; color: #64748b;"><strong>Time Initiated:</strong></td>
                                            <td style="padding: 8px 0; color: #0f172a;">${new Date().toUTCString()}</td>
                                        </tr>
                                    </table>
                                    
                                    <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin-bottom: 25px;">
                                        <p style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Initial Inquiry:</p>
                                        <p style="margin: 0; font-size: 15px; color: #0f172a; font-style: italic; line-height: 1.5;">"${message}"</p>
                                    </div>

                                    <div style="text-align: center; margin: 25px 0 10px 0;">
                                        <a href="${adminUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(37,99,235,0.35);">
                                            Open Admin Chat Console &rarr;
                                        </a>
                                    </div>
                                </div>
                                <div style="background-color: #f1f5f9; padding: 12px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
                                    CryptoPay Platform Automated Monitoring &bull; Priority Dispatch
                                </div>
                            </div>
                        `
                    }).then(() => {
                        console.log(`Live chat alert email successfully sent to ${adminRecipient}`);
                    }).catch(emailErr => {
                        console.error('Failed to send live chat notification email:', emailErr);
                    });
                } catch (emailErr) {
                    console.error('Failed to trigger live chat notification email:', emailErr);
                }
            } else {
                console.warn('Live chat email alert skipped: transporter or adminRecipient missing', {
                    hasTransporter: !!transporter,
                    adminRecipient: adminRecipient
                });
            }
        }

        const result = await db.query(
            `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, $2, $3, $4) RETURNING id`,
            [session_id, sender_type, sender_name, message]
        );

        // Trigger AI Assistant response when customer sends a message
        if (sender_type === 'customer') {
            setTimeout(async () => {
                try {
                    const checkActive = await db.query('SELECT is_active FROM live_chat_sessions WHERE session_id = $1', [session_id]);
                    if (checkActive.rows.length > 0 && checkActive.rows[0].is_active) {
                        const aiReply = await getAiResponse(message, sender_name, customer_email, session_id, db);
                        await db.query(
                            `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, 'admin', 'CryptoPay AI Assistant', $2)`,
                            [session_id, aiReply]
                        );
                    }
                } catch (aiErr) {
                    console.error('Error generating AI response:', aiErr);
                }
            }, 500);
        }

        res.json({ success: true, message: 'Message sent successfully', messageId: result.rows[0].id });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error saving chat message' });
    }
});

// Request live human agent escalation
app.post('/api/chat/request-agent', async (req, res) => {
    const { session_id, customer_name, customer_email } = req.body;
    if (!session_id) {
        return res.status(400).json({ success: false, message: 'Session ID required' });
    }
    try {
        const alertMessage = '🔔 A live CryptoPay customer service specialist has been alerted and assigned to your session. An agent will join this conversation shortly.';
        await db.query(
            `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, 'admin', 'Priority Support Desk', $2)`,
            [session_id, alertMessage]
        );

        let adminRecipient = process.env.ADMIN_EMAIL || '758wess@gmail.com';
        if (transporter && adminRecipient) {
            transporter.sendMail({
                from: `"${process.env.SMTP_FROM_NAME || 'CryptoPay Live Support'}" <${process.env.SMTP_USER}>`,
                to: adminRecipient,
                subject: `🚨 [CryptoPay URGENT] Customer ${customer_name || 'Customer'} requested LIVE AGENT in chat`,
                html: `<p>A customer (<strong>${customer_name || 'Anonymous'}</strong>, ${customer_email || 'No email'}) in session <code>${session_id}</code> has requested immediate human assistance in Live Chat.</p><p><a href="${process.env.APP_URL || 'http://localhost:3000'}/admin-messages.html">Open Admin Chat Console &rarr;</a></p>`
            }).catch(e => console.error('Error sending agent request email:', e));
        }

        res.json({ success: true, message: 'Live agent requested' });
    } catch (err) {
        console.error('Error requesting live agent:', err);
        res.status(500).json({ success: false, message: 'Error processing request' });
    }
});

// Get all messages for a chat session (include active status)
app.get('/api/chat/messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        const sessionRes = await db.query(`SELECT is_active FROM live_chat_sessions WHERE session_id = $1`, [sessionId]);
        const active = sessionRes.rows.length > 0 ? sessionRes.rows[0].is_active : true;

        const messagesRes = await db.query(`SELECT * FROM live_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]);
        res.json({ success: true, active, messages: messagesRes.rows || [] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
});

// Get all active chat sessions (admin only)
app.get('/api/admin/chat/sessions', requireAuth, async (req, res) => {
    try {
        const query = `
            SELECT s.*, (
                SELECT COUNT(*) 
                FROM live_chat_messages 
                WHERE session_id = s.session_id AND sender_type = 'customer' AND read_by_admin = FALSE
            ) as unread_count
            FROM live_chat_sessions s 
            WHERE s.is_active = TRUE 
            ORDER BY s.created_at DESC
        `;
        const { rows } = await db.query(query);
        res.json({ success: true, sessions: rows });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving sessions' });
    }
});

// Get all messages in a chat session (admin only)
app.get('/api/admin/chat/sessions/:sessionId/messages', requireAuth, async (req, res) => {
    const { sessionId } = req.params;
    try {
        const messagesRes = await db.query(`SELECT * FROM live_chat_messages WHERE session_id = $1 ORDER BY created_at ASC`, [sessionId]);

        await db.query(`UPDATE live_chat_messages SET read_by_admin = TRUE WHERE session_id = $1 AND sender_type = 'customer'`, [sessionId]);

        res.json({ success: true, messages: messagesRes.rows || [] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error retrieving messages' });
    }
});

// Send a live chat reply (admin only)
app.post('/api/chat/reply', requireAuth, async (req, res) => {
    const { session_id, message } = req.body;

    if (!session_id || !message) {
        return res.status(400).json({ success: false, message: 'Session ID and message required' });
    }

    try {
        const result = await db.query(
            `INSERT INTO live_chat_messages (session_id, sender_type, sender_name, message) VALUES ($1, 'admin', 'Support Team', $2) RETURNING id`,
            [session_id, message]
        );
        res.json({ success: true, message: 'Reply sent successfully', messageId: result.rows[0].id });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error saving reply' });
    }
});

// Close a chat session (customer or admin)
// Unauthenticated route for customers to end their own conversation. Admins may still
// use the authenticated endpoint below if preferred.
app.put('/api/chat/sessions/:sessionId/close', (req, res, next) => {
    // if admin token present and valid, requireAuth middleware will run; otherwise continue
    if (req.headers && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        return requireAuth(req, res, next);
    }
    next();
}, async (req, res) => {
    const { sessionId } = req.params;
    try {
        // Per your request, closing the chat now deletes the session and all associated messages from the database.
        await db.query(`DELETE FROM live_chat_sessions WHERE session_id = $1`, [sessionId]);
        res.json({ success: true, message: 'Chat session closed and history cleared' });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ success: false, message: 'Error closing session' });
    }
});

// Check email configuration status (admin only)
app.get('/api/admin/mail-status', requireAuth, (req, res) => {
    let adminRecipient = process.env.ADMIN_EMAIL;
    if (!adminRecipient || adminRecipient.includes('winningedgeinvestment')) {
        adminRecipient = '758wess@gmail.com';
    }
    res.json({
        success: true,
        smtp_configured: !!transporter,
        smtp_host: smtpHost,
        smtp_user: smtpUser,
        admin_email: adminRecipient,
        active_recipient: adminRecipient
    });
});

// Send a test live chat alert email (admin only)
app.post('/api/admin/send-test-alert', requireAuth, async (req, res) => {
    let adminRecipient = process.env.ADMIN_EMAIL;
    if (!adminRecipient || adminRecipient.includes('winningedgeinvestment')) {
        adminRecipient = '758wess@gmail.com';
    }
    if (!transporter) {
        return res.status(400).json({
            success: false,
            message: 'SMTP is not configured on this server.'
        });
    }
    if (!adminRecipient) {
        return res.status(400).json({
            success: false,
            message: 'No recipient email configured. Please set ADMIN_EMAIL in your Vercel Environment Variables.'
        });
    }

    try {
        const info = await transporter.sendMail({
            from: `"${process.env.SMTP_FROM_NAME || 'Live Chat Alert'}" <${process.env.SMTP_USER}>`,
            to: adminRecipient,
            subject: '🔔 [TEST] Live Chat Alert Verification',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 8px; max-width: 500px;">
                    <h2 style="color: #28a745;">✅ Live Chat Alert Working!</h2>
                    <p>This test confirmation was sent from your server to <strong>${adminRecipient}</strong>.</p>
                    <p>When customers start a live chat, alerts will be delivered here instantly.</p>
                </div>
            `
        });
        res.json({ success: true, message: `Test email sent successfully to ${adminRecipient}`, messageId: info.messageId });
    } catch (e) {
        console.error('Test email failure:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// Start the server (for local development)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`View Business Accounts at http://localhost:${PORT}/business-accounts.html`);
    console.log(`Admin Login at http://localhost:${PORT}/admin-login.html`);
  });
}

// Export app for Vercel serverless
module.exports = app;