import XLSX from "xlsx";

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

        // Role Check
        const userSnap = await admin.database().ref(`users/${uid}`).once('value');
        const userData = userSnap.val();
        if (userData?.role !== 'teacher') {
            return { statusCode: 403, body: JSON.stringify({ error: "Forbidden: Teachers Only" }) };
        }

        // Parse body (expects base64 encoded Excel or FormData)
        const { fileBase64, fileName, mode } = JSON.parse(event.body || "{}");

        if (!fileBase64) {
            return { statusCode: 400, body: JSON.stringify({ error: "No file provided" }) };
        }

        // Decode and parse Excel
        const buffer = Buffer.from(fileBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) {
            return { statusCode: 400, body: JSON.stringify({ error: "Excel file is empty or has no data rows" }) };
        }

        // --- SECURITY LIMITS ---
        const MAX_ROWS = 500;
        const MAX_FILE_SIZE_MB = 5;

        // Check file size (base64 is ~33% larger than binary)
        const fileSizeMB = (fileBase64.length * 0.75) / (1024 * 1024);
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `Fayl hajmi ${MAX_FILE_SIZE_MB}MB dan oshmasligi kerak` })
            };
        }

        if (rows.length > MAX_ROWS + 1) { // +1 for header
            return {
                statusCode: 400,
                body: JSON.stringify({ error: `Maksimal ${MAX_ROWS} qator ruxsat etiladi` })
            };
        }

        const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
        const dataRows = rows.slice(1);

        // Auto-mapping with aliases
        const columnAliases = {
            subject: ['fan', 'subject', 'mavzu', 'fanname'],
            lesson: ['dars', 'lesson', 'title', 'darsname', 'darsnomi'],
            order: ['tartib', 'order', 'level'],
            class: ['sinf', 'class', 'grade']
        };

        const mapping = {};
        Object.keys(columnAliases).forEach(key => {
            const idx = headers.findIndex(h => columnAliases[key].includes(h));
            if (idx !== -1) mapping[key] = idx;
        });

        // Validate required columns
        if (mapping.subject === undefined || mapping.lesson === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "Missing required columns: 'fan/subject' and 'dars/lesson'",
                    foundHeaders: headers
                })
            };
        }

        // --- PREVIEW MODE ---
        if (mode === 'preview') {
            const preview = dataRows.slice(0, 10).map((row, idx) => ({
                rowNum: idx + 2,
                subject: row[mapping.subject] || '',
                lesson: row[mapping.lesson] || '',
                order: row[mapping.order] || idx + 1,
                class: row[mapping.class] || null
            }));

            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    mode: 'preview',
                    totalRows: dataRows.length,
                    mapping,
                    headers,
                    preview
                })
            };
        }

        // --- COMMIT MODE ---
        // Fetch existing subjects for duplicate checking
        const subjectsSnap = await admin.database().ref('subjects').once('value');
        const existingSubjects = subjectsSnap.val() || {};

        const updates = {};
        const subjectMap = {}; // Normalized name -> id

        // Build subject map from existing
        Object.entries(existingSubjects).forEach(([id, s]) => {
            const normName = String(s.name || '').toLowerCase().trim();
            subjectMap[normName] = id;
        });

        let newSubjectsCount = 0;
        let newLessonsCount = 0;
        const seenLessons = new Set(); // DUPLICATE CHECKING

        dataRows.forEach((row, idx) => {
            const subjectName = String(row[mapping.subject] || '').trim();
            const lessonTitle = String(row[mapping.lesson] || '').trim();
            const order = parseInt(row[mapping.order]) || (idx + 1);
            const sinf = row[mapping.class] ? parseInt(row[mapping.class]) : null;

            if (!subjectName || !lessonTitle) return; // Skip empty rows

            const normSubject = subjectName.toLowerCase();

            // --- DUPLICATE LESSON CHECK ---
            const lessonKey = `${normSubject}_${lessonTitle.toLowerCase()}`;
            if (seenLessons.has(lessonKey)) {
                return; // Skip duplicate
            }
            seenLessons.add(lessonKey);

            // Get or create subject ID
            let subjectId = subjectMap[normSubject];
            if (!subjectId) {
                subjectId = `S-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                subjectMap[normSubject] = subjectId;
                updates[`subjects/${subjectId}/name`] = subjectName;
                updates[`subjects/${subjectId}/createdBy`] = uid;
                updates[`subjects/${subjectId}/createdAt`] = Date.now();
                newSubjectsCount++;
            }

            // Create lesson
            const lessonId = `L-${Date.now()}-${Math.random().toString(36).substr(2, 5)}-${idx}`;
            updates[`subjects/${subjectId}/lessons/${lessonId}`] = {
                id: lessonId,
                title: lessonTitle,
                order,
                sinf,
                createdAt: Date.now()
            };
            newLessonsCount++;
        });

        // Execute atomic update
        if (Object.keys(updates).length > 0) {
            await admin.database().ref().update(updates);

            // Log the upload
            const logId = `upload_${Date.now()}`;
            await admin.database().ref(`logs/uploads/${logId}`).set({
                timestamp: Date.now(),
                fileName,
                userUid: uid,
                rowCount: dataRows.length,
                newSubjects: newSubjectsCount,
                newLessons: newLessonsCount
            });
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                mode: 'commit',
                newSubjects: newSubjectsCount,
                newLessons: newLessonsCount
            })
        };

    } catch (err) {
        console.error("Upload Excel Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message })
        };
    }
}
