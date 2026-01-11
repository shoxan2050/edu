import { auth } from './firebase.js';
import { logout, showToast } from './auth.js';
import { DbService } from './modules/db-service.js';

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
        }
    } catch (error) {
        console.error("Dashboard error", error);
        showToast("Ma'lumotlarni yuklashda xatolik yuz berdi ❌", 'error');
    }
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
