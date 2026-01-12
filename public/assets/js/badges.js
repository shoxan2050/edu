/**
 * badges.js - Gamification System
 * Badges: Olmoschi (7 day streak), Mukammal (100% score), Chempion (weekly top)
 */

import { db } from './firebase.js';
import { ref, get, set, update, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { showToast } from './auth.js';

// Badge definitions
export const BADGES = {
    olmoschi: {
        id: 'olmoschi',
        name: 'Olmoschi',
        icon: '💎',
        description: '7 kun ketma-ket o\'qish',
        condition: (user) => user.streak >= 7
    },
    mukammal: {
        id: 'mukammal',
        name: 'Mukammal',
        icon: '⭐',
        description: '100% natija olish',
        condition: (user, testResult) => testResult === 100
    },
    chempion: {
        id: 'chempion',
        name: 'Haftalik Chempion',
        icon: '🏆',
        description: 'Haftalik eng yuqori ball',
        condition: null // Checked separately
    },
    birinchi_qadam: {
        id: 'birinchi_qadam',
        name: 'Birinchi Qadam',
        icon: '🚀',
        description: 'Birinchi testni topshirish',
        condition: (user) => true // First test completion
    },
    otgan: {
        id: 'otgan',
        name: 'O\'tkazilmagan',
        icon: '🔥',
        description: '3 kun ketma-ket streak',
        condition: (user) => user.streak >= 3
    }
};

// Check and award badges
export async function checkBadges(userId, context = {}) {
    const userRef = ref(db, `users/${userId}`);
    const snap = await get(userRef);

    if (!snap.exists()) return [];

    const userData = snap.val();
    const currentBadges = userData.badges || {};
    const newBadges = [];

    for (const [id, badge] of Object.entries(BADGES)) {
        if (currentBadges[id]) continue; // Already has badge
        if (!badge.condition) continue; // Special conditions

        const earned = badge.condition(userData, context.testResult);

        if (earned) {
            newBadges.push(badge);
            await update(ref(db, `users/${userId}/badges`), {
                [id]: {
                    earnedAt: Date.now(),
                    name: badge.name,
                    icon: badge.icon
                }
            });
        }
    }

    return newBadges;
}

// Show badge earned notification
export function showBadgeEarned(badge) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-yellow-400 to-amber-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-top duration-500';
    toast.innerHTML = `
        <span class="text-4xl">${badge.icon}</span>
        <div>
            <div class="font-bold text-lg">Yangi Badge!</div>
            <div class="text-amber-100">${badge.name}</div>
        </div>
    `;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('animate-out', 'slide-out-to-top');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

// Get weekly leaderboard
export async function getWeeklyLeaderboard(sinf = null) {
    const usersSnap = await get(ref(db, 'users'));
    if (!usersSnap.exists()) return [];

    const users = usersSnap.val();
    const now = Date.now();
    const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Calculate weekly scores
    const leaderboard = [];

    for (const [uid, user] of Object.entries(users)) {
        if (user.role !== 'student') continue;
        if (sinf && user.sinf !== sinf) continue;

        // Get test results from this week
        const resultsSnap = await get(ref(db, `testResults/${uid}`));
        let weeklyScore = 0;
        let testCount = 0;

        if (resultsSnap.exists()) {
            const results = resultsSnap.val();
            for (const subjectResults of Object.values(results)) {
                for (const result of Object.values(subjectResults)) {
                    if (result.timestamp && result.timestamp >= weekAgo) {
                        weeklyScore += result.score || 0;
                        testCount++;
                    }
                }
            }
        }

        if (testCount > 0) {
            leaderboard.push({
                uid,
                name: user.name,
                sinf: user.sinf,
                avgScore: Math.round(weeklyScore / testCount),
                testCount,
                streak: user.streak || 0,
                badges: user.badges || {}
            });
        }
    }

    // Sort by average score
    return leaderboard.sort((a, b) => b.avgScore - a.avgScore);
}

// Award weekly champion badge
export async function checkWeeklyChampion() {
    const leaderboard = await getWeeklyLeaderboard();

    if (leaderboard.length === 0) return null;

    const champion = leaderboard[0];

    // Check if already has champion badge this week
    const now = new Date();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());

    const userSnap = await get(ref(db, `users/${champion.uid}/badges/chempion`));
    if (userSnap.exists()) {
        const earnedAt = userSnap.val().earnedAt;
        if (earnedAt >= weekStart.getTime()) {
            return null; // Already champion this week
        }
    }

    // Award champion badge
    await update(ref(db, `users/${champion.uid}/badges`), {
        chempion: {
            earnedAt: Date.now(),
            name: 'Haftalik Chempion',
            icon: '🏆',
            weekOf: weekStart.toISOString()
        }
    });

    return champion;
}

// Get user badges
export async function getUserBadges(userId) {
    const snap = await get(ref(db, `users/${userId}/badges`));
    return snap.exists() ? snap.val() : {};
}

// Render badges in UI
export function renderBadges(badges, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const badgeArray = Object.entries(badges);

    if (badgeArray.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <span class="text-3xl">🎖️</span>
                <p class="mt-2">Hali badgelar yo'q</p>
            </div>
        `;
        return;
    }

    container.innerHTML = badgeArray.map(([id, badge]) => `
        <div class="bg-gradient-to-br from-yellow-50 to-amber-100 p-4 rounded-2xl border border-amber-200 text-center">
            <span class="text-4xl">${badge.icon}</span>
            <div class="font-bold text-gray-900 mt-2">${badge.name}</div>
            <div class="text-xs text-amber-600">${new Date(badge.earnedAt).toLocaleDateString('uz')}</div>
        </div>
    `).join('');
}

// Render leaderboard
export function renderLeaderboard(leaderboard, containerId, limit = 10) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const topUsers = leaderboard.slice(0, limit);

    if (topUsers.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-8">Hali ma\'lumot yo\'q</div>';
        return;
    }

    container.innerHTML = topUsers.map((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
        const bgClass = idx === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-amber-200' :
            idx === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-100 border-gray-200' :
                idx === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200' : 'bg-white';

        return `
            <div class="flex items-center gap-4 p-4 rounded-2xl border ${bgClass}">
                <span class="text-2xl w-10 text-center">${medal}</span>
                <div class="flex-grow">
                    <div class="font-bold text-gray-900">${user.name}</div>
                    <div class="text-sm text-gray-500">${user.sinf}-sinf • ${user.testCount} test • 🔥 ${user.streak}</div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-indigo-600">${user.avgScore}%</div>
                </div>
            </div>
        `;
    }).join('');
}
