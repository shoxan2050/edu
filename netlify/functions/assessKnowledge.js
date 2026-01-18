// netlify/functions/assessKnowledge.js
// Boshlang'ich bilim darajasini aniqlash uchun diagnostic test

export async function handler(event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // No auth required for initial assessment (pre-registration)
    const { grade, subjects } = JSON.parse(event.body || "{}");

    if (!grade) {
        return { statusCode: 400, body: JSON.stringify({ error: "grade kerak" }) };
    }

    const API_KEY = process.env.OPEN_ROUTER_KEY;
    if (!API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "OpenRouter kaliti yo'q" }) };
    }

    const MODEL = "xiaomi/mimo-v2-flash:free";
    const gradeLevel = parseInt(grade) || 7;

    // Default subjects based on grade
    const defaultSubjects = gradeLevel <= 4
        ? ["Matematika", "Ona tili", "O'qish"]
        : ["Matematika", "Fizika", "Ingliz tili"];

    const subjectList = subjects && subjects.length > 0 ? subjects : defaultSubjects;

    const prompt = `Sen boshlang'ich bilim darajasini aniqlovchi diagnostik test yaratuvchisan.
Sinf: ${gradeLevel}-sinf
Fanlar: ${subjectList.join(", ")}

Har bir fan uchun 2 ta ARALASH qiyinlikdagi savol yarat:
- 1 ta OSON savol (asosiy tushunchalar)
- 1 ta O'RTA qiyinlikdagi savol

Bu o'quvchining bilim darajasini aniqlash uchun.

Javob formati (FAQAT JSON):
{
  "subjects": {
    "Matematika": {
      "questions": [
        {"question": "Savol?", "options": ["A", "B", "C", "D"], "correct": 0, "level": "easy"},
        {"question": "Savol?", "options": ["A", "B", "C", "D"], "correct": 1, "level": "medium"}
      ]
    },
    "Fizika": {
      "questions": [...]
    }
  }
}`;

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
                    "X-Title": "EduPlatform Assessment"
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: "system", content: "Sen diagnostik test yaratuvchi AI san. Faqat JSON formatda javob ber." },
                        { role: "user", content: prompt }
                    ],
                    temperature: 0.6,
                    max_tokens: 3000
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
            let text = data.choices?.[0]?.message?.content || "";

            if (!text) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI bo'sh javob berdi" }) };
            }

            // Clean JSON
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

            // Repair JSON
            text = text.replace(/,\s*]/g, ']').replace(/,\s*}/g, '}');

            let json;
            try {
                json = JSON.parse(text);
            } catch (parseErr) {
                console.error("JSON parse error:", text.substring(0, 500));
                return { statusCode: 500, body: JSON.stringify({ error: "AI javobini o'qib bo'lmadi" }) };
            }

            if (!json.subjects) {
                return { statusCode: 500, body: JSON.stringify({ error: "AI fanlar bermadi" }) };
            }

            // Validate and normalize
            const validatedSubjects = {};
            Object.keys(json.subjects).forEach(subjectName => {
                const subject = json.subjects[subjectName];
                if (subject.questions && Array.isArray(subject.questions)) {
                    validatedSubjects[subjectName] = {
                        questions: subject.questions.slice(0, 3).map(q => {
                            let options = q.options;
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
                                correct,
                                level: q.level || "medium"
                            };
                        })
                    };
                }
            });

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    success: true,
                    grade: gradeLevel,
                    subjects: validatedSubjects,
                    totalQuestions: Object.values(validatedSubjects).reduce((sum, s) => sum + s.questions.length, 0),
                    generatedAt: Date.now()
                })
            };

        } catch (err) {
            console.error("Assessment error:", err);
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
        }
    }

    return { statusCode: 500, body: JSON.stringify({ error: lastError?.message || "AI xatosi" }) };
}
