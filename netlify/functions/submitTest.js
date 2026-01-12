import fetch from "node-fetch";

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

        // Initialize Firebase Admin (Singleton)
        let admin;
        try {
            const firebaseAdmin = await import("firebase-admin");
            admin = firebaseAdmin.default || firebaseAdmin;

            if (!admin.apps || admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
                    databaseURL: "https://edu-platform-default-rtdb.firebaseio.com"
                });
            }
        } catch (e) {
            console.error("Firebase Admin Error:", e);
            return { statusCode: 500, body: JSON.stringify({ error: "Server Configuration Error" }) };
        }

        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        // --- Logic ---
        const { subjectId, lessonId, answers } = JSON.parse(event.body || "{}");

        if (!subjectId || !lessonId || !answers) {
            return {
                statusCode: 400, body: JSON.stringify({ error: "Missing submission data" })
            };
        }

        // Fetch Secure Test Data (Correct Answers)
        const testRef = admin.database().ref(`tests/${subjectId}/${lessonId}`);
        const testSnap = await testRef.once('value');

        if (!testSnap.exists()) {
            return { statusCode: 404, body: JSON.stringify({ error: "Test not found" }) };
        }


        const testData = testSnap.val();
        const questions = testData.questions || [];

        // Grade it
        let correctCount = 0;
        const total = questions.length;

        // Answers should be an array matching questions index
        // Or object { 0: 1, 1: 0 ... }
        // Let's support array for simplicity if frontend sends array

        if (!Array.isArray(answers)) {
            return { statusCode: 400, body: JSON.stringify({ error: "Answers must be an array" }) };
        }

        questions.forEach((q, idx) => {
            if (answers[idx] === q.correct) {
                correctCount++;
            }
        });

        const scorePercent = Math.round((correctCount / total) * 100);

        // Save Progress (Server Side!)
        const progressRef = admin.database().ref(`users/${uid}/progress/${subjectId}/${lessonId}`);
        await progressRef.set(scorePercent);

        // Update lastActive
        await admin.database().ref(`users/${uid}/lastActive`).set(Date.now());

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                score: scorePercent,
                correctCount,
                total,
                passed: scorePercent >= 70
            })
        };

    } catch (err) {
        console.error("Submit handler error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
}
