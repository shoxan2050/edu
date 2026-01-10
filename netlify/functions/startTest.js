export async function handler(event) {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const token = event.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        let admin;
        try {
            admin = await import("firebase-admin");
            if (admin.apps.length === 0) {
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

        const { subjectId, lessonId, duration } = JSON.parse(event.body || "{}");

        if (!subjectId || !lessonId) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing parameters" }) };
        }

        // Record start time in database
        const startTime = Date.now();
        const testDuration = duration || 600; // Default 10 minutes

        await admin.database().ref(`users/${uid}/active_tests/${subjectId}_${lessonId}`).set({
            startTime,
            duration: testDuration,
            subjectId,
            lessonId
        });

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                startTime,
                duration: testDuration
            })
        };

    } catch (err) {
        console.error("Start Test Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
}
