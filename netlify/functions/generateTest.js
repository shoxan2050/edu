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

    const prompt = `${topic} mavzusi bo'yicha 5 ta test savoli yarat. Har birida 4 variant va 1 to'g'ri javob.

JSON format:
{"questions":[{"question":"...","options":["A","B","C","D"],"correct":0,"explanation":"..."}]}`;

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
                max_tokens: 1500
            })
        });

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
        text = text.replace(/```json|```/g, '').trim();

        // JSON ni ajratib olish
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            console.error("JSON parse error:", text);
            return { statusCode: 500, body: JSON.stringify({ error: "AI javobini o'qib bo'lmadi" }) };
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
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
}
