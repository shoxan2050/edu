import { auth, db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { DbService } from './modules/db-service.js';
import { showToast } from './auth.js';

const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('subject');
const container = document.getElementById('pathContainer');

const init = async (user) => {
    if (!user) return;

    // Loading State
    if (container) {
        container.innerHTML = `
            <div class="col-span-full py-20 flex flex-col items-center gap-4">
                <div class="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                <p class="text-gray-400 font-medium">Yo'l xaritasi tayyorlanmoqda...</p>
            </div>
        `;
    }

    try {
        const userData = await DbService.getUser(user.uid);
        if (!userData) {
            showToast("Profil topilmadi! ❌", 'error');
            return;
        }

        const userClass = parseInt(userData.sinf) || 0;

        // If no subject selected, show subject list
        if (!subjectId) {
            document.getElementById('subjectTitle').textContent = "Fanni tanlang";
            const subjectsObj = await DbService.getSubjectsByClass(userClass);

            // Convert object to array
            const subjects = Object.entries(subjectsObj || {}).map(([id, s]) => ({ id, ...s }));

            if (subjects.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full py-20 text-center">
                        <p class="text-xl text-gray-500 mb-6">Hali fanlar qo'shilmagan. 📚</p>
                        <a href="/dashboard" class="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold transition shadow-lg shadow-indigo-200">
                            Dashboard ga qaytish
                        </a>
                    </div>
                `;
                return;
            }

            // Show subject selection
            container.innerHTML = `
                <div class="w-full max-w-md space-y-4">
                    <p class="text-center text-gray-500 mb-8">Qaysi fanni o'rganmoqchisiz?</p>
                    ${subjects.map(s => `
                        <a href="/path?subject=${s.id}" 
                           class="block p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-500 hover:shadow-lg transition">
                            <div class="flex items-center gap-4">
                                <span class="text-4xl">${s.icon || '📚'}</span>
                                <div>
                                    <h3 class="text-lg font-bold text-gray-900">${s.name}</h3>
                                    <p class="text-sm text-gray-500">${Object.keys(s.lessons || {}).length} mavzu</p>
                                </div>
                            </div>
                        </a>
                    `).join('')}
                </div>
            `;
            return;
        }

        // Load specific subject
        const subjSnap = await get(ref(db, `subjects/${subjectId}`));

        if (!subjSnap.exists()) {
            document.getElementById('subjectTitle').textContent = "Fan topilmadi";
            container.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <p class="text-xl text-gray-500 mb-6">Ushbu fan topilmadi. 🤷‍♂️</p>
                    <a href="/path" class="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold transition shadow-lg shadow-indigo-200">
                        Fanlar ro'yxatiga qaytish
                    </a>
                </div>
            `;
            return;
        }

        const subject = subjSnap.val();
        document.getElementById('subjectTitle').textContent = subject.name;

        const userProgress = userData.progress || {};

        // Use the 'path' array defined by the teacher as the source of truth for ordering
        const lessonsObj = subject.lessons || {};
        const pathOrder = subject.path || [];

        // Build sorted and filtered list
        const studentLessons = [];
        pathOrder.forEach(uuid => {
            const lesson = lessonsObj[uuid];
            if (lesson) {
                // If lesson has a sinf assigned, check if it matches student class
                if (!lesson.sinf || lesson.sinf === userClass) {
                    studentLessons.push(lesson);
                }
            }
        });

        // If path is empty, just use all lessons
        if (studentLessons.length === 0) {
            Object.values(lessonsObj).forEach(lesson => {
                if (!lesson.sinf || lesson.sinf === userClass) {
                    studentLessons.push(lesson);
                }
            });
            // Sort by order
            studentLessons.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        renderPath(subjectId, studentLessons, userProgress);
    } catch (error) {
        console.error("Path load error", error);
        showToast("Xarita yuklashda xatolik! ❌", 'error');
    }
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

function renderPath(subjId, lessons, userProgress) {
    if (!container) return;

    if (lessons.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center">
                <p class="text-xl text-gray-500 mb-6">Hali darslar yo'q. 📖</p>
                <a href="/path" class="px-8 py-4 bg-gray-200 text-gray-600 rounded-2xl font-bold transition">
                    Orqaga
                </a>
            </div>
        `;
        return;
    }

    const subjectProgress = userProgress[subjId] || {};

    // Calculate overall progress
    let completedCount = 0;
    lessons.forEach(lesson => {
        if ((subjectProgress[lesson.id] || 0) >= 70) completedCount++;
    });
    const overallProgress = Math.round((completedCount / lessons.length) * 100);

    // Progress header
    let html = `
        <div class="w-full max-w-md mb-8 p-6 bg-white rounded-3xl shadow-sm border border-gray-100">
            <div class="flex items-center justify-between mb-4">
                <span class="text-gray-500">Umumiy progress</span>
                <span class="text-2xl font-bold text-indigo-600">${overallProgress}%</span>
            </div>
            <div class="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-600 rounded-full transition-all duration-1000" style="width: ${overallProgress}%"></div>
            </div>
            <div class="text-sm text-gray-400 mt-2">${completedCount}/${lessons.length} mavzu tugatildi</div>
        </div>
    `;

    html += lessons.map((lesson, index) => {
        const score = subjectProgress[lesson.id] || 0;
        const prevLessonId = index > 0 ? lessons[index - 1].id : null;
        const prevScore = prevLessonId ? subjectProgress[prevLessonId] : 100;

        let status = 'locked';
        if (score >= 70) status = 'completed';
        else if (index === 0 || (prevScore !== undefined && prevScore >= 70)) status = 'current';

        // Zigzag pattern
        const marginClass = index % 2 === 0 ? 'ml-0' : (index % 4 === 1 ? 'sm:ml-20 ml-10' : (index % 4 === 3 ? 'sm:-ml-20 -ml-10' : 'ml-0'));

        return `
            <div class="path-node flex flex-col items-center ${marginClass} cursor-pointer group" 
                 data-id="${lesson.id}" 
                 data-status="${status}">
                <div class="node-circle ${getNodeStatusClass(status)} relative">
                    ${status === 'locked' ? '🔒' : (lesson.icon || '📚')}
                    ${status === 'completed' ? `
                        <div class="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-white">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                        </div>
                    ` : ''}
                    ${score > 0 && score < 70 ? `
                        <div class="absolute -bottom-1 -right-1 bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full border-2 border-white">${score}%</div>
                    ` : ''}
                </div>
                <div class="mt-3 text-center transition group-hover:scale-105">
                    <span class="text-sm font-bold text-gray-700 block">${lesson.title}</span>
                    <span class="text-xs text-gray-400 uppercase tracking-tighter">
                        ${status === 'completed' ? `✅ ${score}%` : (status === 'locked' ? '🔒 Qulflangan' : '▶️ Boshlash')}
                    </span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;

    container.onclick = (e) => {
        const node = e.target.closest('.path-node');
        if (!node) return;

        const id = node.dataset.id;
        const status = node.dataset.status;

        if (status === 'locked') {
            showToast("Ushbu dars qulflangan! Oldingi darsni 70% dan yuqori yakunlang. 🔒", 'error');
            return;
        }

        window.location.href = `/test?subject=${subjId}&lesson=${id}`;
    };
}

function getNodeStatusClass(status) {
    switch (status) {
        case 'completed': return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200';
        case 'current': return 'bg-indigo-600 text-white border-indigo-700 shadow-xl scale-110 ring-4 ring-indigo-100';
        default: return 'bg-white text-gray-300 border-gray-200 opacity-60 grayscale';
    }
}
