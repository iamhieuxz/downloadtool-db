const terminalIg = document.getElementById("terminal-ig");
const terminalX = document.getElementById("terminal-x");
const AUTH_TOKEN = window.AUTH_TOKEN || "";

// Helper: fetch tự động gắn X-Auth-Token header
function authFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (AUTH_TOKEN) {
        options.headers["X-Auth-Token"] = AUTH_TOKEN;
    }
    return fetch(url, options).then(res => {
        if (res.status === 401) {
            addLog("🔒 Phiên làm việc đã hết hạn. Tải lại trang (F5).", "LOG_WARN", "ig");
            addLog("🔒 Phiên làm việc đã hết hạn. Tải lại trang (F5).", "LOG_WARN", "x");
            throw new Error("Unauthorized");
        }
        if (res.status === 429) {
            addLog("⏳ Quá nhiều yêu cầu, thử lại sau giây lát.", "LOG_WARN", "ig");
            addLog("⏳ Quá nhiều yêu cầu, thử lại sau giây lát.", "LOG_WARN", "x");
            throw new Error("Rate limited");
        }
        return res;
    });
}

// Kết nối WebSocket kèm token trong query string
const ws = new WebSocket(`ws://${window.location.host}/ws/log?token=${encodeURIComponent(AUTH_TOKEN)}`);

const colorMap = {
    'LOG_SYSTEM': 'text-sky-400',
    'LOG_WARN': 'text-amber-400',
    'FILE_OLD': 'text-zinc-500',
    'FILE_NEW': 'text-emerald-400',
    'LOG_NORMAL': 'text-zinc-100'
};

let activeTermTab = 'ig';
let currentPlatform = 'ig';

ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    addLog(data.message, data.tag, data.platform || 'ig');
};

ws.onerror = function() {
    addLog("⚠️ Mất kết nối tới Server. Hãy tải lại trang (F5).", "LOG_WARN", "ig");
    addLog("⚠️ Mất kết nối tới Server. Hãy tải lại trang (F5).", "LOG_WARN", "x");
};

const VALID_TAGS = new Set(['LOG_SYSTEM', 'LOG_WARN', 'FILE_OLD', 'FILE_NEW', 'LOG_NORMAL']);

function addLog(message, tag = "LOG_NORMAL", platform = "ig") {
    const targetTerm = platform === 'x' ? terminalX : terminalIg;
    if (!targetTerm) return;

    // Sanitize: chỉ chấp nhận tag hợp lệ, message luôn qua textContent
    const safeTag = VALID_TAGS.has(tag) ? tag : 'LOG_NORMAL';

    const span = document.createElement("span");
    span.className = `block ${colorMap[safeTag] || colorMap['LOG_NORMAL']} mb-1`;
    span.textContent = String(message ?? "");
    targetTerm.appendChild(span);
    
    if (activeTermTab === platform) {
        targetTerm.scrollTop = targetTerm.scrollHeight;
    } else {
        const badge = document.getElementById(`badge-${platform}`);
        if (badge) badge.classList.remove('hidden');
    }
}

function switchTermTab(platform) {
    activeTermTab = platform;
    const btnIg = document.getElementById('termTabBtn-ig');
    const btnX = document.getElementById('termTabBtn-x');

    if (platform === 'ig') {
        btnIg.className = "px-3 py-1 rounded text-xs font-bold transition flex items-center space-x-1.5 bg-pink-600 text-white shadow";
        btnX.className = "px-3 py-1 rounded text-xs font-bold transition flex items-center space-x-1.5 bg-zinc-900 text-zinc-400 hover:text-white";
        terminalIg.classList.remove('hidden');
        terminalX.classList.add('hidden');
        terminalIg.scrollTop = terminalIg.scrollHeight;
        document.getElementById('badge-ig').classList.add('hidden');
    } else {
        btnX.className = "px-3 py-1 rounded text-xs font-bold transition flex items-center space-x-1.5 bg-blue-600 text-white shadow";
        btnIg.className = "px-3 py-1 rounded text-xs font-bold transition flex items-center space-x-1.5 bg-zinc-900 text-zinc-400 hover:text-white";
        terminalX.classList.remove('hidden');
        terminalIg.classList.add('hidden');
        terminalX.scrollTop = terminalX.scrollHeight;
        document.getElementById('badge-x').classList.add('hidden');
    }
}

