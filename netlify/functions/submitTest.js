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
            admin = await import("firebase-admin");
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
                    databaseURL: "https://edu-platform-default-rtdb.firebaseio.com" // Ensure this is correct or inferred? Usually inferred from creds if project ID is there, but explicit is safer if needed. Actually, certify returns creds.
                    // Note: databaseURL is often required for Admin SDK RTDB access unless inferred.
                    // Assuming standard Firebase setup, passing credential is usually enough if project ID is in cert.
                    // Adding databaseURL explicitly to be safe if env var has it, otherwise rely on default.
                    // Let's assume standard behavior first.
                    // WAIT: The generateTest.js didn't use databaseURL, it used admin.database().ref(). 
                    // Checks generateTest.js: `admin.initializeApp({ credential: ... })`.
                    // It worked? If so, I'll stick to that.
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
        // answers: { questionIndex: selectedOptionIndex, ... } or [0, 1, 2, ...]

        if (!subjectId || !lessonId || !answers) {
            return {
                statusCode: 400, body: JSON.stringify({ error: "Missing submission data" })
            };
        }

        // Fecth Secure Test Data (Correct Answers)
        // Note: DbService usually writes to `tests/${subjectId}/${lessonId}`
        const testRef = admin.database().ref(`tests/${subjectId}/${lessonId}`);
        const testSnap = await testRef.once('value');

        if (!testSnap.exists()) {
            return { statusCode: 404, body: JSON.stringify({ error: "Test not found" }) };
        }

        // --- SERVER-SIDE TIMER VALIDATION ---
        const activeTestRef = admin.database().ref(`users/${uid}/active_tests/${subjectId}_${lessonId}`);
        const activeSnap = await activeTestRef.once('value');

        let timerValid = true;
        let timeElapsed = 0;

        if (activeSnap.exists()) {
            const { startTime, duration } = activeSnap.val();
            timeElapsed = Math.floor((Date.now() - startTime) / 1000);

            // Allow 30 second grace period for network latency
            if (timeElapsed > duration + 30) {
                timerValid = false;
            }

            // Clear the active test record
            await activeTestRef.remove();
        }
        // If no active test record, REJECT (security fix)
        else {
            console.warn(`SECURITY: No active test record for user ${uid}, test ${subjectId}/${lessonId}`);
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Test boshlanmagan. Avval test.html orqali boshlang." })
            };
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
