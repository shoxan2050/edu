import { auth } from './firebase.js';
import { logout, showToast } from './auth.js';
import { DbService } from './modules/db-service.js';
import { AdaptiveService } from './modules/adaptive-service.js';
import { getUserBadges, renderBadges, getWeeklyLeaderboard, renderLeaderboard } from './badges.js';

const list = document.getElementById('subjectsList');

// Initial Loading State
list.innerHTML = `
            <div class="col-span-full space-y-4">
                ${[1, 2, 3].map(() => `
                    <div class="animate-pulse bg-white p-6 rounded-3xl border border-gray-100 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="w-14 h-14 bg-gray-100 rounded-2xl"></div>
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-100 rounded w-32"></div>
                                <div class="h-3 bg-gray-50 rounded w-24"></div>
                            </div>
                        </div>
                        <div class="w-24 h-6 bg-gray-100 rounded-full"></div>
                    </div>
                `).join('')}
            </div>
        `;

// Auth Handler Pattern
const init = async (user) => {
    if (!user) return;
    try {
        const userData = await DbService.getUser(user.uid);
        if (userData) {
            // Re-sync localStorage (Treat as cache only)
            localStorage.setItem("user", JSON.stringify({
                uid: user.uid,
                email: user.email,
                ...userData
            }));

            // Update UI
            document.getElementById('userName').textContent = userData.name;
            document.getElementById('welcomeName').textContent = userData.name;
            document.getElementById('streakCount').textContent = userData.streak || 0;

            // Show teacher link if user is teacher
            if (userData.role === 'teacher') {
                document.getElementById('teacherLink')?.classList.remove('hidden');
                document.getElementById('profileTeacher')?.classList.remove('hidden');
            }

            // Show school info if user has selected a school
            if (userData.maktab) {
                const schoolInfo = document.getElementById('schoolInfo');
                const schoolName = document.getElementById('schoolName');
                if (schoolInfo && schoolName) {
                    schoolName.textContent = `${userData.maktab} (${userData.tuman || ''})`;
                    schoolInfo.classList.remove('hidden');
                }
            }

            const userClass = parseInt(userData.sinf) || 0;
            const subjects = await DbService.getSubjectsByClass(userClass);
            const userProgress = userData.progress || {};

            // Calculate overall progress accurately across ALL subjects the user is enrolled in
            let totalPercent = 0;
            let activeSubjectsCount = 0;

            Object.keys(subjects).forEach(subjId => {
                const subjectProgress = userProgress[subjId] || {};
                const lessonPercents = Object.values(subjectProgress);
                if (lessonPercents.length > 0) {
                    const subjAvg = lessonPercents.reduce((a, b) => a + b, 0) / lessonPercents.length;
                    totalPercent += subjAvg;
                    activeSubjectsCount++;
                }
            });
            const avgProgress = activeSubjectsCount > 0 ? Math.round(totalPercent / activeSubjectsCount) : 0;

            document.getElementById('progressText').textContent = avgProgress;
            const circle = document.getElementById('progressCircle');
            if (circle) {
                const r = circle.getAttribute('r') || 40;
                const circumference = 2 * Math.PI * r;
                circle.style.strokeDasharray = `${circumference} ${circumference}`;
                const offset = circumference - (avgProgress / 100) * circumference;
                circle.style.strokeDashoffset = offset;
            }

            // Filtering by Class
            const filteredSubjects = {};

            Object.keys(subjects).forEach(id => {
                const s = subjects[id];
                // If the subject has classes and includes user's class, or if it has NO classes defined (backward compat)
                if (!s.classes || s.classes.includes(userClass)) {
                    filteredSubjects[id] = s;
                }
            });

            renderSubjects(filteredSubjects, userProgress);

            // Load available tests for student
            loadAvailableTests(user.uid, userClass);

            // Trigger background adaptive test generation
            triggerBackgroundGeneration(user, userData, filteredSubjects, userClass);
        }
    } catch (error) {
        console.error("Dashboard error", error);
        showToast("Ma'lumotlarni yuklashda xatolik yuz berdi ❌", 'error');
    }
};

// Background adaptive test generation
async function triggerBackgroundGeneration(user, userData, subjects, grade) {
    try {
        console.log('[Dashboard] Triggering background test generation...');

        // Only generate if user has few adaptive tests
        const existingTests = await AdaptiveService.getAllAdaptiveTests(user.uid);
        const testCount = Object.keys(existingTests).length;

        if (testCount < 10) {
            // Generate tests in background (non-blocking)
            setTimeout(() => {
                AdaptiveService.backgroundGenerateTests(user.uid, subjects, grade);
            }, 3000); // Delay 3 seconds to let dashboard load first
        } else {
            console.log('[Dashboard] Sufficient adaptive tests exist, skipping generation');
        }
    } catch (e) {
        console.error('[Dashboard] Background generation error:', e);
    }
}


