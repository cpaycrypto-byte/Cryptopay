(function() {
    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .chat-widget-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 8px 24px rgba(37, 99, 235, 0.45);
            z-index: 9999;
            transition: all 0.3s ease;
            border: 2px solid rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 24px;
            text-decoration: none;
        }
        .chat-widget-btn:hover {
            transform: translateY(-3px) scale(1.06);
            background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
            box-shadow: 0 12px 28px rgba(37, 99, 235, 0.6);
            color: white;
        }
        .chat-widget-box {
            display: none;
            position: fixed;
            bottom: 95px;
            right: 24px;
            width: 360px;
            height: 520px;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 12px 35px rgba(15, 23, 42, 0.25);
            z-index: 9999;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid #e2e8f0;
        }
        @media (max-width: 576px) {
            .chat-widget-btn {
                bottom: 16px;
                right: 16px;
                width: 54px;
                height: 54px;
                font-size: 20px;
            }
            .chat-widget-box {
                left: 12px !important;
                right: 12px !important;
                width: auto !important;
                bottom: 80px !important;
                height: 70vh !important;
                max-height: 520px !important;
            }
        }
        .chat-header {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #ffffff;
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .chat-header .btn-close {
            filter: invert(1) grayscale(100%) brightness(200%);
        }
        .chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            background-color: #f8fafc;
            display: flex;
            flex-direction: column;
        }
        .chat-input-area {
            padding: 14px;
            border-top: 1px solid #e2e8f0;
            display: flex;
            gap: 10px;
            background: #ffffff;
        }
        .chat-message {
            margin-bottom: 12px;
            max-width: 80%;
            padding: 10px 14px;
            border-radius: 14px;
            font-size: 14px;
            word-wrap: break-word;
            line-height: 1.45;
        }
        .chat-message.customer {
            align-self: flex-end;
            background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
            color: white;
            border-bottom-right-radius: 3px;
            box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
        }
        .chat-message.admin {
            align-self: flex-start;
            background-color: #e2e8f0;
            color: #0f172a;
            border-bottom-left-radius: 3px;
        }
        .chat-timestamp {
            font-size: 10px;
            margin-top: 4px;
            opacity: 0.75;
            text-align: right;
        }
        .chat-widget-box .btn-crypto {
            background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
            border: none;
            color: #ffffff;
            font-weight: 600;
        }
        .chat-widget-box .btn-crypto:hover {
            background: linear-gradient(135deg, #1d4ed8 0%, #4338ca 100%);
            color: #ffffff;
        }
        .chat-confirmation {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 15px;
            margin: 10px auto;
            text-align: center;
            width: 90%;
        }
        .chat-confirmation p {
            margin-bottom: 10px;
            font-size: 14px;
        }
        .chat-confirmation button {
            margin: 0 5px;
        }
    `;
    document.head.appendChild(style);

    // Inject HTML
    const widgetHTML = `
        <button id="chatWidgetBtn" data-id="chatBubble" class="chat-widget-btn" title="Live Crypto Banking Support">
            <i class="bi bi-chat-dots-fill"></i>
        </button>

        <div id="chatWidgetBox" class="chat-widget-box">
            <div class="chat-header">
                <div class="d-flex align-items-center gap-2">
                    <span style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
                    <h5 class="m-0 fs-6 fw-bold text-white"><i class="bi bi-shield-check me-1 text-info"></i>CryptoPay Support</h5>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button id="endChatHeaderBtn" class="btn btn-sm btn-outline-light rounded-pill px-2.5 py-0" style="font-size: 11px; display: none;" title="End Chat Session">
                        <i class="bi bi-x-circle me-1"></i>End Chat
                    </button>
                    <button id="closeChatBtn" class="btn-close" aria-label="Close"></button>
                </div>
            </div>
            
            <div id="chatMessages" class="chat-messages">
                <div class="text-center text-muted mt-4">
                    <p class="fw-semibold text-dark mb-1">Welcome to CryptoPay Priority Desk</p>
                    <p class="small text-secondary">Our cryptocurrency banking specialists are online 24/7.</p>
                </div>
            </div>

            <div id="chatRegistration" class="p-4" style="display: none;">
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-secondary">Full Name</label>
                    <input type="text" id="chatName" class="form-control form-control-sm" placeholder="Enter your full name">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-secondary">Email Address</label>
                    <input type="email" id="chatEmail" class="form-control form-control-sm" placeholder="name@example.com">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-semibold text-secondary">Initial Inquiry</label>
                    <textarea id="chatStartMsg" class="form-control form-control-sm" rows="3" placeholder="How can our crypto banking team help you?"></textarea>
                </div>
                <button id="startChatBtn" class="btn btn-crypto btn-sm w-100 py-2">Start Live Chat</button>
            </div>

            <!-- Floating New Message Notification Pill -->
            <div id="chatScrollBottomPill" style="display: none; position: absolute; bottom: 85px; left: 50%; transform: translateX(-50%); background: #2563eb; color: #ffffff; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; box-shadow: 0 4px 14px rgba(37,99,235,0.45); cursor: pointer; z-index: 100; transition: all 0.2s ease;" onmouseenter="this.style.background='#1d4ed8'; this.style.transform='translateX(-50%) translateY(-2px)'" onmouseleave="this.style.background='#2563eb'; this.style.transform='translateX(-50%) translateY(0)'">
                <i class="bi bi-arrow-down-short me-1"></i>New message below
            </div>

            <!-- Chat Action Bar: Request Live Agent & End Chat (Always visible during chat) -->
            <div id="chatActionBar" class="d-flex align-items-center justify-content-between px-3 py-1.5 border-top" style="display: none; background: #f8fafc; font-size: 11px;">
                <button type="button" id="requestLiveAgentBtn" class="btn btn-outline-primary btn-sm rounded-pill py-0.5 px-2.5 fw-semibold" style="font-size: 11px;">
                    <i class="bi bi-headset me-1"></i>Request Live Agent
                </button>
                <button type="button" id="endChatActionBtn" class="btn btn-outline-secondary btn-sm rounded-pill py-0.5 px-2.5 fw-semibold" style="font-size: 11px;">
                    <i class="bi bi-check2-circle me-1"></i>End Chat
                </button>
            </div>

            <div id="chatInputArea" class="chat-input-area" style="display: none;">
                <textarea id="chatInput" class="form-control form-control-sm" rows="1" placeholder="Type your message..."></textarea>
                <button id="sendMessageBtn" class="btn btn-crypto btn-sm px-3"><i class="bi bi-send-fill"></i></button>
            </div>

            <!-- Dedicated End Chat Confirmation Modal (Outside messagesDiv so polling never wipes it) -->
            <div id="chatEndModal" class="chat-end-modal" style="display: none; position: absolute; inset: 0; background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(4px); z-index: 10000; align-items: center; justify-content: center; padding: 20px;">
                <div class="card border-0 shadow-lg p-4 text-center" style="border-radius: 16px; width: 100%; max-width: 290px; background: #ffffff;">
                    <div class="mb-3">
                        <span class="d-inline-flex align-items-center justify-content-center rounded-circle" style="width: 48px; height: 48px; background: rgba(37, 99, 235, 0.1); color: #2563eb; font-size: 1.4rem;">
                            <i class="bi bi-chat-square-text-fill"></i>
                        </span>
                    </div>
                    <h6 class="fw-bold text-dark mb-1" style="font-size: 15px;">End Chat Session?</h6>
                    <p class="small text-secondary mb-3" style="font-size: 13px; line-height: 1.4;">Are you sure you want to end this live banking conversation?</p>
                    <div class="d-flex gap-2 justify-content-center">
                        <button id="cancelEndChatBtn" type="button" class="btn btn-light border btn-sm px-3 py-1.5 rounded-pill fw-semibold text-secondary" style="font-size: 12px;">Cancel</button>
                        <button id="confirmEndChatBtn" type="button" class="btn btn-primary btn-sm px-3 py-1.5 rounded-pill fw-bold" style="background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%); border: none; font-size: 12px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35);">Yes, End</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = widgetHTML;
    document.body.appendChild(div);

    // Logic
    const btn = document.getElementById('chatWidgetBtn');
    const box = document.getElementById('chatWidgetBox');
    const closeBtn = document.getElementById('closeChatBtn');
    const messagesDiv = document.getElementById('chatMessages');
    const regDiv = document.getElementById('chatRegistration');
    const inputArea = document.getElementById('chatInputArea');
    const actionBar = document.getElementById('chatActionBar');
    const startBtn = document.getElementById('startChatBtn');
    const sendBtn = document.getElementById('sendMessageBtn');
    const input = document.getElementById('chatInput');
    const requestAgentBtn = document.getElementById('requestLiveAgentBtn');
    const endChatActionBtn = document.getElementById('endChatActionBtn');
    const scrollPill = document.getElementById('chatScrollBottomPill');

    let sessionId = localStorage.getItem('chatSessionId');
    let customerName = localStorage.getItem('chatCustomerName');
    let customerEmail = localStorage.getItem('chatCustomerEmail');
    let pollingInterval;
    let isStartingSession = false; // Guard to prevent endChat flash on new session start

    // Smart scroll & pointer preservation tracking
    let renderedMessageIds = new Set();
    let lastRenderedSessionId = null;
    let isUserHoveringChat = false;
    let isUserScrolledUp = false;

    // Track scroll position in message area
    messagesDiv.addEventListener('scroll', () => {
        const threshold = 60;
        isUserScrolledUp = (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) > threshold;
        if (!isUserScrolledUp && scrollPill) {
            scrollPill.style.display = 'none';
        }
    });

    // Track mouse hover/pointer so polling never interrupts reading or text selection
    messagesDiv.addEventListener('mouseenter', () => { isUserHoveringChat = true; });
    messagesDiv.addEventListener('mouseleave', () => { isUserHoveringChat = false; });

    if (scrollPill) {
        scrollPill.addEventListener('click', () => {
            messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });
            scrollPill.style.display = 'none';
            isUserScrolledUp = false;
        });
    }

    function toggleChat() {
        if (box.style.display === 'none' || box.style.display === '') {
            box.style.display = 'flex';
            if (sessionId) {
                showChatInterface();
                loadMessages();
                startPolling();
            } else {
                showRegistration();
            }
        } else {
            box.style.display = 'none';
            stopPolling();
        }
    }

    // Expose globally so external buttons can open chat instantly with tactile feedback
    window.openLiveChat = function() {
        if (!box) return;
        if (box.style.display !== 'flex') {
            box.style.display = 'flex';
            if (sessionId) {
                showChatInterface();
                loadMessages();
                startPolling();
            } else {
                showRegistration();
            }
        }
        
        // Trigger pulse highlight animation
        box.classList.remove('chat-pulse-highlight');
        void box.offsetWidth; // Force reflow
        box.classList.add('chat-pulse-highlight');
        
        // Focus the visible input field
        setTimeout(() => {
            const visibleInput = (regDiv && regDiv.style.display !== 'none')
                ? document.getElementById('chatName')
                : document.getElementById('chatInput');
            if (visibleInput) {
                visibleInput.focus();
            }
        }, 150);

        // Tactile button feedback if triggered from launcher
        const launcher = document.getElementById('launchChatBtn');
        if (launcher) {
            const prevText = launcher.innerHTML;
            launcher.classList.remove('btn-primary');
            launcher.classList.add('btn-success');
            launcher.innerHTML = '<i class="bi bi-chat-check-fill me-2"></i> Live Chat Active!';
            setTimeout(() => {
                launcher.classList.remove('btn-success');
                launcher.classList.add('btn-primary');
                launcher.innerHTML = prevText;
            }, 2500);
        }
    };
    function getLoggedInUser() {
        try {
            const str = localStorage.getItem('cryptopay_user') || localStorage.getItem('santander_user');
            if (str) return JSON.parse(str);
        } catch (e) {}
        return null;
    }

    function autofillChatUserDetails() {
        const nameInput = document.getElementById('chatName');
        const emailInput = document.getElementById('chatEmail');
        const user = getLoggedInUser();
        if (user) {
            const fullName = (user.firstname ? (user.firstname + ' ' + (user.surname || '')).trim() : (user.name || user.username || '')).trim();
            if (nameInput && (!nameInput.value || nameInput.value.trim() === '')) {
                nameInput.value = fullName;
            }
            if (emailInput && (!emailInput.value || emailInput.value.trim() === '')) {
                emailInput.value = user.email || '';
            }
        } else {
            if (nameInput && !nameInput.value && customerName) nameInput.value = customerName;
            if (emailInput && !emailInput.value && customerEmail) emailInput.value = customerEmail;
        }
    }

    function showRegistration() {
        autofillChatUserDetails();
        messagesDiv.style.display = 'none';
        inputArea.style.display = 'none';
        if (actionBar) actionBar.style.display = 'none';
        regDiv.style.display = 'block';
        const endBtnHeader = document.getElementById('endChatHeaderBtn');
        if (endBtnHeader) endBtnHeader.style.display = 'none';
        hideCloseConfirmation();
    }

    function showChatInterface() {
        regDiv.style.display = 'none';
        messagesDiv.style.display = 'flex';
        inputArea.style.display = 'flex';
        if (actionBar) actionBar.style.display = 'flex';
        const endBtnHeader = document.getElementById('endChatHeaderBtn');
        if (endBtnHeader) endBtnHeader.style.display = 'inline-block';
    }

    function appendMessage(sender_type, text, time = new Date(), shouldScroll = false, msgId = null) {
        const div = document.createElement('div');
        div.className = `chat-message ${sender_type}`;
        if (msgId) {
            div.dataset.msgId = String(msgId);
        }
        div.innerHTML = `
            <div>${escapeHtml(text).replace(/\n/g, '<br>')}</div>
            <div class="chat-timestamp">${new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        `;
        messagesDiv.appendChild(div);
        if (shouldScroll) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            isUserScrolledUp = false;
        }
        return div;
    }

    function startChat() {
        const nameInput = document.getElementById('chatName');
        const emailInput = document.getElementById('chatEmail');
        const msgInput = document.getElementById('chatStartMsg');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';
        const msg = msgInput ? msgInput.value.trim() : '';

        if (!name || !email || !msg) return alert('Please fill all fields');

        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        customerName = name;
        customerEmail = email;

        localStorage.setItem('chatSessionId', sessionId);
        localStorage.setItem('chatCustomerName', name);
        localStorage.setItem('chatCustomerEmail', email);

        // Guard: prevent premature session end while session is initializing
        isStartingSession = true;
        renderedMessageIds.clear();
        lastRenderedSessionId = sessionId;
        showChatInterface();

        // Immediately display the user's initial inquiry in the conversation box!
        messagesDiv.innerHTML = `
            <div class="text-center text-muted my-2">
                <span class="badge bg-light text-secondary border px-3 py-1"><i class="bi bi-shield-check text-success me-1"></i> Live Chat Session Active</span>
            </div>
        `;
        const initialBubble = appendMessage('customer', msg, new Date(), true);
        initialBubble.setAttribute('data-pending', 'true');
        initialBubble.setAttribute('data-sender', 'customer');
        initialBubble.setAttribute('data-raw-text', msg);

        if (msgInput) msgInput.value = '';

        sendMessageToApi(msg, true).then(() => {
            isStartingSession = false;
            loadMessages(true);
            startPolling();
        });
    }

    async function sendMessageToApi(message, isFirst = false) {
        try {
            const payload = {
                session_id: sessionId,
                sender_type: 'customer',
                sender_name: customerName,
                message: message,
                customer_email: customerEmail
            };

            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (data.success) {
                if (!isFirst && input) {
                    input.value = '';
                }
                loadMessages(true);
            }
        } catch (e) {
            console.error('Error sending message:', e);
        }
    }

    async function loadMessages(forceScroll = false) {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/chat/messages/${sessionId}`);
            const data = await res.json();
            
            if (data.success) {
                if (data.active === false && !isStartingSession) {
                    endChat();
                    return;
                }
                if (data.messages && data.messages.length > 0) {
                    renderMessages(data.messages, forceScroll);
                }
            }
        } catch (e) {
            console.error('Error loading messages:', e);
        }
    }

    function renderMessages(msgs, forceScroll = false) {
        if (!msgs || msgs.length === 0) return;

        // If switching sessions or first render of this session, perform initial build
        if (lastRenderedSessionId !== sessionId) {
            messagesDiv.innerHTML = `
                <div class="text-center text-muted my-2">
                    <span class="badge bg-light text-secondary border px-3 py-1"><i class="bi bi-shield-check text-success me-1"></i> Live Chat Session Active</span>
                </div>
            `;
            renderedMessageIds.clear();
            msgs.forEach(msg => {
                const idKey = String(msg.id || (msg.sender_type + '_' + msg.created_at));
                renderedMessageIds.add(idKey);
                appendMessage(msg.sender_type, msg.message, msg.created_at, false, idKey);
            });
            lastRenderedSessionId = sessionId;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            isUserScrolledUp = false;
            if (scrollPill) scrollPill.style.display = 'none';
            return;
        }

        // Incremental check: filter unseen messages
        const unseenMsgs = msgs.filter(msg => {
            const idKey = String(msg.id || (msg.sender_type + '_' + msg.created_at));
            return !renderedMessageIds.has(idKey);
        });

        // IF NO NEW MESSAGES: Return immediately!
        // Never touch DOM or scroll when no new messages exist.
        // User pointer and selection remain 100% stable.
        if (unseenMsgs.length === 0) {
            return;
        }

        // Check if user is currently reading past messages or selecting text
        const threshold = 60;
        const isNearBottom = (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) <= threshold;
        const hasSelection = window.getSelection && window.getSelection().toString().trim().length > 0;
        const isReadingPast = !isNearBottom || hasSelection;

        unseenMsgs.forEach(msg => {
            const idKey = String(msg.id || (msg.sender_type + '_' + msg.created_at));
            renderedMessageIds.add(idKey);

            // Reconcile pending optimistic bubble if present
            const pendingBubble = messagesDiv.querySelector(`.chat-message[data-pending="true"][data-sender="${msg.sender_type}"]`);
            if (pendingBubble && pendingBubble.getAttribute('data-raw-text') === msg.message) {
                pendingBubble.removeAttribute('data-pending');
                pendingBubble.dataset.msgId = idKey;
                return;
            }

            appendMessage(msg.sender_type, msg.message, msg.created_at, false, idKey);
        });

        if (forceScroll) {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            isUserScrolledUp = false;
            if (scrollPill) scrollPill.style.display = 'none';
        } else if (isReadingPast) {
            // User is reading earlier in the history or selecting text: do NOT move their scroll or pointer!
            if (scrollPill) {
                const count = unseenMsgs.length;
                scrollPill.innerHTML = `<i class="bi bi-arrow-down-short me-1"></i>${count > 1 ? count + ' new messages below' : 'New message below'}`;
                scrollPill.style.display = 'block';
            }
        } else {
            // User was already at the bottom and not reading past messages: smoothly scroll down
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            if (scrollPill) scrollPill.style.display = 'none';
        }
    }

    function startPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(loadMessages, 3000);
    }

    function stopPolling() {
        if (pollingInterval) clearInterval(pollingInterval);
    }

    // Ask for confirmation before closing the chat
    function requestCloseChat() {
        if (sessionId) {
            showCloseConfirmation();
        } else {
            // If there's no active session, just hide the widget
            box.style.display = 'none';
            stopPolling();
        }
    }

    function showCloseConfirmation() {
        const modal = document.getElementById('chatEndModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    function hideCloseConfirmation() {
        const modal = document.getElementById('chatEndModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Call server to delete the session
    async function closeSessionOnServer() {
        if (!sessionId) return;
        try {
            const res = await fetch(`/api/chat/sessions/${sessionId}/close`, {
                method: 'PUT'
            });
            const data = await res.json();
            if (data.success) {
                // Reset client-side state
                localStorage.removeItem('chatSessionId');
                localStorage.removeItem('chatCustomerName');
                localStorage.removeItem('chatCustomerEmail');
                sessionId = null;
                customerName = null;
                customerEmail = null;
                renderedMessageIds.clear();
                lastRenderedSessionId = null;
                if (scrollPill) scrollPill.style.display = 'none';
                stopPolling();
                hideCloseConfirmation();
                box.style.display = 'none';
                showRegistration(); // Reset to the initial view
            } else {
                alert('Failed to close chat session. Please try again.');
            }
        } catch (e) {
            console.error('Error closing chat session:', e);
        }
    }

    function endChat() {
        localStorage.removeItem('chatSessionId');
        localStorage.removeItem('chatCustomerName');
        localStorage.removeItem('chatCustomerEmail');
        sessionId = null;
        customerName = null;
        customerEmail = null;
        renderedMessageIds.clear();
        lastRenderedSessionId = null;
        if (scrollPill) scrollPill.style.display = 'none';
        stopPolling();
        hideCloseConfirmation();
        if (actionBar) actionBar.style.display = 'none';
        messagesDiv.innerHTML = '<div class="text-center text-muted mt-5">Chat ended.</div>';
        inputArea.style.display = 'none';
        setTimeout(() => {
            showRegistration();
        }, 2000);
    }

    async function requestLiveAgent() {
        if (!sessionId) return;
        if (requestAgentBtn) {
            requestAgentBtn.disabled = true;
            requestAgentBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Connecting...';
        }
        try {
            await fetch('/api/chat/request-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    customer_name: customerName,
                    customer_email: customerEmail
                })
            });
            setTimeout(() => {
                if (requestAgentBtn) {
                    requestAgentBtn.disabled = false;
                    requestAgentBtn.innerHTML = '<i class="bi bi-headset me-1"></i>Agent Alerted';
                }
                loadMessages(true);
            }, 600);
        } catch (e) {
            console.error('Error requesting live agent:', e);
            if (requestAgentBtn) {
                requestAgentBtn.disabled = false;
                requestAgentBtn.innerHTML = '<i class="bi bi-headset me-1"></i>Request Live Agent';
            }
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    btn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', requestCloseChat);
    const endChatHeaderBtn = document.getElementById('endChatHeaderBtn');
    const cancelEndChatBtn = document.getElementById('cancelEndChatBtn');
    const confirmEndChatBtn = document.getElementById('confirmEndChatBtn');

    if (endChatHeaderBtn) endChatHeaderBtn.addEventListener('click', requestCloseChat);
    if (cancelEndChatBtn) cancelEndChatBtn.addEventListener('click', hideCloseConfirmation);
    if (requestAgentBtn) requestAgentBtn.addEventListener('click', requestLiveAgent);
    if (endChatActionBtn) endChatActionBtn.addEventListener('click', requestCloseChat);
    if (confirmEndChatBtn) {
        confirmEndChatBtn.addEventListener('click', async () => {
            confirmEndChatBtn.disabled = true;
            confirmEndChatBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Ending...';
            await closeSessionOnServer();
            confirmEndChatBtn.disabled = false;
            confirmEndChatBtn.innerHTML = 'Yes, End';
        });
    }
    startBtn.addEventListener('click', startChat);
    sendBtn.addEventListener('click', () => {
        const msg = input.value.trim();
        if (msg) {
            const bubble = appendMessage('customer', msg, new Date(), true);
            bubble.setAttribute('data-pending', 'true');
            bubble.setAttribute('data-sender', 'customer');
            bubble.setAttribute('data-raw-text', msg);
            input.value = '';
            sendMessageToApi(msg);
        }
    });
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const msg = input.value.trim();
            if (msg) {
                const bubble = appendMessage('customer', msg, new Date(), true);
                bubble.setAttribute('data-pending', 'true');
                bubble.setAttribute('data-sender', 'customer');
                bubble.setAttribute('data-raw-text', msg);
                input.value = '';
                sendMessageToApi(msg);
            }
        }
    });

    // Populate user credentials on initialization if already logged in
    autofillChatUserDetails();
})();