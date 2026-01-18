// netlify/functions/generateAdaptiveTest.js
// Adaptiv test generatsiya - bilim darajasiga qarab qiyinchilik

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

    const { subjectId, topicId, topicTitle, grade, knowledgeLevel } = JSON.parse(event.body || "{}");

    if (!subjectId || !topicTitle) {
        return { statusCode: 400, body: JSON.stringify({ error: "subjectId va topicTitle kerak" }) };
    }

    const API_KEY = process.env.OPEN_ROUTER_KEY;
    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "OpenRouter kaliti yo'q" }) };
    }

    const MODEL = "xiaomi/mimo-v2-flash:free";
    const gradeLevel = grade || 7;
    const level = knowledgeLevel || "intermediate";

    // Qiyinchilik darajasiga qarab prompt
    const difficultyPrompts = {
        beginner: `
MUHIM: Bu BOSHLANG'ICH daraja uchun test. Savollar:
- Juda SODDA va tushunarli bo'lsin
- Faqat asosiy tushunchalarni so'rasin
- Javoblar orasida farq aniq bo'lsin
- Chalg'ituvchi variantlar kam bo'lsin
- Misol: "2 + 2 = ?" kabi oddiy savollar`,

        intermediate: `
MUHIM: Bu O'RTA daraja uchun test. Savollar:
- Amaliy masalalar bo'lsin
- Tahliliy fikrlashni talab qilsin
- Ba'zi savollar murakkab, ba'zilari oddiy
- Variant tanlash o'rtacha qiyinlikda`,

        advanced: `
MUHIM: Bu YUQORI daraja uchun test. Savollar:
- Murakkab muammolarni hal qilishni talab qilsin
- Tanqidiy fikrlash kerak
- Chalg'ituvchi variantlar kuchli bo'lsin
- Chuqur bilimni tekshirsin
- Olimpiada darajasidagi savollar`
    };

    const prompt = `Sen ta'lim platformasi uchun ADAPTIV test yaratuvchi AIsan.
Mavzu: "${topicTitle}"
Sinf darajasi: ${gradeLevel}-sinf
Bilim darajasi: ${level.toUpperCase()}

${difficultyPrompts[level]}

5 ta test savoli yarat. Har bir savol uchun:
- 4 ta variant (A, B, C, D)
- Faqat 1 ta to'g'ri javob
- "explanation" maydoni bo'lishi SHART
- "difficulty" maydoni: "${level}"

JSON formatda javob ber:
{"questions":[{"question":"Savol matni?","options":["A varianti","B varianti","C varianti","D varianti"],"correct":0,"explanation":"Bu javob to'g'ri chunki...","difficulty":"${level}"}]}`;

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
                    "X-Title": "EduPlatform Adaptive"
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: "system", content: "Sen adaptiv test yaratuvchi AI san. Faqat JSON formatda javob ber." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2500
                })
            });

            if (res.status === 502 || res.status === 503) {
                console.log(`Attempt ${attempt}: Server error ${res.status}, retrying...`);
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
            let text = data.choices?.[0]?.message?.content || "";

            if (!text) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI bo'sh javob berdi" }) };
            }

            // JSON ni tozalash
            text = text.trim();
            text = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
            text = text.trim();

            if (!text.startsWith('{')) {
                const startIdx = text.indexOf('{');
                if (startIdx !== -1) {
                    text = text.substring(startIdx);
                }
            }

            const lastBrace = text.lastIndexOf('}');
            if (lastBrace !== -1) {
                text = text.substring(0, lastBrace + 1);
            }

            // JSON repair
            function repairJSON(str) {
                let fixed = str;
                fixed = fixed.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');
                return fixed;
            }

            let json;
            try {
                json = JSON.parse(text);
            } catch (parseErr) {
                try {
                    const repaired = repairJSON(text);
                    json = JSON.parse(repaired);
                } catch (repairErr) {
                    console.error("JSON parse error:", text.substring(0, 300));
                    return { statusCode: 500, body: JSON.stringify({ error: "AI javobini o'qib bo'lmadi" }) };
                }
            }

            if (!json.questions || !Array.isArray(json.questions) || json.questions.length === 0) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI savollar bermadi" }) };
            }

            // Validate questions
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
                    difficulty: level,
                    explanation: q.explanation || ""
                };
            });

            // Save to user's adaptive tests
            const testData = {
                subjectId,
                topicId: topicId || 'general',
                topicTitle,
                questions: validatedQuestions,
                difficulty: level,
                generatedAt: Date.now(),
                grade: gradeLevel
            };

            // Save to Firebase
            const testKey = `${subjectId}_${topicId || 'general'}_${level}`;
            await admin.database().ref(`users/${decoded.uid}/adaptiveTests/${testKey}`).set(testData);

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    success: true,
                    testKey,
                    ...testData
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

    return { statusCode: 500, body: JSON.stringify({ error: lastError?.message || "AI xatosi" }) };
}