function switchTab(platform) {
    currentPlatform = platform;
    const btnIg = document.getElementById('tabBtn-ig');
    const btnX = document.getElementById('tabBtn-x');
    const contentIg = document.getElementById('tabContent-ig');
    const contentX = document.getElementById('tabContent-x');
    const headerTitle = document.getElementById('headerTitle');

    if (platform === 'ig') {
        btnIg.className = "flex-1 py-2 rounded-md font-bold text-sm transition-all bg-pink-600 text-white shadow";
        btnX.className = "flex-1 py-2 rounded-md font-bold text-sm transition-all bg-transparent text-zinc-400 hover:text-white";
        contentIg.classList.remove('hidden');
        contentX.classList.add('hidden');
        headerTitle.textContent = "IG Downloader";
        headerTitle.className = "text-pink-500";
    } else {
        btnX.className = "flex-1 py-2 rounded-md font-bold text-sm transition-all bg-blue-600 text-white shadow";
        btnIg.className = "flex-1 py-2 rounded-md font-bold text-sm transition-all bg-transparent text-zinc-400 hover:text-white";
        contentX.classList.remove('hidden');
        contentIg.classList.add('hidden');
        headerTitle.textContent = "X Downloader";
        headerTitle.className = "text-blue-500";
    }
    switchTermTab(platform);
}

// [MỚI]: Tự động nạp Cookie ngay khi người dùng chọn file
async function handleCookieSelect(platform, cookieNum, inputElement) {
    if (!inputElement.files || inputElement.files.length === 0) return;
    const file = inputElement.files[0];
    const formData = new FormData();
    if (platform === 'ig') {
        if (cookieNum === 1) formData.append("cookie1", file);
        else formData.append("cookie2", file);
    } else {
        formData.append("cookieX", file);
    }

    const labelId = platform === 'ig' ? (cookieNum === 1 ? 'labelCookie1' : 'labelCookie2') : 'labelCookieX';
    const labelEl = document.getElementById(labelId);
    if (labelEl) {
        labelEl.textContent = `⏳ Đang nạp ${file.name}...`;
        labelEl.className = "text-sm text-amber-400 w-2/3 truncate font-bold";
    }

    try {
        const res = await authFetch('/api/config/upload-cookies', { method: 'POST', body: formData });
        if (res.ok) {
            await checkConfigStatus();
            addLog(`✅ Đã nạp thành công Cookie ${platform.toUpperCase()}: ${file.name}`, "FILE_NEW", platform);
        }
    } catch(e) {
        if (labelEl) labelEl.textContent = `❌ Lỗi nạp ${file.name}`;
    }
}

async function checkConfigStatus() {
    try {
        const res = await authFetch('/api/config/status');
        const status = await res.json();
        
        if (status.has_main_cookie) {
            document.getElementById("labelCookie1").textContent = "✅ Đang dùng Cookie lưu trong hệ thống.";
            document.getElementById("labelCookie1").className = "text-sm text-emerald-400 w-2/3 truncate font-bold";
        }
        if (status.has_sub_cookie) {
            document.getElementById("labelCookie2").textContent = "✅ Đang dùng Cookie phụ lưu trong hệ thống.";
            document.getElementById("labelCookie2").className = "text-sm text-sky-400 w-2/3 truncate font-bold";
        }
        if (status.has_x_cookie) {
            document.getElementById("labelCookieX").textContent = "✅ Đang dùng Cookie X trong hệ thống.";
            document.getElementById("labelCookieX").className = "text-sm text-blue-400 w-2/3 truncate font-bold";
        }
    } catch(e) { console.error("Chưa kết nối được Server."); }
}

function toggleMode(platform) {
    const mode = document.querySelector(`input[name="mode${platform === 'ig' ? 'Ig' : 'X'}"]:checked`).value;
    document.getElementById(`singleInputBox-${platform}`).classList.toggle('hidden', mode !== 'single');
    document.getElementById(`listInputBox-${platform}`).classList.toggle('hidden', mode !== 'list');
    document.getElementById(`dbInputBox-${platform}`).classList.toggle('hidden', mode !== 'db');
    saveInputState(platform);
}