// Load Available Tests
async function loadAvailableTests(uid, classNum) {
    const container = document.getElementById('availableTests');
    if (!container) return;

    try {
        const tests = await DbService.getTestsForStudent(uid, classNum);

        if (!tests || tests.length === 0) {
            container.innerHTML = `
                <div class="col-span-full p-8 text-center text-gray-400 bg-white rounded-2xl border border-gray-100">
                    <div class="text-4xl mb-2">📝</div>
                    <p>Hozircha testlar yo'q</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tests.map(test => `
            <div class="p-5 bg-white rounded-2xl border border-gray-100 hover:shadow-lg transition-all duration-200">
                <div class="flex items-start justify-between mb-3">
                    <div>
                        <h4 class="font-bold text-gray-900 text-lg">${test.lessonTitle}</h4>
                        <p class="text-sm text-gray-500">${test.subjectName}</p>
                    </div>
                    ${test.completed ?
                `<span class="px-2 py-1 bg-green-100 text-green-600 rounded-lg text-xs font-bold">✅ ${test.score}%</span>` :
                `<span class="px-2 py-1 bg-amber-100 text-amber-600 rounded-lg text-xs font-bold">📋 ${test.questions?.length || 5} savol</span>`
            }
                </div>
                <button onclick="startTest('${test.subjectId}', '${test.lessonId}')" 
                    class="w-full py-3 ${test.completed ? 'bg-gray-100 text-gray-600' : 'bg-indigo-600 text-white'} rounded-xl font-bold hover:opacity-90 transition">
                    ${test.completed ? '🔄 Qayta topshirish' : '🚀 Testni boshlash'}
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error("Load tests error:", error);
        container.innerHTML = `<div class="col-span-full text-center text-red-500 p-4">Testlarni yuklashda xatolik</div>`;
    }
}

// Start Test
window.startTest = function (subjectId, lessonId) {
    window.location.href = `/test?subject=${subjectId}&lesson=${lessonId}`;
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

function renderSubjects(subjects, userProgress) {
    if (!list) return;

    if (Object.keys(subjects).length === 0) {
        list.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <div class="text-6xl mb-6">📚</div>
                <h3 class="text-2xl font-bold text-gray-900 mb-2">Hali fanlar yo'q</h3>
                <p class="text-gray-500">O'qituvchi darslarni yuklashini kuting.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = Object.keys(subjects).map(id => {
        const s = subjects[id];
        const subjectProgress = userProgress[id] || {};
        const lessonPercents = Object.values(subjectProgress);
        const progress = lessonPercents.length > 0 ? Math.round(lessonPercents.reduce((a, b) => a + b, 0) / lessonPercents.length) : 0;
        const completedCount = lessonPercents.filter(p => p >= 80).length;

        return `
            <a href="/path?subject=${id}" class="bg-white p-6 rounded-3xl border border-gray-100 hover:shadow-xl transition flex items-center justify-between group">
                <div class="flex items-center gap-4">
                    <div class="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition">
                        ${s.icon || '📚'}
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-900">${s.name}</h3>
                        <p class="text-gray-500 text-sm">${completedCount} dars tugatildi</p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-lg font-bold text-indigo-600">${progress}%</div>
                    <div class="w-20 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div class="h-full bg-indigo-600 rounded-full transition-all duration-1000" style="width: ${progress}%"></div>
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1">${progress >= 70 ? '✅ Pass' : '❌ Fail'}</div>
                </div>
            </a>
        `;
    }).join('');
}

// Profile dropdown
const profileBtn = document.getElementById('profileBtn');
const profileDropdown = document.getElementById('profileDropdown');
if (profileBtn && profileDropdown) {
    profileBtn.onclick = () => profileDropdown.classList.toggle('hidden');
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#profileBtn') && !e.target.closest('#profileDropdown')) {
            profileDropdown.classList.add('hidden');
        }
    });
}

const profileLogout = document.getElementById('profileLogout');
if (profileLogout) profileLogout.onclick = logout;

// Load badges and leaderboard when auth is ready
async function loadBadgesAndLeaderboard(user, userClass) {
    try {
        // Load user badges
        const badges = await getUserBadges(user.uid);
        if (Object.keys(badges).length > 0) {
            const container = document.getElementById('badgesContainer');
            if (container) {
                container.innerHTML = Object.entries(badges).map(([id, badge]) => `
                    <div class="bg-gradient-to-br from-yellow-50 to-amber-100 p-6 rounded-2xl border border-amber-200 text-center">
                        <span class="text-4xl">${badge.icon}</span>
                        <div class="text-sm font-bold text-gray-900 mt-2">${badge.name}</div>
                        <div class="text-xs text-amber-600">${new Date(badge.earnedAt).toLocaleDateString('uz')}</div>
                    </div>
                `).join('');
            }
        }

        // Load leaderboard
        const leaderboard = await getWeeklyLeaderboard(userClass);
        renderLeaderboard(leaderboard, 'leaderboardContainer', 5);
    } catch (e) {
        console.error('Badges/Leaderboard error:', e);
    }
}

// Call after user data is loaded
document.addEventListener('authReady', async (e) => {
    const user = e.detail;
    if (user) {
        const userData = await DbService.getUser(user.uid);
        const userClass = parseInt(userData?.sinf) || 0;
        loadBadgesAndLeaderboard(user, userClass);
    }
});
