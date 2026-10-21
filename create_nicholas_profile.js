const db = require('./db');
const bcrypt = require('bcryptjs');

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

async function createNicholasProfile() {
    try {
        console.log('--- Initializing User Profile Creation ---');
        const firstname = 'Nicholas';
        const middlename = 'Yahaya';
        const surname = 'Ugbane';
        const username = 'Nugbane';
        const rawPassword = 'YahayaNic123@$';
        const email = 'nugbane@cryptopay.network';
        const phone = '+1 (202) 555-0194';
        const depositAmount = 13850000.00;
        const depositor = 'JONES MICHAEL';
        const depositDate = new Date('2026-10-21T08:00:00Z');
        const accountType = 'Fiat & Crypto Wallet';
        const cardAccountType = 'Crypto Debit Card';

        // 1. Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(rawPassword, salt);

        // 2. Check / Insert User in registrations
        let registrationId;
        const existingUser = await db.query(
            'SELECT id FROM registrations WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUser.rows.length > 0) {
            registrationId = existingUser.rows[0].id;
            console.log(`User exists with ID: ${registrationId}. Updating profile...`);
            await db.query(`
                UPDATE registrations
                SET firstname = $1, middlename = $2, surname = $3,
                    password = $4, status = 'approved',
                    account_types = 'Fiat & Crypto Wallet, Crypto Debit Card',
                    email = $5, phone = $6, failed_code_attempts = 0,
                    transaction_code = '123456789'
                WHERE id = $7
            `, [firstname, middlename, surname, hashedPassword, email, phone, registrationId]);
        } else {
            console.log('Inserting new registration record...');
            const insertRes = await db.query(`
                INSERT INTO registrations (
                    firstname, middlename, surname, email, username,
                    password, phone, account_types, status,
                    transaction_code, email_notifications, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved', '123456789', true, $9)
                RETURNING id
            `, [
                firstname, middlename, surname, email, username,
                hashedPassword, phone, 'Fiat & Crypto Wallet, Crypto Debit Card',
                depositDate
            ]);
            registrationId = insertRes.rows[0].id;
        }

        // 3. Setup Primary Account (Fiat & Crypto Wallet)
        let primaryAccountId;
        let primaryAccNumber;

        const existingAcc = await db.query(
            'SELECT id, account_number FROM accounts WHERE registration_id = $1 AND account_type = $2',
            [registrationId, accountType]
        );

        if (existingAcc.rows.length > 0) {
            primaryAccountId = existingAcc.rows[0].id;
            primaryAccNumber = existingAcc.rows[0].account_number;
            console.log(`Updating primary account ${primaryAccNumber}...`);
            await db.query(
                'UPDATE accounts SET balance = $1 WHERE id = $2',
                [depositAmount, primaryAccountId]
            );
        } else {
            const randomPart = Math.floor(10000 + Math.random() * 90000).toString();
            primaryAccNumber = '923' + randomPart;
            console.log(`Creating primary account ${primaryAccNumber}...`);
            const accRes = await db.query(`
                INSERT INTO accounts (
                    registration_id, account_type, account_number, balance, created_at
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [registrationId, accountType, primaryAccNumber, depositAmount, depositDate]);
            primaryAccountId = accRes.rows[0].id;
        }

        // Generate Visa card details for primary account
        const cardDetails = generateCardForAccount(primaryAccNumber, accountType, primaryAccountId);
        await db.query(`
            UPDATE accounts 
            SET card_number = $1, card_exp = $2, card_cvv = $3, card_frozen = false
            WHERE id = $4
        `, [cardDetails.card_number, cardDetails.card_exp, cardDetails.card_cvv, primaryAccountId]);

        // 4. Setup Secondary Debit Card Account
        const existingCardAcc = await db.query(
            'SELECT id, account_number FROM accounts WHERE registration_id = $1 AND account_type = $2',
            [registrationId, cardAccountType]
        );

        if (existingCardAcc.rows.length === 0) {
            const randomCardPart = Math.floor(10000 + Math.random() * 90000).toString();
            const cardAccNum = '923' + randomCardPart;
            const cardAccRes = await db.query(`
                INSERT INTO accounts (
                    registration_id, account_type, account_number, balance, created_at
                ) VALUES ($1, $2, $3, 0.00, $4)
                RETURNING id
            `, [registrationId, cardAccountType, cardAccNum, depositDate]);
            const cardAccId = cardAccRes.rows[0].id;
            const debitCard = generateCardForAccount(cardAccNum, cardAccountType, cardAccId);
            await db.query(`
                UPDATE accounts 
                SET card_number = $1, card_exp = $2, card_cvv = $3, card_frozen = false
                WHERE id = $4
            `, [debitCard.card_number, debitCard.card_exp, debitCard.card_cvv, cardAccId]);
        }

        // 5. Clean up old transactions for this primary account to ensure accurate ledger
        await db.query('DELETE FROM transactions WHERE account_id = $1', [primaryAccountId]);

        // 6. Insert Pending Deposit Transaction
        const refNumber = 'DEP-20261021-JM' + Math.floor(1000 + Math.random() * 9000);
        console.log(`Inserting pending deposit transaction (${refNumber})...`);

        await db.query(`
            INSERT INTO transactions (
                account_id, transaction_type, amount, description,
                balance_after, created_at, status, depositor, reference_number
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            primaryAccountId,
            'Credit',
            depositAmount,
            `Institutional Direct Deposit - Remitter: ${depositor}`,
            depositAmount,
            depositDate,
            'pending',
            depositor,
            refNumber
        ]);

        // 7. Insert / Update in deposit_requests table
        await db.query('DELETE FROM deposit_requests WHERE username = $1', [username]);
        await db.query(`
            INSERT INTO deposit_requests (
                username, account_number, account_type, amount,
                method, reference_number, status, admin_notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            username,
            primaryAccNumber,
            accountType,
            depositAmount,
            'Wire Transfer (Fedwire / SWIFT)',
            refNumber,
            'pending',
            `Direct Deposit by ${depositor} on October 21, 2026`,
            depositDate
        ]);

        // 8. Add In-App Notification
        await db.query('DELETE FROM notifications WHERE username = $1', [username]);
        await db.query(`
            INSERT INTO notifications (
                username, message, type, is_read, created_at
            ) VALUES ($1, $2, 'alert', false, $3)
        `, [
            username,
            `Pending Deposit: A credit of $13,850,000.00 USD from ${depositor} on October 21, 2026 has been received and is currently in pending settlement verification.`,
            depositDate
        ]);

        console.log('\n======================================================');
        console.log('✅ USER PROFILE SUCCESSFULLY CREATED / CONFIGURED');
        console.log('======================================================');
        console.log(`Full Name:        ${firstname} ${middlename} ${surname}`);
        console.log(`Username:         ${username}`);
        console.log(`Password:         ${rawPassword}`);
        console.log(`Account Number:   ${primaryAccNumber}`);
        console.log(`USD Balance:      $13,850,000.00 USD`);
        console.log(`Depositor:        ${depositor}`);
        console.log(`Deposit Date:     October 21, 2026`);
        console.log(`Deposit Status:   Pending Settlement`);
        console.log(`Reference:        ${refNumber}`);
        console.log('======================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating user profile:', err);
        process.exit(1);
    }
}

createNicholasProfile();
