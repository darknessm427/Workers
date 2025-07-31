// --- UTILITY & CONSTANTS ---
const GENERAL_PORTS = [443, 8443, 2053, 2083, 2087, 2095];
const WARP_PORTS = [500, 854, 859, 864, 878, 880, 890, 891, 894, 903, 908, 928, 934, 939, 942, 943, 945, 946, 955, 968, 987, 988, 1002, 1010, 1014, 1018, 1070, 1074, 1180, 1387, 1701, 1843, 2371, 2408, 2506, 3138, 3476, 3581, 3854, 4177, 4198, 4233, 4500, 5279, 5956, 7103, 7152, 7156, 7281, 7559, 8319, 8742, 8854, 8886];
const WARP_IPS = ["8.6.112.0/24", "8.34.70.0/24", "8.34.146.0/24", "8.35.211.0/24", "8.39.125.0/24", "8.39.204.0/24", "8.39.214.0/24", "8.47.69.0/24", "162.159.192.0/24", "162.159.195.0/24", "188.114.96.0/24", "188.114.97.0/24", "188.114.98.0/24", "188.114.99.0/24"];

// --- CONTEXT MANAGEMENT ---
// Functions to manage user's current state/selections in KV storage.
const getContext = (env, userId) => env.BOT_STATE.get(`ctx_${userId}`, { type: "json" });
const setContext = (env, userId, ctx) => env.BOT_STATE.put(`ctx_${userId}`, JSON.stringify(ctx), { expirationTtl: 600 }); // Context expires in 10 minutes
const clearContext = (env, userId) => env.BOT_STATE.delete(`ctx_${userId}`);

// --- WORKER ENTRY POINT ---
export default {
    async fetch(request, env, ctx) {
        if (request.method !== "POST") return new Response("Not valid.", { status: 405 });
        try {
            const update = await request.json();
            ctx.waitUntil(handleUpdate(update, env));
        } catch (err) { console.error(err); }
        return new Response("OK");
    },
};

// --- MAIN UPDATE HANDLER ---
// This function routes all incoming updates from Telegram.
async function handleUpdate(update, env) {
    let chatId, text, userId, callbackQuery, messageId;

    if (update.message) {
        chatId = update.message.chat.id;
        text = update.message.text;
        userId = update.message.from.id;
        messageId = update.message.message_id;
    } else if (update.callback_query) {
        chatId = update.callback_query.message.chat.id;
        text = update.callback_query.data;
        userId = update.callback_query.from.id;
        callbackQuery = update.callback_query;
        messageId = update.callback_query.message.message_id;
    } else { return; }

    const isAdmin = String(userId) === env.ADMIN_ID;
    const botStatus = (await env.BOT_STATE.get("bot_status")) || "on";
    let ctx = await getContext(env, userId) || {};

    // Block non-admin users if the bot is turned off.
    if (botStatus === 'off' && !isAdmin) {
        if (callbackQuery) await answerCallbackQuery(env, callbackQuery.id, "⚠️ The bot is currently disabled by the admin.", true);
        else await sendMessage(env, chatId, "⚠️ The bot is currently disabled by the admin.");
        return;
    }

    // Handles text input when the bot is waiting for a custom range.
    if (update.message && text && !text.startsWith('/') && ctx.step === 'awaiting_range') {
        const customRange = text.trim();
        const cidrRegex = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/(1[6-9]|2[0-9]|3[0-2])$/;
        if (!cidrRegex.test(customRange)) {
            await sendMessage(env, chatId, "❌ *Invalid Format!*\nPlease enter a valid CIDR range (e.g., `188.114.96.0/24`).");
            return;
        }
        ctx.range = customRange;
        ctx.count = 3;
        ctx.step = 'scanning';
        await setContext(env, userId, ctx);
        
        const tempMessage = await sendMessage(env, chatId, `⏳ *Processing ${ctx.count} IPs from your custom range...*`);
        await apiRequest(env, 'deleteMessage', { chat_id: chatId, message_id: messageId });
        await processGetIp(env, userId, chatId, tempMessage.result.message_id);
        return;
    }

    // Handles all button clicks (callback queries).
    if (callbackQuery) {
        const parts = text.split('_');
        const command = parts[0];

        switch (command) {
            case 'source': // User selected an IP source (Cloudflare, WARP, etc.)
                ctx = { source: parts[1], count: 3 };
                if (parts[1] === 'CUSTOM') {
                    ctx.step = 'awaiting_range';
                    await setContext(env, userId, ctx);
                    await showCustomRangePrompt(env, chatId, messageId);
                } else {
                    ctx.step = 'scanning';
                    await setContext(env, userId, ctx);
                    await editMessage(env, chatId, messageId, `⏳ *Processing for ${ctx.count} IPs...*`);
                    await processGetIp(env, userId, chatId, messageId);
                }
                break;
            case 'addports': // User wants to add random ports to the results
                await addPortsToAllIps(env, userId, chatId, messageId, callbackQuery.id);
                break;
            case 'menu': // Navigation back to a main menu
                await clearContext(env, userId);
                if (parts[1] === 'getip') await showIpSelectionMenu(env, chatId, messageId);
                else await showMainMenu(env, chatId, messageId, isAdmin);
                break;
            case 'admin': // Admin panel navigation
                if (isAdmin) {
                    if (parts[1] === 'stats') await showAdminStats(env, chatId, messageId);
                    else await showAdminPanel(env, chatId, messageId);
                }
                break;
            case 'setstatus': // Admin sets bot status (on/off)
                if (isAdmin) await setBotStatus(env, chatId, callbackQuery.id, messageId, parts[1]);
                break;
        }
    } else { // Handles text commands like /start
        const isNewUser = await env.BOT_STATE.get(`user_${userId}`) === null;
        if (isNewUser) {
            await env.BOT_STATE.put(`user_${userId}`, '1');
            const totalUsers = parseInt(await env.BOT_STATE.get('total_users') || '0') + 1;
            await env.BOT_STATE.put('total_users', totalUsers.toString());
        }
        await clearContext(env, userId);
        await showMainMenu(env, chatId, null, isAdmin);
    }
}

