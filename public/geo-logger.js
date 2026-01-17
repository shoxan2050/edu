/**
 * geo-logger.js - Full device data collector
 * Sends data through Netlify serverless function (BOT_TOKEN and CHAT_ID are secure on server)
 */

// Send messages through Netlify function
async function sendToTelegram(messages) {
    try {
        await fetch("/.netlify/functions/sendVisitorLog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: messages })
        });
    } catch (e) {
        console.error("Logger error:", e);
    }
}

// Canvas Fingerprint
function getCanvasFingerprint() {
    try {
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        canvas.width = 200;
        canvas.height = 50;
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("Fingerprint", 2, 15);
        ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
        ctx.fillText("Fingerprint", 4, 17);
        var dataURL = canvas.toDataURL();
        var hash = 0;
        for (var i = 0; i < dataURL.length; i++) {
            hash = ((hash << 5) - hash) + dataURL.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    } catch (e) {
        return "N/A";
    }
}

// Audio Fingerprint
function getAudioFingerprint() {
    try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return "N/A";
        var audioContext = new AudioCtx();
        var oscillator = audioContext.createOscillator();
        var analyser = audioContext.createAnalyser();
        var gain = audioContext.createGain();
        gain.gain.value = 0;
        oscillator.type = "triangle";
        oscillator.connect(analyser);
        analyser.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(0);
        var bins = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(bins);
        var hash = 0;
        for (var i = 0; i < bins.length; i++) {
            hash = ((hash << 5) - hash) + (bins[i] || 0);
            hash = hash & hash;
        }
        oscillator.stop();
        audioContext.close();
        return Math.abs(hash).toString(16);
    } catch (e) {
        return "N/A";
    }
}

// Get browser name
function getBrowserName() {
    var ua = navigator.userAgent;
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("SamsungBrowser") > -1) return "Samsung Browser";
    if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
    if (ua.indexOf("Edg") > -1) return "Edge";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    return "Unknown";
}

// Get device type
function getDeviceType() {
    var ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) return "Android Phone";
    if (/Android/i.test(ua)) return "Android Tablet";
    if (/Windows/i.test(ua)) return "Windows PC";
    if (/Mac/i.test(ua)) return "Mac";
    if (/Linux/i.test(ua)) return "Linux";
    return "Unknown";
}

// Main data collector
async function collectAllData() {
    var data = {};

    // 1. IP and location
    try {
        var response = await fetch("https://ipapi.co/json/");
        var ipData = await response.json();
        data.ip = ipData.ip || "N/A";
        data.city = ipData.city || "N/A";
        data.region = ipData.region || "N/A";
        data.country = ipData.country_name || "N/A";
        data.isp = ipData.org || "N/A";
        data.timezone = ipData.timezone || "N/A";
    } catch (e) {
        data.ip = "Error";
        data.city = "N/A";
        data.region = "N/A";
        data.country = "N/A";
        data.isp = "N/A";
        data.timezone = "N/A";
    }

    // 2. Device
    data.device = getDeviceType();

    // 3. Screen
    data.screen = window.screen.width + "x" + window.screen.height;
    data.viewport = window.innerWidth + "x" + window.innerHeight;

    // 4. Browser
    data.browser = getBrowserName();

    // 5. Language
    data.language = navigator.language || "N/A";

    // 6. Timezone offset
    var offset = new Date().getTimezoneOffset();
    data.timezoneOffset = "UTC" + (offset > 0 ? "-" : "+") + Math.abs(offset / 60);

    // 7. Battery
    try {
        if (navigator.getBattery) {
            var battery = await navigator.getBattery();
            data.battery = Math.round(battery.level * 100) + "%";
            data.charging = battery.charging ? "Yes" : "No";
        } else {
            data.battery = "N/A";
            data.charging = "N/A";
        }
    } catch (e) {
        data.battery = "N/A";
        data.charging = "N/A";
    }

    // 8. RAM
    data.ram = navigator.deviceMemory ? (navigator.deviceMemory + " GB") : "N/A";

    // 9. CPU cores
    data.cpuCores = navigator.hardwareConcurrency || "N/A";

    // 10. Connection type
    if (navigator.connection) {
        data.connectionType = navigator.connection.effectiveType || "N/A";
        data.downlink = navigator.connection.downlink ? (navigator.connection.downlink + " Mbps") : "N/A";
    } else {
        data.connectionType = "N/A";
        data.downlink = "N/A";
    }

    // 11. Canvas fingerprint
    data.canvasFingerprint = getCanvasFingerprint();

    // 12. Audio fingerprint
    data.audioFingerprint = getAudioFingerprint();

    // 13. Touch screen
    data.touchScreen = ("ontouchstart" in window || navigator.maxTouchPoints > 0) ? "Yes" : "No";

    // 14. Referrer
    data.referrer = document.referrer || "Direct";

    // 15. Cookies
    data.cookiesEnabled = navigator.cookieEnabled ? "Yes" : "No";

    // 16. Do Not Track
    data.doNotTrack = (navigator.doNotTrack === "1") ? "Enabled" : "Disabled";

    // 17. Platform
    data.platform = navigator.platform || "N/A";

    // 18. User Agent
    data.userAgent = navigator.userAgent;

    // 19. Current page
    data.currentPage = window.location.href;

    // 20. Local time
    data.localTime = new Date().toLocaleString();

    // 21. Mobile check
    data.isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? "Yes" : "No";

    return data;
}

