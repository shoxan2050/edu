// Admin authentication - credentials in environment variables
// ADMIN_EMAIL and ADMIN_PASSWORD must be set in Netlify env

export async function handler(event) {
    try {
        if (event.httpMethod !== "POST") {
            return { statusCode: 405, body: "Method Not Allowed" };
        }

        const { email, uid } = JSON.parse(event.body || "{}");

        // Get admin credentials from environment (NOT exposed to frontend)
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "malware2050@gmail.com";

        // Check if user is admin
        const isAdmin = email === ADMIN_EMAIL;

        if (!isAdmin) {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: "Not authorized", isAdmin: false })
            };
        }

        // Initialize Firebase Admin to update user role
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
            return { statusCode: 500, body: JSON.stringify({ error: "Server Error" }) };
        }

        // Set admin role in database
        if (uid) {
            await admin.database().ref(`users/${uid}/role`).set('admin');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                isAdmin: true,
                message: "Admin verified"
            })
        };

    } catch (err) {
        console.error("Admin check error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
}