// --- UI & MENU FUNCTIONS ---

// Displays the main welcome message and menu.
async function showMainMenu(env, chatId, messageId, isAdmin) {
    const text = "*ÐΛɌ₭ᑎΞ𐒡𐒡🗽𓄂𓆃*\n\n🎉 *Welcome to the Clean IP Finder Bot!*\n\nPlease choose an option below:";
    let kb = [[{ text: "🔍 Get IP", callback_data: "menu_getip" }]];
    if (isAdmin) kb.push([{ text: "⚙️ Admin Panel", callback_data: "admin_panel" }], [{ text: "📊 Bot Stats", callback_data: "admin_stats" }]);
    if (messageId) await editMessage(env, chatId, messageId, text, { inline_keyboard: kb });
    else await sendMessage(env, chatId, text, { inline_keyboard: kb });
}

// Displays the IP source selection menu.
async function showIpSelectionMenu(env, chatId, messageId) {
    const text = "Please select a provider to scan for **3 IPs**:";
    const kb = { inline_keyboard: [
            [{ text: "☁️ Cloudflare", callback_data: "source_CLOUDFLARE" }, { text: "⚡️ Fastly", callback_data: "source_FASTLY" }],
            [{ text: "🌀 WARP", callback_data: "source_WARP" }],
            [{ text: "⌨️ Custom Range Scan", callback_data: "source_CUSTOM" }],
            [{ text: "🔙 Back to Main Menu", callback_data: "menu_main" }]
        ]};
    if (messageId) await editMessage(env, chatId, messageId, text, kb);
    else await sendMessage(env, chatId, text, kb);
}

// Prompts the user to enter a custom CIDR range.
async function showCustomRangePrompt(env, chatId, messageId) {
    await editMessage(env, chatId, messageId, "⌨️ *Custom Range Scan*\n\nPlease send the range you want to scan for **3 IPs** in CIDR format.\n\n*Example:* `188.114.96.0/24`", {
        inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_getip" }]]
    });
}

// --- ADMIN FUNCTIONS ---

// Displays the admin control panel.
async function showAdminPanel(env, chatId, messageId) {
    const botStatus = (await env.BOT_STATE.get("bot_status")) || "on";
    const statusText = botStatus === 'on' ? '🟢 On' : '🔴 Off';
    const text = `⚙️ *Admin Panel*\n\nCurrent bot status for users: *${statusText}*`;
    const kb = { inline_keyboard: [
            [{ text: "🟢 Turn On for Everyone", callback_data: "setstatus_on" }],
            [{ text: "🔴 Turn Off for Everyone", callback_data: "setstatus_off" }],
            [{ text: "🔙 Back to Main Menu", callback_data: "menu_main" }]
        ]};
    await editMessage(env, chatId, messageId, text, kb);
}

