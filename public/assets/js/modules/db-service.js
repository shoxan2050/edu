import { db } from '../firebase.js';
import { ref, get, update, query, orderByKey, limitToLast } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export const DbService = {
    // Generic getter
    async getDoc(path) {
        const snapshot = await get(ref(db, path));
        return snapshot.exists() ? snapshot.val() : null;
    },

    async getSubject(subjectId) {
        return this.getDoc(`subjects/${subjectId}`);
    },

    async getUser(uid) {
        return this.getDoc(`users/${uid}`);
    },

    async getSubjectsByClass(classNum) {
        const snapshot = await get(ref(db, 'subjects'));
        if (!snapshot.exists()) return {};
        const all = snapshot.val();
        const filtered = {};
        Object.keys(all).forEach(id => {
            const s = all[id];
            if (!s.classes || s.classes.includes(classNum)) filtered[id] = s;
        });
        return filtered;
    },

    async getAllSubjects() {
        try {
            const result = await this.getDoc('subjects');
            console.log('[DbService] getAllSubjects result:', result ? 'data found' : 'null');
            return result || {};
        } catch (error) {
            console.error('[DbService] getAllSubjects error:', error);
            return {}; // Always return empty object on error
        }
    },

    async updateSubject(subjectId, data) {
        await update(ref(db, `subjects/${subjectId}`), data);
    },

    async getTests(subjectId, lessonId) {
        const snapshot = await get(ref(db, `tests/${subjectId}/${lessonId}`));
        return snapshot.exists() ? snapshot.val() : null;
    },

    async saveTest(subjectId, lessonId, testData) {
        const updates = {};
        updates[`tests/${subjectId}/${lessonId}`] = {
            ...testData,
            createdAt: Date.now()
        };
        updates[`subjects/${subjectId}/lessons/${lessonId}/testGenerated`] = true;
        updates[`subjects/${subjectId}/lessons/${lessonId}/lastGenerated`] = Date.now();
        await update(ref(db), updates);
    },

    async saveUserProgress(uid, subjectId, lessonId, percent) {
        const updates = {};
        updates[`users/${uid}/progress/${subjectId}/${lessonId}`] = percent;
        updates[`users/${uid}/lastActive`] = Date.now();
        await update(ref(db), updates);
    },

    async commitBatchUpload(updates, fileName, userUid) {
        // Atomic update
        await update(ref(db), updates);

        // Log the upload
        const logId = `upload_${Date.now()}`;
        const logData = {
            timestamp: Date.now(),
            fileName,
            userUid,
            rowCount: Object.keys(updates).filter(k => k.includes('/lessons/')).length
        };
        await update(ref(db, `logs/uploads/${logId}`), logData);
    },

    // ========== TEST MANAGEMENT ==========

    // Barcha testlarni olish
    async getAllTests() {
        try {
            const result = await this.getDoc('tests');
            return result || {};
        } catch (error) {
            console.error('[DbService] getAllTests error:', error);
            return {};
        }
    },

    // Sinf bo'yicha testlarni olish
    async getTestsByClass(classNum) {
        try {
            const allTests = await this.getAllTests();
            const subjects = await this.getAllSubjects();
            const filteredTests = [];

            Object.keys(allTests).forEach(subjectId => {
                const subject = subjects[subjectId];
                if (!subject) return;

                // Check if subject is for this class
                if (!subject.classes || subject.classes.includes(classNum)) {
                    Object.keys(allTests[subjectId]).forEach(lessonId => {
                        const test = allTests[subjectId][lessonId];
                        filteredTests.push({
                            subjectId,
                            lessonId,
                            subjectName: subject.name,
                            lessonTitle: subject.lessons?.[lessonId]?.title || lessonId,
                            ...test
                        });
                    });
                }
            });

            return filteredTests;
        } catch (error) {
            console.error('[DbService] getTestsByClass error:', error);
            return [];
        }
    },

    // O'quvchi uchun testlarni olish
    async getTestsForStudent(uid, classNum) {
        const tests = await this.getTestsByClass(classNum);
        const user = await this.getUser(uid);
        const testResults = user?.testResults || {};

        return tests.map(test => ({
            ...test,
            completed: !!testResults[`${test.subjectId}_${test.lessonId}`],
            score: testResults[`${test.subjectId}_${test.lessonId}`]?.score || null
        }));
    },

    // Test tahrirlash
    async updateTest(subjectId, lessonId, questions) {
        const updates = {};
        updates[`tests/${subjectId}/${lessonId}/questions`] = questions;
        updates[`tests/${subjectId}/${lessonId}/updatedAt`] = Date.now();
        await update(ref(db), updates);
    },

    // Test natijasini saqlash
    async saveTestResult(uid, subjectId, lessonId, score, answers) {
        const key = `${subjectId}_${lessonId}`;
        const updates = {};
        updates[`users/${uid}/testResults/${key}`] = {
            score,
            answers,
            completedAt: Date.now()
        };
        await update(ref(db), updates);
    }
};
