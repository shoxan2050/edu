// netlify/functions/aiChat.js
// AI Chatbot - o'quvchilarga yordam beruvchi

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // Firebase Admin
    let admin;
    try {
        const firebaseAdmin = await import("firebase-admin");
        admin = firebaseAdmin.default || firebaseAdmin;

        if (!admin.apps || admin.apps.length === 0) {
            if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
                return { statusCode: 500, body: JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT not set" }) };
            }

            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
            });
        }
    } catch (e) {
        console.error("Firebase Admin Error:", e);
        return { statusCode: 500, body: JSON.stringify({ error: "Firebase Error: " + e.message }) };
    }

    // Token verification
    let decoded;
    try {
        decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
        return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }

    const { message, context, grade, chatHistory } = JSON.parse(event.body || "{}");

    if (!message) {
        return { statusCode: 400, body: JSON.stringify({ error: "message kerak" }) };
    }

    const API_KEY = process.env.OPEN_ROUTER_KEY;
    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "OpenRouter kaliti yo'q" }) };
    }

    const MODEL = "xiaomi/mimo-v2-flash:free";
    const gradeLevel = grade || 7;
    const subjectContext = context || "umumiy";

    const systemPrompt = `Sen EduPlatform uchun yordam beruvchi AI o'qituvchisan.

MUHIM QOIDALAR:
1. Faqat O'ZBEK tilida javob ber
2. O'quvchi ${gradeLevel}-sinf o'quvchisi - shunga mos tushuntir
3. Hozirgi mavzu konteksti: ${subjectContext}
4. Javoblarni qisqa va tushunarli qil
5. Kerak bo'lsa misollar keltir
6. O'quvchini rag'batlantir va ijobiy bo'l
7. Agar savol darsga oid bo'lmasa, darsga qaytishga yordam ber
8. Matematik formulalar yoki kod kerak bo'lsa, sodda tushuntir

Sen do'stona va sabr-toqatli o'qituvchisan. O'quvchilarni o'rganishga ilhomlantir!`;

    // Build messages array with history
    const messages = [
        { role: "system", content: systemPrompt }
    ];

    // Add chat history (last 6 messages for context)
    if (chatHistory && Array.isArray(chatHistory)) {
        const recentHistory = chatHistory.slice(-6);
        recentHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content
            });
        });
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const maxRetries = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`,
                    "HTTP-Referer": "https://skillway.netlify.app",
                    "X-Title": "EduPlatform Chat"
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages,
                    temperature: 0.8,
                    max_tokens: 1000
                })
            });

            if (res.status === 502 || res.status === 503) {
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                    continue;
                }
            }

            if (!res.ok) {
                const err = await res.text();
                console.error("OpenRouter error:", err);
                return { statusCode: 500, body: JSON.stringify({ error: `AI xatosi: ${res.status}` }) };
            }

            const data = await res.json();
            const reply = data.choices?.[0]?.message?.content || "";

            if (!reply) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI javob bermadi" }) };
            }

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    reply: reply.trim(),
                    timestamp: Date.now()
                })
            };

        } catch (err) {
            console.error("Chat error:", err);
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
        }
    }

    return { statusCode: 500, body: JSON.stringify({ error: lastError?.message || "AI xatosi" }) };
}
