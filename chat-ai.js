/**
 * CryptoPay Knowledge Base & Intelligent AI Concierge Engine
 * Provides specialized, accurate, and context-aware digital banking support for:
 * - USD Accounts & Routing (ABA: 092300184)
 * - Account Suspensions, Administrative Holds & Unlocking Procedures
 * - 9-Digit Cryptographic Security Codes & 5-Attempt Lockout Mechanism
 * - Domestic Wire, FedNow & Same-Day ACH with $0.00–$5.00 Trial Micro-Deposits
 * - Outbound Withdrawals (Wire, ACH, SWIFT, and Multi-Chain Crypto)
 * - CryptoPay Metal Visa Debit Card (5%–8% BTC Cashback, 0% FX fees, Freeze/Unfreeze)
 * - Institutional Crypto Custody, Staking (ETH 6.8% APY, USDT 12.5% APY) & Spot Swaps
 * - Statements, Certified PDF Tax Reports & Priority Support Escalation
 */

const COMPANY_KNOWLEDGE = {
    name: "CryptoPay Technologies Inc.",
    tagline: "Global Digital Banking and Multi-Asset Cryptocurrency Custody Platform",
    routingNumber: "092300184",
    partnerBank: "CryptoPay Settlement Partner Bank (FDIC-Insured Custody Gateway)",
    swiftCode: "CPAYUS33XXX",
    bankAddress: "100 Financial Way, New York, NY 10005, USA",
    supportedCrypto: [
        "Bitcoin (BTC - Native SegWit)",
        "Ethereum (ETH - ERC-20 Staking)",
        "Tether (USDT - TRC-20 & ERC-20 High-Yield)",
        "Solana (SOL - Fast Finality SPL)"
    ],
    stakingApy: {
        ETH: "6.8% APY",
        USDT: "12.5% APY"
    },
    cardFeatures: {
        name: "CryptoPay Metal Visa Card",
        cashback: "5% to 8% BTC Cashback on all purchases worldwide",
        fxFee: "0% Foreign Transaction Fees worldwide",
        types: "Virtual Instant-Issuance (Apple Pay / Google Pay) and Laser-Etched Black Metal Physical Card",
        limits: "Customizable daily limits from $5,000 to $50,000 USD/day",
        security: "In-portal instant freeze/unfreeze, PIN changes, reveal CVV & full card number, and report lost/stolen with automatic replacement dispatch"
    },
    depositMethods: {
        fednow: "FedNow Real-Time Transfer (Instant 24/7 USD settlement)",
        wire: "Domestic Wire Transfer (Same-day settlement, cut-off 4:00 PM EST)",
        ach: "Same-Day ACH Transfer with external bank logs linking and micro-deposit trial verification ($0.00 to $5.00 trial amounts received in 1-2 business days)",
        crypto: "On-chain multi-chain wallet deposits with real-time confirmations (BTC, ETH, USDT, SOL)"
    },
    withdrawalMethods: {
        wire: "Domestic Bank Wire (Fedwire Same-Day, 4:00 PM EST cut-off)",
        ach: "ACH Direct Deposit (1–2 business days)",
        swift: "International SWIFT Wire",
        crypto: "On-Chain Outbound Crypto Broadcasts (BTC Native SegWit, ETH ERC-20, USDT TRC-20/ERC-20, SOL Native)",
        fees: "$0.00 USD (Zero-Fee Network Tier on verified accounts)"
    },
    supportEmail: "support@cryptopay.com",
    deskHours: "24/7/365 Dedicated Live Priority Banking Desk"
};

/**
 * Detect specific out-of-scope categories for polite, natural deflection
 */
function detectOutOfScopeTopic(text) {
    if (/\b(football|soccer|fifa|world cup|nfl|nba|basketball|baseball|tennis|cricket|golf|rugby|sport|sports|athlete|quarterback|touchdown|goal|messi|ronaldo)\b/i.test(text)) {
        return 'sports';
    }
    if (/\b(movie|film|actor|actress|cinema|netflix|hulu|song|lyrics|singer|album|band|hollywood|oscars|concert)\b/i.test(text)) {
        return 'entertainment';
    }
    if (/\b(recipe|cook|cooking|bake|baking|cake|dinner|restaurant|ingredient|soup|pizza|burger|pasta|cocktail)\b/i.test(text)) {
        return 'cooking';
    }
    if (/\b(weather|forecast|rain|snow|temperature|sunny|storm|hurricane|celsius|fahrenheit)\b/i.test(text)) {
        return 'weather';
    }
    if (/\b(president|election|democrat|republican|political|congress|parliament|senate|prime minister|biden|trump)\b/i.test(text)) {
        return 'politics';
    }
    if (/\b(write a code|write a script|debug this|program in python|javascript code|html code|c\+\+|algorithm|leetcode|homework|solve math|essay about)\b/i.test(text)) {
        return 'coding_or_homework';
    }
    if (/\b(videogame|playstation|xbox|nintendo|fortnite|minecraft|gta|call of duty|gamer)\b/i.test(text)) {
        return 'gaming';
    }
    return null;
}