function loadListFromFile(event, targetTextareaId, platform) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const textarea = document.getElementById(targetTextareaId);
        const currentVal = textarea.value.trim();
        const newVal = e.target.result.trim();
        textarea.value = currentVal ? currentVal + '\n' + newVal : newVal;
        saveInputState(platform);
    };
    reader.readAsText(file);
    event.target.value = ""; 
}

// [MỚI]: Lưu trạng thái input vào LocalStorage chống mất dữ liệu khi F5
function saveInputState(platform) {
    const modeEl = document.querySelector(`input[name="mode${platform === 'ig' ? 'Ig' : 'X'}"]:checked`);
    if (!modeEl) return;
    const mode = modeEl.value;
    localStorage.setItem(`mode_${platform}`, mode);
    
    if (platform === 'ig') {
        localStorage.setItem("single_ig", document.getElementById("singleTarget-ig").value);
        localStorage.setItem("list_ig", document.getElementById("listTargets-ig").value);
        localStorage.setItem("chk_post", document.getElementById("chkPost").checked);
        localStorage.setItem("chk_story", document.getElementById("chkStory").checked);
        localStorage.setItem("chk_hl", document.getElementById("chkHighlight").checked);
        localStorage.setItem("chk_range", document.getElementById("chkDisableRange").checked);
    } else {
        localStorage.setItem("single_x", document.getElementById("singleTarget-x").value);
        localStorage.setItem("list_x", document.getElementById("listTargets-x").value);
        localStorage.setItem("live_x", document.getElementById("liveTarget-x").value);
    }
}

function restoreInputState() {
    ['ig', 'x'].forEach(platform => {
        const savedMode = localStorage.getItem(`mode_${platform}`);
        if (savedMode) {
            const radio = document.querySelector(`input[name="mode${platform === 'ig' ? 'Ig' : 'X'}"][value="${savedMode}"]`);
            if (radio) { radio.checked = true; toggleMode(platform); }
        }
    });

    if (localStorage.getItem("single_ig")) document.getElementById("singleTarget-ig").value = localStorage.getItem("single_ig");
    if (localStorage.getItem("list_ig")) document.getElementById("listTargets-ig").value = localStorage.getItem("list_ig");
    if (localStorage.getItem("single_x")) document.getElementById("singleTarget-x").value = localStorage.getItem("single_x");
    if (localStorage.getItem("list_x")) document.getElementById("listTargets-x").value = localStorage.getItem("list_x");
    if (localStorage.getItem("live_x")) document.getElementById("liveTarget-x").value = localStorage.getItem("live_x");

    if (localStorage.getItem("chk_post") !== null) document.getElementById("chkPost").checked = localStorage.getItem("chk_post") === "true";
    if (localStorage.getItem("chk_story") !== null) document.getElementById("chkStory").checked = localStorage.getItem("chk_story") === "true";
    if (localStorage.getItem("chk_hl") !== null) document.getElementById("chkHighlight").checked = localStorage.getItem("chk_hl") === "true";
    if (localStorage.getItem("chk_range") !== null) document.getElementById("chkDisableRange").checked = localStorage.getItem("chk_range") === "true";
}

// Cập nhật số lượng tài khoản Database hiển thị trên các thẻ radio
async function updateDbCounts() {
    try {
        const res = await authFetch('/api/db/accounts');
        const accounts = await res.json();
        if (Array.isArray(accounts)) {
            const igCount = accounts.filter(a => a.platform === 'instagram' && a.is_active === 1).length;
            const xCount = accounts.filter(a => a.platform === 'twitter' && a.is_active === 1).length;
            document.getElementById("countDb-ig").textContent = igCount;
            document.getElementById("countDb-x").textContent = xCount;
        }
    } catch(e) { console.error("Lỗi đếm DB accounts:", e); }
}

