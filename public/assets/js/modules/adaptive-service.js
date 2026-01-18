// Adaptive Learning Service
// Bilim darajasiga qarab testlar generatsiya qilish va boshqarish

import { auth, db } from '../firebase.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

export const AdaptiveService = {
    // Foydalanuvchi bilim darajasini olish
    async getUserKnowledgeLevel(uid, subjectId) {
        try {
            const snapshot = await get(ref(db, `users/${uid}/knowledgeLevels/${subjectId}`));
            return snapshot.exists() ? snapshot.val() : 'intermediate';
        } catch (e) {
            console.error('getUserKnowledgeLevel error:', e);
            return 'intermediate';
        }
    },

    // Barcha fan bo'yicha bilim darajalarini olish
    async getAllKnowledgeLevels(uid) {
        try {
            const snapshot = await get(ref(db, `users/${uid}/knowledgeLevels`));
            return snapshot.exists() ? snapshot.val() : {};
        } catch (e) {
            console.error('getAllKnowledgeLevels error:', e);
            return {};
        }
    },

    // Test natijasiga qarab darajani yangilash
    async updateKnowledgeLevel(uid, subjectId, testScore) {
        try {
            const currentLevel = await this.getUserKnowledgeLevel(uid, subjectId);
            let newLevel = currentLevel;

            // Qiyinchilik algoritmi
            if (testScore >= 80) {
                // Darajani oshirish
                if (currentLevel === 'beginner') newLevel = 'intermediate';
                else if (currentLevel === 'intermediate') newLevel = 'advanced';
            } else if (testScore < 50) {
                // Darajani pasaytirish
                if (currentLevel === 'advanced') newLevel = 'intermediate';
                else if (currentLevel === 'intermediate') newLevel = 'beginner';
            }
            // 50-79% orasida - daraja o'zgarmaydi

            if (newLevel !== currentLevel) {
                await update(ref(db), {
                    [`users/${uid}/knowledgeLevels/${subjectId}`]: newLevel,
                    [`users/${uid}/lastLevelUpdate`]: Date.now()
                });
                console.log(`Level updated: ${subjectId} ${currentLevel} -> ${newLevel}`);
            }

            return newLevel;
        } catch (e) {
            console.error('updateKnowledgeLevel error:', e);
            return 'intermediate';
        }
    },

    // Qiyinchilik darajasini hisoblash
    calculateDifficulty(knowledgeLevel, previousResults = []) {
        // Agar oxirgi 3 ta test 80%+ bo'lsa, qiyinlashtiriladi
        const recentHigh = previousResults.slice(-3).filter(r => r >= 80).length;
        const recentLow = previousResults.slice(-3).filter(r => r < 50).length;

        if (knowledgeLevel === 'beginner') {
            return recentHigh >= 2 ? 'intermediate' : 'beginner';
        } else if (knowledgeLevel === 'advanced') {
            return recentLow >= 2 ? 'intermediate' : 'advanced';
        }
        return knowledgeLevel;
    },

    // Token olish
    async getAuthToken() {
        const user = auth.currentUser;
        if (!user) return null;
        try {
            return await user.getIdToken();
        } catch (e) {
            console.error('getAuthToken error:', e);
            return null;
        }
    },

    // Adaptiv test generatsiya qilish
    async generateAdaptiveTest(subjectId, topicId, topicTitle, grade, knowledgeLevel) {
        const token = await this.getAuthToken();
        if (!token) {
            console.error('No auth token for adaptive test generation');
            return null;
        }

        try {
            const res = await fetch('/.netlify/functions/generateAdaptiveTest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    subjectId,
                    topicId,
                    topicTitle,
                    grade,
                    knowledgeLevel
                })
            });

            if (!res.ok) {
                const err = await res.json();
                console.error('Adaptive test error:', err);
                return null;
            }

            return await res.json();
        } catch (e) {
            console.error('generateAdaptiveTest error:', e);
            return null;
        }
    },

    // Orqa fonda test generatsiya qilish (Web Worker yoki setTimeout bilan)
    async backgroundGenerateTests(uid, subjects, grade) {
        console.log('[AdaptiveService] Starting background test generation...');

        const knowledgeLevels = await this.getAllKnowledgeLevels(uid);
        const token = await this.getAuthToken();

        if (!token) {
            console.warn('No auth token for background generation');
            return;
        }

        // Har bir fan uchun test generatsiya (ketma-ket, API limit uchun)
        for (const [subjectId, subject] of Object.entries(subjects)) {
            const level = knowledgeLevels[subjectId] || 'intermediate';

            // Mavjud adaptiv testni tekshirish
            const existingTest = await this.getAdaptiveTest(uid, subjectId, 'general', level);

            if (!existingTest) {
                console.log(`[AdaptiveService] Generating test for ${subjectId} (${level})...`);

                // Kechiktirish (API rate limit uchun)
                await new Promise(r => setTimeout(r, 2000));

                try {
                    await this.generateAdaptiveTest(
                        subjectId,
                        'general',
                        subject.name || subjectId,
                        grade,
                        level
                    );
                    console.log(`[AdaptiveService] Generated test for ${subjectId}`);
                } catch (e) {
                    console.error(`[AdaptiveService] Failed to generate test for ${subjectId}:`, e);
                }
            } else {
                console.log(`[AdaptiveService] Test already exists for ${subjectId} (${level})`);
            }
        }

        console.log('[AdaptiveService] Background generation complete');
    },

    // Foydalanuvchining adaptiv testini olish
    async getAdaptiveTest(uid, subjectId, topicId, level) {
        try {
            const testKey = `${subjectId}_${topicId || 'general'}_${level}`;
            const snapshot = await get(ref(db, `users/${uid}/adaptiveTests/${testKey}`));
            return snapshot.exists() ? snapshot.val() : null;
        } catch (e) {
            console.error('getAdaptiveTest error:', e);
            return null;
        }
    },

    // Barcha adaptiv testlarni olish
    async getAllAdaptiveTests(uid) {
        try {
            const snapshot = await get(ref(db, `users/${uid}/adaptiveTests`));
            return snapshot.exists() ? snapshot.val() : {};
        } catch (e) {
            console.error('getAllAdaptiveTests error:', e);
            return {};
        }
    },

    // Initial assessment natijalarini saqlash
    async saveInitialAssessment(uid, results) {
        try {
            // results: { "Matematika": { score: 75, level: "intermediate" }, ... }
            const knowledgeLevels = {};
            Object.entries(results).forEach(([subject, data]) => {
                knowledgeLevels[subject.toLowerCase().replace(/\s+/g, '_')] = data.level;
            });

            await update(ref(db), {
                [`users/${uid}/knowledgeLevels`]: knowledgeLevels,
                [`users/${uid}/initialAssessment`]: {
                    completedAt: Date.now(),
                    results
                }
            });

            console.log('[AdaptiveService] Initial assessment saved:', knowledgeLevels);
            return true;
        } catch (e) {
            console.error('saveInitialAssessment error:', e);
            return false;
        }
    },

    // Bilim darajasini hisoblash (test natijasiga qarab)
    calculateKnowledgeLevel(score) {
        if (score >= 80) return 'advanced';
        if (score >= 50) return 'intermediate';
        return 'beginner';
    }
};