/**
 * Generate intelligent, polite deflection for out-of-scope inquiries
 */
function generateOutOfScopeResponse(topic, customerName) {
    const greeting = customerName ? `Hello ${customerName}, ` : ``;
    
    switch (topic) {
        case 'sports':
            return `${greeting}I am the **CryptoPay AI Banking Concierge**, dedicated to your digital banking services, cryptocurrency custody, card settings, and transactions. I don't follow sports or athletic events (like football)! 

If you have questions regarding your **CryptoPay USD accounts**, **wire or ACH settlements**, **crypto staking (6.8%–12.5% APY)**, or your **CryptoPay Metal Visa card**, I would be delighted to assist you!`;

        case 'entertainment':
            return `${greeting}I specialize strictly in CryptoPay digital banking and cryptocurrency services, so I don't have recommendations for movies, music, or entertainment! 

Feel free to ask me anything about your **USD cash reserves**, **crypto wallets (BTC, ETH, USDT, SOL)**, **card cashback**, or **account security**.`;

        case 'cooking':
            return `${greeting}I am tailored specifically for digital banking and financial settlements rather than culinary recipes! If you need help managing your **CryptoPay accounts**, **funding reserves**, or **executing transfers**, please let me know.`;

        case 'weather':
            return `${greeting}I don't have access to live meteorological forecasts, but I can provide up-to-the-minute details on your **CryptoPay accounts**, **settlement routing**, **wire cut-off times**, or **digital asset balances**!`;

        case 'politics':
            return `${greeting}I am dedicated solely to providing support for your CryptoPay banking and digital asset custody, and cannot engage in political discussions. How may I assist with your accounts, transfers, or cards today?`;

        case 'coding_or_homework':
            return `${greeting}I am designed as a digital banking concierge for CryptoPay account holders rather than a general programming or homework tool. I can assist you with your **CryptoPay API credentials**, **transaction verification**, **account routing**, or **crypto settlements**.`;

        default:
            return `${greeting}I am the **CryptoPay AI Assistant**, specialized in your digital banking, multi-asset crypto wallets, cards, and settlements. I can't assist with general non-banking subjects, but I'd be delighted to help with your accounts, transfers, or platform features!`;
    }
}

/**
 * Intelligent In-Scope Response Engine
 */