// [MỚI]: Hàm thực thi lệnh thông minh
async function runJob(platform, action) {
    const targetTerm = platform === 'x' ? terminalX : terminalIg;
    targetTerm.innerHTML = "";
    switchTermTab(platform);
    addLog(`⏳ Đang khởi động Engine ${platform.toUpperCase()}...`, "LOG_SYSTEM", platform);

    if (action === 'livestream') {
        const liveTarget = document.getElementById("liveTarget-x").value.trim();
        if (!liveTarget) {
            addLog("⚠️ Lỗi: Bạn chưa nhập link Livestream!", "LOG_WARN", platform);
            return;
        }
        await authFetch("/api/x/livestream", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: liveTarget })
        });
        return;
    }

    if (action === 'sync_all') {
        await authFetch(`/api/${platform}/sync/local`, { method: 'POST' });
        return;
    }

    const mode = document.querySelector(`input[name="mode${platform === 'ig' ? 'Ig' : 'X'}"]:checked`).value;
    const payload = {
        disable_range: platform === 'ig' ? document.getElementById("chkDisableRange").checked : true,
        include_posts: platform === 'ig' ? document.getElementById("chkPost").checked : true,
        include_stories: platform === 'ig' ? document.getElementById("chkStory").checked : false,
        include_highlights: platform === 'ig' ? document.getElementById("chkHighlight").checked : false,
        targets: []
    };

    let endpoint = "";

    // 1. Chế độ dùng Database
    if (mode === 'db') {
        endpoint = action === 'new' ? `/api/${platform}/download/list` : `/api/${platform}/update/list`;
        payload.targets = []; // Để trống để Backend tự lấy từ database
        addLog(`🗄️ Đang lấy danh sách tài khoản từ Database...`, "LOG_SYSTEM", platform);
    } 
    // 2. Chế độ 1 Target
    else if (mode === 'single') {
        const singleVal = document.getElementById(`singleTarget-${platform}`).value.trim();
        if (!singleVal) {
            // Tự động chuyển sang Database nếu ô trống khi cập nhật
            if (action === 'update') {
                addLog("ℹ️ Ô nhập liệu trống. Hệ thống tự động chuyển sang cập nhật tài khoản từ Database!", "LOG_WARN", platform);
                endpoint = `/api/${platform}/update/list`;
                payload.targets = [];
            } else {
                addLog("⚠️ Lỗi: Bạn chưa nhập Username hoặc URL!", "LOG_WARN", platform);
                return;
            }
        } else {
            payload.target = singleVal;
            endpoint = action === 'new' ? `/api/${platform}/download/single` : `/api/${platform}/update/single`;
        }
    } 
    // 3. Chế độ Nhập List
    else {
        const rawList = document.getElementById(`listTargets-${platform}`).value;
        const targets = rawList.split('\n').map(s => s.trim()).filter(s => s !== "");
        if (targets.length === 0) {
            if (action === 'update') {
                addLog("ℹ️ Danh sách trống. Hệ thống tự động cập nhật tài khoản từ Database!", "LOG_WARN", platform);
                endpoint = `/api/${platform}/update/list`;
                payload.targets = [];
            } else {
                addLog("⚠️ Lỗi: Danh sách mục tiêu đang trống!", "LOG_WARN", platform);
                return;
            }
        } else {
            payload.targets = targets;
            endpoint = action === 'new' ? `/api/${platform}/download/list` : `/api/${platform}/update/list`;
        }
    }

    try {
        const res = await authFetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === "error") {
            addLog(`⚠️ ${data.message || "Lỗi xử lý yêu cầu"}`, "LOG_WARN", platform);
        }
    } catch(e) {
        if (e.message === "Unauthorized" || e.message === "Rate limited") return;
        addLog(`⚠️ Lỗi kết nối tới Server: ${e.message}`, "LOG_WARN", platform);
    }
}

async function runStop(platform) {
    addLog(`🛑 Đang gửi lệnh dừng cho ${platform.toUpperCase()}...`, "LOG_WARN", platform);
    try { 
        await authFetch(`/api/${platform}/stop`, { method: 'POST' }); 
    } catch(e) { 
        if (e.message === "Unauthorized" || e.message === "Rate limited") return;
        addLog(`⚠️ Không thể gửi lệnh dừng.`, "LOG_WARN", platform); 
    }
}

window.onload = async function() {
    await checkConfigStatus();
    await updateDbCounts();
    restoreInputState();
};