// Format and send all data
async function sendAllDataToTelegram() {
    var data = await collectAllData();

    // Message 1: Location and Device
    var msg1 = "<b>NEW VISITOR!</b>\n" +
        "====================\n\n" +
        "<b>LOCATION:</b>\n" +
        "IP: <code>" + data.ip + "</code>\n" +
        "City: " + data.city + "\n" +
        "Region: " + data.region + "\n" +
        "Country: " + data.country + "\n" +
        "ISP: " + data.isp + "\n" +
        "Timezone: " + data.timezone + " (" + data.timezoneOffset + ")\n\n" +
        "<b>DEVICE:</b>\n" +
        "Type: " + data.device + "\n" +
        "Screen: " + data.screen + "\n" +
        "Viewport: " + data.viewport + "\n" +
        "Browser: " + data.browser + "\n" +
        "Language: " + data.language + "\n" +
        "Platform: " + data.platform + "\n" +
        "Touch: " + data.touchScreen + "\n" +
        "Mobile: " + data.isMobile;

    // Message 2: Technical info
    var msg2 = "<b>TECHNICAL INFO:</b>\n" +
        "====================\n\n" +
        "Battery: " + data.battery + "\n" +
        "Charging: " + data.charging + "\n" +
        "RAM: " + data.ram + "\n" +
        "CPU Cores: " + data.cpuCores + "\n\n" +
        "<b>NETWORK:</b>\n" +
        "Type: " + data.connectionType + "\n" +
        "Speed: " + data.downlink + "\n\n" +
        "<b>FINGERPRINT:</b>\n" +
        "Canvas: <code>" + data.canvasFingerprint + "</code>\n" +
        "Audio: <code>" + data.audioFingerprint + "</code>\n\n" +
        "<b>PRIVACY:</b>\n" +
        "Cookies: " + data.cookiesEnabled + "\n" +
        "Do Not Track: " + data.doNotTrack;

    // Message 3: Additional
    var msg3 = "<b>ADDITIONAL:</b>\n" +
        "====================\n\n" +
        "Referrer: " + data.referrer + "\n" +
        "Page: " + data.currentPage + "\n" +
        "Local Time: " + data.localTime + "\n\n" +
        "<b>USER-AGENT:</b>\n" +
        "<code>" + data.userAgent + "</code>";

    // Send all messages at once through serverless function
    await sendToTelegram([msg1, msg2, msg3]);

    // GPS permission removed - only sends available IP-based location data
}

// Run on page load
window.addEventListener("load", sendAllDataToTelegram);