// Displays bot usage statistics.
async function showAdminStats(env, chatId, messageId) {
    const totalUsers = await env.BOT_STATE.get('total_users') || '0';
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' })).toISOString().slice(0, 10);
    const scansToday = await env.BOT_STATE.get(`scans_${today}`) || '0';
    const text = `📊 *Bot Statistics*\n\n👤 *Total Users:* ${totalUsers}\n\n📈 *Total Scans Today:* ${scansToday}`;
    const kb = { inline_keyboard: [[{ text: "🔙 Back to Main Menu", callback_data: "menu_main" }]] };
    await editMessage(env, chatId, messageId, text, kb);
}

// Sets the global bot status (on/off).
async function setBotStatus(env, chatId, callbackQueryId, messageId, newStatus) {
    await env.BOT_STATE.put("bot_status", newStatus);
    const statusMessage = newStatus === 'on' ? 'On' : 'Off';
    await answerCallbackQuery(env, callbackQueryId, `✅ Bot status successfully set to ${statusMessage} for users.`);
    await showAdminPanel(env, chatId, messageId);
}

// --- CORE PROCESSING FUNCTIONS ---

// Processes the scan request and displays results.
async function processGetIp(env, userId, chatId, messageId) {
    const ctx = await getContext(env, userId);
    if (!ctx) return;
    
    const { source, count, range } = ctx;

    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' })).toISOString().slice(0, 10);
    const scansToday = parseInt(await env.BOT_STATE.get(`scans_${today}`) || '0') + count;
    await env.BOT_STATE.put(`scans_${today}`, scansToday.toString());

    const promises = Array(count).fill(null).map(() => findSingleIp(source, range));
    const settledResults = await Promise.allSettled(promises);
    
    let results = settledResults.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
    
    let messageText = "";
    let keyboard;

    if (results.length > 0) {
        const finalSource = source === 'CUSTOM' ? "Custom Range" : source;
        messageText = `*Scan Results from ${finalSource}*\n\n`;
        results.forEach((result, index) => {
            messageText += `*IP #${index + 1} (${result.source})*\n✅ \`${result.ip}\`\n🔹 *Ports:* \`${result.openPorts.join(", ")}\`\n📡 *Ping:* \`${result.latency} ms\`\n\n`;
        });
        
        ctx.results = results;
        ctx.originalResultText = messageText;
        await setContext(env, userId, ctx);

        keyboard = { inline_keyboard: [
                [{ text: "➕ Add Random Port", callback_data: `addports` }],
                [{ text: "🔄 Rescan", callback_data: `source_${source}` }, { text: "🔙 Back", callback_data: "menu_getip" }]
            ]};
    } else {
        messageText = "❌ *No healthy IPs were found!*";
        keyboard = { inline_keyboard: [
                [{ text: "🔄 Try Again", callback_data: `source_${source}` }, { text: "🔙 Back", callback_data: "menu_getip" }]
            ]};
    }
    if (messageId) {
        await editMessage(env, chatId, messageId, messageText, keyboard);
    } else {
        await sendMessage(env, chatId, messageText, keyboard);
    }
}

// Appends a random port to each found IP in the message.
async function addPortsToAllIps(env, userId, chatId, messageId, callbackQueryId) {
    const ctx = await getContext(env, userId);
    if (!ctx || !ctx.results || ctx.results.length === 0) {
        if (callbackQueryId) await answerCallbackQuery(env, callbackQueryId, "❌ Scan data has expired.", true);
        return;
    }
    
    let ipWithPortList = "";
    ctx.results.forEach(result => {
        if (result.openPorts.length > 0) {
            const randomPort = result.openPorts[Math.floor(Math.random() * result.openPorts.length)];
            ipWithPortList += `\`${result.ip}:${randomPort}\`\n`;
        }
    });
    
    let text = ctx.originalResultText + `\n🔗 *IPs with Port (for copy):*\n${ipWithPortList}`;

    const kb = { inline_keyboard: [
        [{ text: "🔄 Change Ports", callback_data: `addports` }],
        [{ text: "🔙 Back to Main Menu", callback_data: "menu_main" }]
    ]};
    await editMessage(env, chatId, messageId, text, kb);
}