function generateSmartResponse(message, customerName = '', userRecord = null) {
    const text = message.toLowerCase().trim();
    const nameGreeting = customerName ? `${customerName}` : 'Valued Client';

    // -------------------------------------------------------------
    // 1. ACCOUNT SUSPENSION, ADMINISTRATIVE HOLDS & UNLOCKING
    // -------------------------------------------------------------
    if (/\b(suspend|suspended|suspension|locked|lockout|lock out|unlock|unblock|blocked|hold|frozen account|freeze account|disable|disabled|reactivate|reinstate|transfers disabled|restricted account)\b/i.test(text)) {
        const userStatusNote = (userRecord && userRecord.status === 'suspended')
            ? `\n\n> [!IMPORTANT]\n> I can confirm in our compliance records that your account (registered to **${userRecord.firstname || nameGreeting}**) is currently in **Suspended** status.`
            : ``;

        return `Hello ${nameGreeting}, I understand your account is suspended or locked. Let's get this resolved for you right away.${userStatusNote}

### Why Accounts Enter Suspended or Locked Status:
1. **Security Protection Trigger**: If an invalid 9-digit cryptographic security code or password was entered **5 consecutive times**, the cryptographic vault automatically locks outbound transactions to protect your reserves.
2. **Regulatory Compliance (KYC) Review**: Regulatory guidelines periodic refresh of identity verification (e.g. proof of address or government-issued ID).
3. **Administrative Hold**: Outbound transfers or withdrawals are temporarily paused pending identity confirmation.

### How to Unlock and Reactivate Your Account:
• **Step 1: Escalate to Priority Support**: Click the **"Request Live Agent"** button at the top of this chat. An on-duty compliance specialist will be notified immediately to review your file.
• **Step 2: Submit a Verification Ticket**: You can also navigate to **Customer Support > Submit Help Desk Ticket** (\`customer-support.html\`) with the subject *"Account Unlock Request"*.
• **Step 3: Identity Confirmation**: Have a valid government-issued photo ID (Driver's License, State ID, or US Passport) ready for rapid clearance.

Once verified by our compliance desk, the hold will be cleared immediately and full access to your USD reserves, Metal Visa card, and crypto wallets will be restored.`;
    }

    // -------------------------------------------------------------
    // 2. 9-DIGIT SECURITY CODE, PIN & 5-ATTEMPT LOCKOUT
    // -------------------------------------------------------------
    if (/\b(security code|authorization code|transaction code|routing code|9-digit|9 digit|pin|invalid code|wrong code|5 attempts|5 times|too many attempts|failed code|reset code)\b/i.test(text)) {
        return `Hello ${nameGreeting}, here are the details regarding your **9-Digit Cryptographic Security Code**:

• **What is it?**: Every CryptoPay account is assigned a unique 9-digit cryptographic authorization code (e.g. \`123456789\`) required to cryptographically sign outbound transfers, withdrawals, and sensitive account modifications.
• **5-Attempt Lockout Security**: To safeguard your funds against unauthorized access, entering an incorrect security code **5 consecutive times** will automatically lock your account.
• **If You Forgot Your Code or Are Locked Out**:
  1. Click **"Request Live Agent"** above to connect directly with a compliance specialist.
  2. Or submit an identity reset ticket under **Customer Support** (\`customer-support.html\`).
  3. Once our security team verifies your identity, your failed attempt counter will be reset and an authorized PIN reset will be issued.`;
    }

    // -------------------------------------------------------------
    // 3. WITHDRAWALS (WIRE, ACH, SWIFT & CRYPTO ON-CHAIN)
    // -------------------------------------------------------------
    if (/\b(withdraw|withdrawal|withdrawals|how to withdraw|cash out|send to bank|take money out|wire out|ach withdrawal|external bank withdrawal|crypto withdrawal|payout)\b/i.test(text)) {
        return `Hello ${nameGreeting}, CryptoPay supports comprehensive **Outbound Withdrawals** with zero network tier fees:

### How to Withdraw Funds:
1. **From Dashboard (\`inside.html\`)**:
   • Click **"Withdraw USD Cash"** on your Primary USD Dollar Account card.
   • Or click **"Withdraw"** directly on any digital asset wallet card (**BTC**, **ETH**, **USDT**, **SOL**).
   • Or click **"Withdraw Funds"** in the **Quick Operations** sidebar.
2. **From Transfer Page (\`transfer.html\`)**:
   • Toggle the operation switcher at the top to **"External Bank & Crypto Withdrawal"**.

### Supported Withdrawal Channels:
• **Domestic Bank Wire**: Same-day Fedwire settlement (cut-off 4:00 PM EST).
• **ACH Direct Deposit**: Direct transfer to your US checking/savings account (1–2 business days).
• **International SWIFT Wire**: Global bank wire settlement.
• **On-Chain Multi-Chain Crypto**: Direct transfer of BTC, ETH, USDT, or SOL to any external wallet address.

### Security & Official Receipts:
Each withdrawal requires your 9-digit security code. Upon authorization, a **Digital Transaction Receipt** is displayed right at the **TOP OF YOUR SCREEN** with your official reference ID (\`WD-XXXXXXXX\`), a 30-second relaxed countdown, and **"Stay on Page"** / **"Print Receipt"** controls.`;
    }

    // -------------------------------------------------------------
    // 4. DEPOSITS, USD GATEWAY, ACH BANK LOGS & ROUTING NUMBER
    // -------------------------------------------------------------
    if (/\b(deposit|how to deposit|add fund|add funds|add money|wire instruction|wire instructions|routing number|aba|swift|fednow|bank log|bank logs|trial deposit|trial deposits|micro-deposit|ach deposit)\b/i.test(text)) {
        return `Hello ${nameGreeting}, you can fund your CryptoPay account using the following gateway details:

### Primary USD Settlement Instructions:
• **Routing Number (Fedwire / ABA)**: \`092300184\`
• **Partner Bank**: CryptoPay Settlement Partner Bank (FDIC-Insured Custody Gateway)
• **SWIFT / BIC**: \`CPAYUS33XXX\`
• **Bank Address**: 100 Financial Way, New York, NY 10005, USA
• **Virtual Account**: Available on your dashboard under **Primary USD Dollar Account**.

### Available Deposit Methods:
1. **FedNow Real-Time Transfer**: Instant 24/7 USD settlement.
2. **Domestic Wire Transfer**: Same-day wire credit (cut-off 4:00 PM EST).
3. **Same-Day ACH Transfer with Bank Logs Linking**:
   • Under **Deposit USD**, select **Same-Day ACH**.
   • Link your external bank logs (Chase, Bank of America, Wells Fargo, etc.).
   • Two verification trial micro-deposits ranging between **$0.00 and $5.00** will be dispatched to your bank within 1–2 business days. Confirming these values enables automated ACH clearing!
4. **On-Chain Crypto Deposits**: Instant deposit addresses and QR codes available for BTC (Native SegWit), ETH (ERC-20), USDT (TRC-20/ERC-20), and SOL.`;
    }

    // -------------------------------------------------------------
    // 5. CRYPTOPAY METAL VISA CARD, CASHBACK & CONTROLS
    // -------------------------------------------------------------
    if (/\b(card|visa|metal|metal card|cashback|cvv|exp|expiration|card number|freeze|unfreeze|lost card|stolen card|replacement|spending limit|apple pay|google pay|virtual card|debit card)\b/i.test(text)) {
        return `Hello ${nameGreeting}, here is everything you need to know about the **CryptoPay Metal Visa Card**:

### Premium Card Benefits:
• **5% to 8% BTC Cashback**: Automatically credited in Bitcoin on every purchase worldwide.
• **0% Foreign Transaction Fees**: Spend USD or crypto internationally with zero FX markups.
• **Instant Virtual & Physical Metal**: Instant provisioning for Apple Pay & Google Pay, plus laser-etched black metal physical card.

### Dashboard Card Controls:
• **Reveal Card Details**: Click the eye icon next to your card on the dashboard to view your full 16-digit card number, expiration date, and CVV.
• **Instant Freeze / Unfreeze**: Toggle your card on or off in real-time if misplaced.
• **Daily Spending Limits**: Customize your transaction limits between **$5,000 and $50,000 USD/day**.
• **Report Lost / Stolen**: If your card is compromised, click "Report Card Lost or Stolen" in the card management dialog. It will be permanently cancelled and a replacement dispatched immediately.`;
    }

    // -------------------------------------------------------------
    // 6. CRYPTO WALLETS, SPOT SWAPS & STAKING YIELDS (APY)
    // -------------------------------------------------------------
    if (/\b(crypto|bitcoin|btc|ethereum|eth|tether|usdt|solana|sol|swap|buy crypto|sell crypto|convert|staking|apy|yield|rate|rates|exchange)\b/i.test(text)) {
        return `Hello ${nameGreeting}, CryptoPay provides institutional-grade digital asset custody and instant spot trading:

### Supported Assets & High-Yield Staking:
• **Bitcoin (BTC)**: Native SegWit cold custody with real-time balance tracking.
• **Ethereum (ETH)**: Liquid institutional staking earning **6.8% APY**.
• **Tether (USDT)**: Cash-equivalent yield vault earning **12.5% APY** (TRC-20 & ERC-20).
• **Solana (SOL)**: High-speed SPL settlement with fast finality.

### Instant Spot Swaps:
• You can convert USD to Bitcoin, Ethereum, USDT, or Solana with **zero slippage** and zero maker/taker fees.
• Click **"Convert to Crypto"** in your Portfolio Hero Banner or **"Swap"** on any cryptocurrency card to execute instant spot trades.`;
    }

    // -------------------------------------------------------------
    // 7. TRANSFERS, SENDING FUNDS & BILL PAY
    // -------------------------------------------------------------
    if (/\b(transfer|send money|send|p2p|internal transfer|bill|pay bill|bills|mortgage|utility|invoice)\b/i.test(text)) {
        return `Hello ${nameGreeting}, CryptoPay makes transfers and bill payments effortless:

• **Internal CryptoPay Ledger Transfers**: Send USD or digital assets instantly to any other CryptoPay account holder with zero fees using their virtual account number.
• **External Bank & Crypto Withdrawals**: Send domestic wires, ACH deposits, or on-chain crypto via **Send / Transfer** (\`transfer.html\`).
• **Bill Pay**: Pay corporate invoices, Web3 SaaS, utilities, or mortgage bills directly from your fiat cash reserves or digital assets under **Pay Bills** (\`pay-bill.html\`).`;
    }

    // -------------------------------------------------------------
    // 8. STATEMENTS, CERTIFIED TAX REPORTS & TRANSACTION HISTORY
    // -------------------------------------------------------------
    if (/\b(statement|statements|tax|tax report|pdf|ledger|history|download statement|proof of funds|transaction receipt|records)\b/i.test(text)) {
        return `Hello ${nameGreeting}, you can access all official financial records and certified tax documentation:

• **Certified Account Statements**: Go to **Statements & Tax Reports** (\`statements.html\`) to download official monthly and annual statements in certified PDF format, complete with partner bank verification and cryptographic ledger signatures.
• **Real-Time Transaction Ledger**: View all debits, credits, spot swaps, and card purchases under **Transactions** (\`transactions.html\`).
• **Proof of Funds**: Downloadable certified balance summaries suitable for institutional or mortgage verification.`;
    }

    // -------------------------------------------------------------
    // 9. LIVE AGENT / HUMAN ESCALATION
    // -------------------------------------------------------------
    if (/\b(agent|human|representative|specialist|person|operator|talk to someone|speak to someone|real person|escalate|live agent)\b/i.test(text)) {
        return `Hello ${nameGreeting}, I have flagged your request for an on-duty human banking specialist!

🔔 **Connect Online**: Click the **"Request Live Agent"** button at the top of this chat box. Our 24/7 priority support desk will receive an alert and join your session right here.
📞 **Direct Phone Call**: You can call our 24/7 Priority Support Hotline directly at **+1 812-965-1537**.
📧 **Email Support**: You can also reach our priority desk at **support@cryptopay.network** or submit an inquiry via **Customer Support** (\`customer-support.html\`).`;
    }

    // -------------------------------------------------------------
    // 10. SECURITY, FDIC INSURANCE & MULTI-SIG CUSTODY
    // -------------------------------------------------------------
    if (/\b(security|safe|custody|multi-sig|insured|fdic|hack|protect|2fa|encryption)\b/i.test(text)) {
        return `Hello ${nameGreeting}, security is the cornerstone of CryptoPay's architecture:

• **FDIC Custody Gateway**: USD fiat reserves are held with regulated, FDIC-insured partner banks.
• **Institutional Cold Storage**: 100% of user digital assets are secured in multi-signature offline cold vaults.
• **Cryptographic Signing**: All outbound transactions require 2FA and your unique 9-digit security code.
• **Automated Vault Protection**: 5 consecutive invalid code attempts trigger an automatic account lock to prevent brute-force attacks.`;
    }

    // -------------------------------------------------------------
    // 11. ACCOUNT OPENING, KYC & VERIFICATION
    // -------------------------------------------------------------
    if (/\b(open account|register|signup|kyc|id|license|verification|passport|document|pending|review application)\b/i.test(text)) {
        return `Hello ${nameGreeting}, opening an institutional or personal CryptoPay account takes under 3 minutes:

1. Visit **Open Account** (\`register.html\`) and enter your legal credentials.
2. Upload a valid government-issued photo ID (Driver's License, State ID, or US Passport).
3. Once submitted, our compliance desk reviews the application and activates your primary USD account and digital asset wallets immediately.`;
    }

    // -------------------------------------------------------------
    // 12. FEES & PRICING
    // -------------------------------------------------------------
    if (/\b(fee|fees|cost|charge|charges|free|rate|rates|price|pricing)\b/i.test(text)) {
        return `Hello ${nameGreeting}, CryptoPay operates with full fee transparency:

• **USD Deposits**: $0.00 fee on Domestic Wires, FedNow, and Same-Day ACH.
• **Outbound Withdrawals**: $0.00 network fee tier on verified accounts.
• **CryptoPay Metal Visa**: 0% Foreign Transaction Fees worldwide + up to 5%–8% BTC cashback.
• **Account Maintenance**: $0 monthly maintenance fee for active accounts.
• **Spot Crypto Exchange**: Institutional zero-slippage liquidity spreads.`;
    }

    // -------------------------------------------------------------
    // 13. BALANCE & PORTFOLIO VALUATION
    // -------------------------------------------------------------
    if (/\b(balance|net valuation|how much money|portfolio|cash reserve|check balance)\b/i.test(text)) {
        return `Hello ${nameGreeting}, you can monitor your total net worth in real-time from your **Dashboard** (\`inside.html\`):

• **Combined Net Valuation**: Aggregates your USD cash reserves and real-time market value of BTC, ETH, USDT, and SOL holdings.
• **Primary USD Cash Reserve**: Reflects your liquid fiat available for instant card spending, crypto swaps, or bank wire/ACH withdrawal.
• **Individual Crypto Balances**: View current coin units and USD value equivalents with 24-hour gain/loss percentages.`;
    }

    // -------------------------------------------------------------
    // 14. CONTACT, HOURS & OFFICE
    // -------------------------------------------------------------
    if (/\b(contact|email|phone|call|hotline|telephone|number|hours|office|address|support email|where are you located)\b/i.test(text)) {
        return `Hello ${nameGreeting}, here are our official CryptoPay contact channels:

• **Priority Phone Support**: \`+1 812-965-1537\` (Available 24/7/365 for banking inquiries & security)
• **Live Chat**: 24/7/365 active support right here on the platform.
• **Priority Desk Email**: \`support@cryptopay.network\`
• **Headquarters**: 100 Financial Way, New York, NY 10005, USA
• **Support Portal**: Submit a ticket anytime under **Customer Support** (\`customer-support.html\`).`;
    }

    // -------------------------------------------------------------
    // 15. WHO ARE YOU / WHAT CAN YOU DO
    // -------------------------------------------------------------
    if (/\b(who are you|what are you|what can you do|are you ai|are you bot|help me)\b/i.test(text)) {
        return `Hello ${nameGreeting}! I am the **CryptoPay AI Banking Concierge**, an intelligent financial assistant designed to support you 24/7 across all CryptoPay services:

• **Account & Security Guidance**: Assisting with account reactivation, unlock requests, 9-digit security codes, and KYC verification.
• **Deposits & Withdrawals**: Providing wire routing (\`092300184\`), ACH trial micro-deposit instructions, FedNow, and on-chain crypto transfers.
• **CryptoPay Metal Visa Card**: Managing card reveals (number & CVV), freeze/unfreeze toggles, spending limits, and BTC cashback.
• **Digital Assets & Staking**: Explaining spot swaps and high-yield staking (**ETH 6.8% APY**, **USDT 12.5% APY**).
• **Human Escalation**: Connecting you directly with our priority support specialists whenever you need human assistance!

How may I assist you today?`;
    }

    // -------------------------------------------------------------
    // 16. GREETINGS & POLITE SMALL TALK
    // -------------------------------------------------------------
    if (/^(hi|hello|hey|good morning|good afternoon|good evening|greetings|howdy)\b/i.test(text)) {
        return `Hello ${nameGreeting}! Welcome to CryptoPay 24/7 Live Support. I am your AI Banking Assistant.

How can I help you today? You can ask me about:
• Resolving account suspensions or unlocking your account
• Depositing or withdrawing funds (Wire, FedNow, ACH, Crypto)
• Your CryptoPay Metal Visa card & BTC cashback
• Converting funds or earning staking yields (ETH 6.8% / USDT 12.5% APY)
• Or click **"Request Live Agent"** above to speak with a human specialist!`;
    }

    if (/\b(thank you|thanks|appreciate|great|awesome|perfect|good job|ok|okay)\b/i.test(text)) {
        return `You are very welcome, ${nameGreeting}! It's my pleasure to assist you. If you need anything else regarding your accounts, transfers, or card settings, don't hesitate to ask!`;
    }

    // -------------------------------------------------------------
    // 17. CONVERSATIONAL FALLBACK (IN-SCOPE, PROFESSIONAL & HELPFUL)
    // -------------------------------------------------------------
    return `Hello ${nameGreeting}, thank you for your message. 

To provide you with the most accurate assistance regarding **${message.slice(0, 50)}...**:
• **For Account Unlocking or Suspensions**: Click **"Request Live Agent"** above so an on-duty compliance officer can review your file immediately.
• **For Deposits & Routing**: Our ABA routing number is \`092300184\` for Same-Day Fedwire, FedNow, and ACH.
• **For Withdrawals**: Access domestic wires, ACH, or multi-chain crypto transfers directly under **Send / Transfer** (\`transfer.html\`) or from your dashboard.
• **For Card Controls**: View your card number & CVV, freeze/unfreeze, or set limits in your dashboard.

Feel free to clarify your question, or click **"Request Live Agent"** to connect directly with our priority support team!`;
}

