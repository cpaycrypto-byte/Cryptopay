const db = require('./db');

function generateCardForAccount(accountNumber, accountType, accountId) {
    const typeStr = String(accountType || '').toLowerCase();
    const accStr = String(accountNumber || '').replace(/\D/g, '');
    const idSeed = parseInt(String(accountId || '1').replace(/\D/g, ''), 10) || 1;
    const accNum = parseInt(accStr, 10) || 12345678;

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

async function initDb() {
    try {
        console.log('Initializing database tables...');

        // Create registrations table
        await db.query(`
            CREATE TABLE IF NOT EXISTS registrations (
                id SERIAL PRIMARY KEY,
                firstname VARCHAR(255) NOT NULL,
                middlename VARCHAR(255),
                surname VARCHAR(255) NOT NULL,
                dob DATE,
                id_number VARCHAR(255),
                address TEXT,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(50),
                account_types VARCHAR(255),
                id_document_path VARCHAR(255),
                username VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                email_notifications BOOLEAN DEFAULT TRUE,
                transaction_code VARCHAR(9) DEFAULT '123456789',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created registrations table');

        // Create contact_messages table
        await db.query(`
            CREATE TABLE IF NOT EXISTS contact_messages (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                subject TEXT,
                message TEXT NOT NULL,
                read BOOLEAN DEFAULT FALSE,
                archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created contact_messages table');

        // Add archived column if it doesn't exist (for existing databases)
        try {
            await db.query(`ALTER TABLE contact_messages ADD COLUMN archived BOOLEAN DEFAULT FALSE;`);
            console.log('Added archived column to contact_messages table');
        } catch (err) {
            if (err.code !== '42701') { // 42701 = column already exists
                throw err;
            }
        }

        // Create message_replies table
        await db.query(`
            CREATE TABLE IF NOT EXISTS message_replies (
                id SERIAL PRIMARY KEY,
                message_id INTEGER REFERENCES contact_messages(id) ON DELETE CASCADE,
                reply_text TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created message_replies table');

        // Create live_chat_sessions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS live_chat_sessions (
                session_id VARCHAR(255) PRIMARY KEY,
                customer_name VARCHAR(255),
                customer_email VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP WITH TIME ZONE
            );
        `);
        console.log('Created live_chat_sessions table');

        // Create live_chat_messages table
        await db.query(`
            CREATE TABLE IF NOT EXISTS live_chat_messages (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) REFERENCES live_chat_sessions(session_id) ON DELETE CASCADE,
                sender_type VARCHAR(50) NOT NULL,
                sender_name VARCHAR(255),
                message TEXT NOT NULL,
                read_by_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created live_chat_messages table');

        // Create accounts table
        await db.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
                account_type VARCHAR(100) NOT NULL,
                account_number VARCHAR(100) UNIQUE NOT NULL,
                balance NUMERIC(15, 2) DEFAULT 0.00,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created accounts table');

        // Ensure unique card fields exist for every account
        await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_number VARCHAR(25);`);
        await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_exp VARCHAR(10);`);
        await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_cvv VARCHAR(5);`);
        await db.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS card_frozen BOOLEAN DEFAULT FALSE;`);

        // Populate any accounts missing unique card details
        const missingCards = await db.query(`SELECT id, account_number, account_type FROM accounts WHERE card_number IS NULL`);
        for (const row of missingCards.rows) {
            const card = generateCardForAccount(row.account_number, row.account_type, row.id);
            await db.query(
                `UPDATE accounts SET card_number = $1, card_exp = $2, card_cvv = $3, card_frozen = FALSE WHERE id = $4`,
                [card.card_number, card.card_exp, card.card_cvv, row.id]
            );
        }
        if (missingCards.rows.length > 0) {
            console.log(`Generated unique card credentials for ${missingCards.rows.length} accounts.`);
        }

        // ensure email_notifications column exists for registrations
        await db.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;`);
        // ensure transaction_code column exists for registrations
        await db.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(9) DEFAULT '123456789';`);
        // ensure failed_code_attempts column exists for registrations
        await db.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS failed_code_attempts INTEGER DEFAULT 0;`);
        // ensure crypto_balances column exists for registrations
        await db.query(`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS crypto_balances JSONB DEFAULT '{"btc": 0, "eth": 0, "sol": 0, "usdt": 0}'::jsonb;`);


        // Create transactions table
        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                transaction_type VARCHAR(50) NOT NULL,
                amount NUMERIC(15, 2) NOT NULL,
                description TEXT,
                balance_after NUMERIC(15, 2),
                status VARCHAR(50) DEFAULT 'completed',
                depositor VARCHAR(255),
                reference_number VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created transactions table');

        // Ensure status, depositor and reference_number exist on existing transactions table
        await db.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';`);
        await db.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS depositor VARCHAR(255);`);
        await db.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_number VARCHAR(100);`);
        await db.query(`UPDATE transactions SET status = 'completed' WHERE status IS NULL;`);

        // Create notifications table
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'alert',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created notifications table');

        // Create login_audit_logs table
        await db.query(`
            CREATE TABLE IF NOT EXISTS login_audit_logs (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) NOT NULL,
                ip_address VARCHAR(50) NOT NULL,
                user_agent TEXT,
                status VARCHAR(20) NOT NULL,
                reason VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Created login_audit_logs table');

        // Create deposit_requests table
        await db.query(`
            CREATE TABLE IF NOT EXISTS deposit_requests (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL,
                account_number VARCHAR(100) NOT NULL,
                account_type VARCHAR(100),
                amount NUMERIC(15, 2) NOT NULL,
                method VARCHAR(100) DEFAULT 'Domestic Wire / ACH',
                reference_number VARCHAR(100),
                status VARCHAR(50) DEFAULT 'pending',
                admin_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                reviewed_by VARCHAR(100)
            );
        `);
        console.log('Created deposit_requests table');

        // Ensure user_agent column exists for existing databases
        await db.query(`ALTER TABLE login_audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;`);

        // Ensure id_document_path and account_types are TEXT to support up to 5 uploaded documents and full facility descriptions
        await db.query(`ALTER TABLE registrations ALTER COLUMN id_document_path TYPE TEXT;`).catch(() => {});
        await db.query(`ALTER TABLE registrations ALTER COLUMN account_types TYPE TEXT;`).catch(() => {});
        await db.query(`ALTER TABLE accounts ALTER COLUMN account_type TYPE VARCHAR(255);`).catch(() => {});

        console.log('Database initialization complete.');
        if (require.main === module) {
            process.exit(0);
        }
    } catch (err) {
        console.error('Error initializing database:', err);
        if (require.main === module) {
            process.exit(1);
        }
        throw err;
    }
}

if (require.main === module) {
    initDb();
}

module.exports = initDb;