// netlify/functions/generateTest.js
export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
    }

    // Firebase Admin - ESM import fix
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

    const userSnap = await admin.database().ref(`users/${decoded.uid}`).once('value');
    const userData = userSnap.val();

    if (userData?.role !== 'teacher') {
        return { statusCode: 403, body: JSON.stringify({ error: "Teachers only" }) };
    }

    const { topic, subjectId, lessonId, grade } = JSON.parse(event.body || "{}");
    if (!topic || !lessonId) {
        return { statusCode: 400, body: JSON.stringify({ error: "topic va lessonId kerak" }) };
    }

    const API_KEY = process.env.OPEN_ROUTER_KEY;
    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "OpenRouter kaliti yo'q" }) };
    }

    // Ishlayotgan bepul model (tekshirilgan!)
    const MODEL = "xiaomi/mimo-v2-flash:free";
    const gradeLevel = grade || 7;

    const prompt = `${topic} - 5 ta test. 4 variant, 1 to'g'ri.
JSON: {"questions":[{"question":"?","options":["A","B","C","D"],"correct":0}]}`;

    // Retry logic for transient errors
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${API_KEY}`,
                    "HTTP-Referer": "https://skillway.netlify.app",
                    "X-Title": "EduPlatform"
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: "system", content: "Sen test yaratuvchi AI san. Faqat JSON formatda javob ber." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2500
                })
            });

            if (res.status === 502 || res.status === 503) {
                console.log(`Attempt ${attempt}: Server error ${res.status}, retrying...`);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 1000 * attempt)); // Wait 1s, 2s, 3s
                    continue;
                }
            }

            if (!res.ok) {
                const err = await res.text();
                console.error("OpenRouter error:", err);
                return { statusCode: 500, body: JSON.stringify({ error: `AI xatosi: ${res.status}` }) };
            }

            const data = await res.json();
            let text = data.choices?.[0]?.message?.content || "";

            if (!text) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI bo'sh javob berdi" }) };
            }

            // JSON ni tozalash (har xil formatlarni qo'llab-quvvatlash)
            text = text.trim();

            // Markdown code block olib tashlash
            text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
            text = text.trim();

            // Agar text { bilan boshlanmasa, { topish
            if (!text.startsWith('{')) {
                const startIdx = text.indexOf('{');
                if (startIdx !== -1) {
                    text = text.substring(startIdx);
                }
            }

            // Oxirgi } ni topish
            const lastBrace = text.lastIndexOf('}');
            if (lastBrace !== -1) {
                text = text.substring(0, lastBrace + 1);
            }

            console.log("AI raw response length:", text.length);

            // JSON ni ta'mirlash (AI xatolarini tuzatish)
            function repairJSON(str) {
                // Oxirgi yopilmagan stringni yopish
                let fixed = str;

                // Oxirgi ] va } ni topish
                const lastBracket = fixed.lastIndexOf(']');
                const lastBrace = fixed.lastIndexOf('}');

                if (lastBracket > 0 && lastBrace > lastBracket) {
                    // ] dan oldin yopilmagan " bormi?
                    const beforeBracket = fixed.substring(0, lastBracket);
                    const lastQuote = beforeBracket.lastIndexOf('"');
                    const afterLastQuote = beforeBracket.substring(lastQuote + 1);

                    // Agar oxirgi " dan keyin yana " yo'q bo'lsa, qo'shish
                    if (!afterLastQuote.includes('"') && afterLastQuote.trim().length > 0) {
                        fixed = beforeBracket + '"' + fixed.substring(lastBracket);
                    }
                }

                // Trailing comma olib tashlash
                fixed = fixed.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');

                return fixed;
            }

            let json;
            try {
                json = JSON.parse(text);
            } catch (parseErr) {
                // Birinchi urinish muvaffaqiyatsiz - ta'mirlashga harakat
                console.log("First parse failed, trying to repair...");
                try {
                    const repaired = repairJSON(text);
                    json = JSON.parse(repaired);
                    console.log("JSON repaired successfully!");
                } catch (repairErr) {
                    console.error("JSON parse error. Raw text:", text.substring(0, 300));
                    return { statusCode: 500, body: JSON.stringify({ error: "AI javobini o'qib bo'lmadi. Qayta urinib ko'ring." }) };
                }
            }

            if (!json.questions || !Array.isArray(json.questions) || json.questions.length === 0) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI savollar bermadi" }) };
            }

            // Savollarni validatsiya qilish
            const validatedQuestions = json.questions.slice(0, 5).map(q => {
                let options = q.options;
                if (options && typeof options === 'object' && !Array.isArray(options)) {
                    options = Object.values(options);
                }
                if (!Array.isArray(options) || options.length < 4) {
                    options = ["A", "B", "C", "D"];
                }

                let correct = q.correct;
                if (typeof correct === 'string') {
                    const code = correct.toUpperCase().charCodeAt(0);
                    correct = code >= 65 && code <= 68 ? code - 65 : 0;
                }
                if (typeof correct !== 'number' || correct < 0 || correct > 3) {
                    correct = 0;
                }

                return {
                    question: String(q.question || "Savol").trim(),
                    options: options.slice(0, 4),
                    correct: correct,
                    difficulty: q.difficulty || "medium",
                    explanation: q.explanation || ""
                };
            });

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    topic: topic,
                    questions: validatedQuestions,
                    lessonId: lessonId,
                    timestamp: Date.now()
                })
            };

        } catch (err) {
            console.error("Generate error:", err);
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
        }
    }

    // All retries failed
    return { statusCode: 500, body: JSON.stringify({ error: lastError?.message || "AI xatosi" }) };
}