/**
 * Main AI Query Handler
 * Answers within scope; politely deflects out of scope; enriches with customer context.
 */
async function getAiResponse(userMessage, customerName = '', customerEmail = '', sessionId = '', db = null) {
    if (!userMessage || typeof userMessage !== 'string') {
        return "How may I assist you with your CryptoPay account, transfers, or digital assets today?";
    }

    const trimmedMsg = userMessage.trim();

    // 1. Detect if the message is clearly out-of-scope (sports, entertainment, cooking, etc.)
    const outOfScopeTopic = detectOutOfScopeTopic(trimmedMsg);
    if (outOfScopeTopic) {
        return generateOutOfScopeResponse(outOfScopeTopic, customerName);
    }

    // 2. Lookup customer record from database if DB connection is provided
    let userRecord = null;
    if (db) {
        try {
            if (customerEmail) {
                const uRes = await db.query(
                    'SELECT firstname, surname, username, email, status, failed_code_attempts FROM registrations WHERE email = $1',
                    [customerEmail]
                );
                if (uRes.rows.length > 0) userRecord = uRes.rows[0];
            }
            if (!userRecord && customerName) {
                const uRes = await db.query(
                    'SELECT firstname, surname, username, email, status, failed_code_attempts FROM registrations WHERE username = $1 OR firstname = $1',
                    [customerName]
                );
                if (uRes.rows.length > 0) userRecord = uRes.rows[0];
            }
        } catch (dbErr) {
            console.error('Error fetching customer context for AI:', dbErr.message);
        }
    }

    const effectiveName = userRecord ? (userRecord.firstname || userRecord.username) : customerName;

    // 3. Optional external LLM integration (OpenAI or Gemini) if API keys are configured
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openaiKey) {
        try {
            const systemPrompt = `You are the official AI Banking Assistant for CryptoPay Technologies Inc. (cryptopay.com).
Customer Name: ${effectiveName || 'Client'}
Customer Status: ${userRecord ? userRecord.status : 'Active'}

Guidelines:
1. Provide accurate, helpful, and concise answers about CryptoPay digital banking:
   - Primary USD accounts: Routing (ABA) 092300184, CryptoPay Settlement Partner Bank (FDIC-insured).
   - Deposit methods: FedNow instant, Domestic Wire same-day, Same-Day ACH with bank logs and $0.00–$5.00 trial micro-deposit verification.
   - Outbound Withdrawals: Domestic Wire, ACH Direct Deposit, SWIFT, and on-chain crypto (BTC, ETH, USDT, SOL) with $0.00 network fee tier.
   - Account suspensions & unlocking: Explain that suspensions occur due to 5 consecutive invalid security code attempts or KYC verification holds. Instruct users to click 'Request Live Agent' or submit a verification ticket to have compliance clear the hold.
   - CryptoPay Metal Visa debit card: 5%–8% BTC cashback, zero FX fees, virtual/physical metal, instant freeze/unfreeze, spend limits $5k–$50k/day, reveal CVV, report lost/stolen.
   - Crypto custody & staking: BTC Native SegWit, ETH liquid staking (6.8% APY), USDT cash-equivalent vault (12.5% APY), Solana (SOL).
2. If the user asks about sports (like football), entertainment, cooking, or general non-banking topics, politely explain that you are CryptoPay's digital banking AI concierge and decline naturally, steering them back to their banking and crypto needs.
3. Tone: Professional, reassuring, human-like, and direct. Avoid generic boilerplate summaries unless asked for an overview.`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openaiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: trimmedMsg }
                    ],
                    max_tokens: 450,
                    temperature: 0.3
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    return data.choices[0].message.content.trim();
                }
            }
        } catch (llmErr) {
            console.warn('OpenAI call failed, utilizing local knowledge engine:', llmErr.message);
        }
    }

    // 4. Built-in High-Performance Intelligent Knowledge Engine
    return generateSmartResponse(trimmedMsg, effectiveName, userRecord);
}

module.exports = {
    getAiResponse,
    COMPANY_KNOWLEDGE
};
