/**
 * geo-logger.js - Simplified device data collector
 * Sends basic device info through Netlify serverless function
 * NO location/GPS requests - only basic device information
 */

// Send message through Netlify function
async function sendToTelegram(message) {
    try {
        await fetch("/.netlify/functions/sendVisitorLog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: [message] })
        });
    } catch (e) {
        // Silent fail
    }
}

// Get browser name
function getBrowserName() {
    var ua = navigator.userAgent;
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("SamsungBrowser") > -1) return "Samsung";
    if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) return "Opera";
    if (ua.indexOf("Edg") > -1) return "Edge";
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    return "Unknown";
}

// Get device type
function getDeviceType() {
    var ua = navigator.userAgent;
    if (/iPhone/i.test(ua)) return "📱 iPhone";
    if (/iPad/i.test(ua)) return "📱 iPad";
    if (/Android/i.test(ua) && /Mobile/i.test(ua)) return "📱 Android";
    if (/Android/i.test(ua)) return "📱 Android Tablet";
    if (/Windows/i.test(ua)) return "💻 Windows";
    if (/Mac/i.test(ua)) return "💻 Mac";
    if (/Linux/i.test(ua)) return "💻 Linux";
    return "Unknown";
}

// Simple data collector - NO LOCATION
function collectData() {
    return {
        device: getDeviceType(),
        browser: getBrowserName(),
        screen: window.screen.width + "x" + window.screen.height,
        language: navigator.language || "N/A",
        page: window.location.pathname,
        time: new Date().toLocaleString("uz-UZ"),
        referrer: document.referrer || "Direct"
    };
}

// Send visitor info
async function sendVisitorInfo() {
    var data = collectData();

    var msg = "<b>🔔 YANGI TASHRIF</b>\n" +
        "━━━━━━━━━━━━━━━━━━━━\n\n" +
        "🖥️ <b>Qurilma:</b> " + data.device + "\n" +
        "🌐 <b>Brauzer:</b> " + data.browser + "\n" +
        "📐 <b>Ekran:</b> " + data.screen + "\n" +
        "🌍 <b>Til:</b> " + data.language + "\n" +
        "📄 <b>Sahifa:</b> " + data.page + "\n" +
        "🔗 <b>Qayerdan:</b> " + data.referrer + "\n" +
        "🕐 <b>Vaqt:</b> " + data.time;

    await sendToTelegram(msg);
}

// Run on page load
window.addEventListener("load", sendVisitorInfo);
