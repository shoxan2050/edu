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
        const result = await this.getDoc('subjects');
        return result || {};
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
    }
};