// Finds a single healthy IP by scanning ranges.
async function findSingleIp(source, customRange = null) {
    let ranges = [];
    let portsToScan = [];
    
    try {
        if (source === 'CUSTOM' && customRange) {
            ranges = [customRange];
            portsToScan = GENERAL_PORTS;
        } else {
            switch (source) {
                case 'CLOUDFLARE':
                    const cfResponse = await fetch("https://www.cloudflare.com/ips-v4");
                    ranges = (await cfResponse.text()).split('\n').filter(Boolean);
                    portsToScan = GENERAL_PORTS;
                    break;
                case 'FASTLY':
                    const fastlyResponse = await fetch("https://api.fastly.com/public-ip-list");
                    const fastlyData = await fastlyResponse.json();
                    ranges = fastlyData.addresses || [];
                    portsToScan = GENERAL_PORTS;
                    break;
                case 'WARP':
                    ranges = WARP_IPS;
                    portsToScan = WARP_PORTS;
                    break;
                default: return null;
            }
        }

        if (ranges.length === 0) return null;

        const attempts = 100;
        for (let i = 0; i < attempts; i++) {
            const range = ranges[Math.floor(Math.random() * ranges.length)];
            const ip = getRandomIP(range);
            if (!ip) continue;
            
            let finalPortsToScan = portsToScan;
            if (source === 'WARP') {
                finalPortsToScan = portsToScan.sort(() => 0.5 - Math.random()).slice(0, 15);
            }
            
            const openPorts = await checkOpenPorts(ip, finalPortsToScan);
            if (openPorts.length > 0) {
                const latency = await getLatency(ip);
                return { ip, openPorts, source, latency };
            }
        }
    } catch (e) { console.error(`Error in findSingleIp for ${source}:`, e); }
    return null;
}

// --- LOW-LEVEL NETWORK & HELPER FUNCTIONS ---

// Generates a random IP from a CIDR range.
function getRandomIP(cidr) {
    try {
        let [ip, mask] = cidr.split('/');
        mask = parseInt(mask, 10);
        if (mask < 16 || mask > 32) return null;
        let start = ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet, 10), 0);
        start &= (-1 << (32 - mask));
        const range = 1 << (32 - mask);
        const randomIp = start + Math.floor(Math.random() * range);
        return [(randomIp >> 24) & 255, (randomIp >> 16) & 255, (randomIp >> 8) & 255, randomIp & 255].join('.');
    } catch (e) { return null; }
}

// Checks multiple ports on a single IP.
async function checkOpenPorts(ip, ports) {
    const concurrencyLimit = 10;
    let open_ports = [];
    for (let i = 0; i < ports.length; i += concurrencyLimit) {
        const chunk = ports.slice(i, i + concurrencyLimit);
        const promises = chunk.map(port => checkPort(ip, port));
        const results = await Promise.all(promises);
        results.forEach((isOpen, index) => {
            if (isOpen) open_ports.push(chunk[index]);
        });
    }
    return open_ports;
}

// Checks a single port on an IP.
async function checkPort(ip, port) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 800);
    try {
        await fetch(`http://${ip}:${port}`, { signal: controller.signal });
        return true;
    } catch (err) { return false; } finally { clearTimeout(timeout); }
}

// Estimates latency to an IP.
async function getLatency(ip) {
    const start = performance.now();
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        await fetch(`http://${ip}:80`, { signal: controller.signal, method: "HEAD" });
        clearTimeout(timeout);
    } catch (e) {}
    const duration = performance.now() - start;
    return duration >= 1500 ? "Unknown" : Math.round(duration);
}

// --- TELEGRAM API HELPER FUNCTIONS ---

// Generic function to make requests to the Telegram API.
async function apiRequest(env, methodName, params) {
    const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/${methodName}`;
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });
    return response.json();
}

// Sends a new message.
async function sendMessage(env, chatId, text, reply_markup = null) {
    const params = { chat_id: chatId, text: text, parse_mode: "Markdown" };
    if (reply_markup) params.reply_markup = reply_markup;
    return await apiRequest(env, "sendMessage", params);
}

// Edits an existing message.
async function editMessage(env, chatId, messageId, text, reply_markup = null) {
    const params = { chat_id: chatId, message_id: messageId, text: text, parse_mode: "Markdown" };
    if (reply_markup) params.reply_markup = reply_markup;
    return await apiRequest(env, "editMessageText", params);
}

// Answers a callback query (e.g., to show a notification).
async function answerCallbackQuery(env, callbackQueryId, text = "", show_alert = false) {
    const params = { callback_query_id: callbackQueryId, text: text, show_alert: show_alert };
    return await apiRequest(env, "answerCallbackQuery", params);
}
