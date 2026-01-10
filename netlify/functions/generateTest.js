export async function handler(event) {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        // --- Security Protocols ---
        const token = event.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        let admin;
        try {
            admin = await import("firebase-admin");
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
                });
            }
        } catch (e) {
            console.error("Firebase Admin Error:", e);
            return { statusCode: 500, body: JSON.stringify({ error: "Server Configuration Error" }) };
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const userRef = admin.database().ref(`users/${decodedToken.uid}`);
        const userSnap = await userRef.once('value');
        const userData = userSnap.val();

        if (userData?.role !== 'teacher') {
            return { statusCode: 403, body: JSON.stringify({ error: "Forbidden: Teachers Only" }) };
        }

        // --- Rate Limiting Strategy ---
        const { topic, subjectId, lessonId, force, grade } = JSON.parse(event.body || "{}");

        if (!topic || !lessonId) {
            return { statusCode: 400, body: JSON.stringify({ error: "Topic and lessonId required" }) };
        }

        const lessonCooldownKey = `limits/lessons/${lessonId}/lastGenerated`;
        const lastLessonGen = userData.limits?.lessons?.[lessonId]?.lastGenerated || 0;
        const now = Date.now();
        const COOLDOWN_24H = 24 * 60 * 60 * 1000;

        if (!force && (now - lastLessonGen < COOLDOWN_24H)) {
            const hoursLeft = Math.ceil((COOLDOWN_24H - (now - lastLessonGen)) / (60 * 60 * 1000));
            return {
                statusCode: 429,
                body: JSON.stringify({ error: `Bu dars uchun 24 soat kutish kerak. Qoldi: ~${hoursLeft} soat` })
            };
        }

        await userRef.child(lessonCooldownKey).set(now);

        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
            return { statusCode: 500, body: JSON.stringify({ error: "Gemini API key missing" }) };
        }

        // Grade level (default 7)
        const gradeLevel = grade || 7;

        // --- GRADE-AWARE PROMPT ---
        const prompt = `
SEN TA'LIM PLATFORMASI UCHUN TEST YARATUVCHI AIsan.

MAVZU: "${topic}"
SINF: ${gradeLevel}-sinf (O'zbekiston maktab dasturi)

QOIDALAR:
- 5 ta savol bo'lsin
- Savollar AYNAN ${gradeLevel}-sinf darajasida
- O'zbekiston Respublikasi maktab dasturiga mos
- Variantlar aniq va chalg'ituvchi bo'lmasin
- 1 ta to'g'ri javob

FORMAT (QAT'IY - FAQAT JSON):
{
  "questions": [
    {
      "question": "Savol matni",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "difficulty": "easy | medium | hard",
      "explanation": "Nima uchun shu javob to'g'ri"
    }
  ]
}

MUHIM:
- difficulty real baholansin (${gradeLevel}-sinf uchun)
- explanation qisqa va tushunarli bo'lsin
- HTML YO'Q, Markdown YO'Q
- FAQAT JSON qaytar
`;

        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        response_mime_type: "application/json"
                    }
                })
            }
        );

        const data = await res.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        if (!text) {
            throw new Error("AI responded with an empty body. Check API quota.");
        }

        // --- ROBUST JSON EXTRACTION ---
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }

        let json;
        try {
            json = JSON.parse(text);
        } catch (parseErr) {
            console.error("JSON Parse Error, raw text:", text);
            throw new Error("AI javobini o'qib bo'lmadi. Qayta urinib ko'ring.");
        }

        if (!json.questions || !Array.isArray(json.questions)) {
            throw new Error("Invalid AI JSON format");
        }

        const validatedQuestions = json.questions.slice(0, 5).map(q => {
            // --- AI VALIDATION RULES ---
            // Rule 1: Question text must be at least 10 characters
            const questionText = String(q.question || '').trim();
            if (questionText.length < 10) {
                throw new Error("AI savoli juda qisqa. Qayta urinib ko'ring.");
            }

            // Rule 2: Must have exactly 4 options
            let options = q.options;
            if (options && typeof options === 'object' && !Array.isArray(options)) {
                options = Object.values(options);
            }
            if (!Array.isArray(options) || options.length !== 4) {
                throw new Error("AI 4 ta variant bermadi. Qayta urinib ko'ring.");
            }

            // Rule 3: Correct must be 0-3
            let correct = q.correct;
            if (typeof correct === 'string') {
                const charCode = correct.toUpperCase().charCodeAt(0);
                if (charCode >= 65 && charCode <= 68) {
                    correct = charCode - 65;
                } else {
                    correct = 0;
                }
            } else if (typeof correct !== 'number' || correct < 0 || correct > 3) {
                correct = 0;
            }

            return {
                question: questionText,
                options: options,
                correct: correct,
                difficulty: q.difficulty || "o'rtacha",
                explanation: q.explanation || "Tushuntirish yo'q"
            };
        });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                topic: topic,
                questions: validatedQuestions,
                lessonId: lessonId || null,
                timestamp: Date.now()
            })
        };

    } catch (err) {
        console.error("AI handler error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
}
