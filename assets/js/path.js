import { auth, db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { showToast } from './auth.js';

const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('subject') || 'math';
const container = document.getElementById('pathContainer');

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        return;
    }

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
        const [subjSnap, userSnap] = await Promise.all([
            get(ref(db, `subjects/${subjectId}`)),
            get(ref(db, `users/${user.uid}`))
        ]);

        if (!subjSnap.exists()) {
            document.getElementById('subjectTitle').textContent = "Fan topilmadi";
            container.innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <p class="text-xl text-gray-500 mb-6">Ushbu fan hali qo'shilmagan. 🤷‍♂️</p>
                    <a href="dashboard.html" class="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold transition shadow-lg shadow-indigo-200">
                        Bosh sahifaga qaytish
                    </a>
                </div>
            `;
            return;
        }

        const subject = subjSnap.val();
        document.getElementById('subjectTitle').textContent = subject.name;

        const userData = userSnap.exists() ? userSnap.val() : {};
        const userProgress = userData.progress || {};
        const userClass = parseInt(userData.sinf) || 0;

        // Use the 'path' array defined by the teacher as the source of truth for ordering
        const lessonsObj = subject.lessons || {};
        const pathOrder = subject.path || [];

        // Build sorted and filtered list
        const studentLessons = [];
        pathOrder.forEach(uuid => {
            const lesson = lessonsObj[uuid];
            if (lesson) {
                // If lesson has a sinf assigned, check if it matches student class
                // Or if it has no sinf (legacy), include it
                if (!lesson.sinf || lesson.sinf === userClass) {
                    studentLessons.push(lesson);
                }
            }
        });

        renderPath(subjectId, studentLessons, userProgress);
    } catch (error) {
        console.error("Path load error", error);
        showToast("Xarita yuklashda xatolik! ❌", 'error');
    }
});

function renderPath(subjId, lessons, userProgress) {
    if (!container) return;

    if (lessons.length === 0) {
        container.innerHTML = `<div class="col-span-full py-20 text-center text-gray-400">Hali darslar yo'q.</div>`;
        return;
    }

    const subjectProgress = userProgress[subjId] || {};

    container.innerHTML = lessons.map((lesson, index) => {
        const score = subjectProgress[lesson.id] || 0;
        const prevLessonId = index > 0 ? lessons[index - 1].id : null;
        const prevScore = prevLessonId ? subjectProgress[prevLessonId] : 100;

        let status = 'locked';
        if (score >= 80) status = 'completed';
        else if (index === 0 || prevScore >= 80) status = 'current';

        const marginClass = index % 2 === 0 ? 'ml-0' : (index % 4 === 1 ? 'ml-24' : (index % 4 === 3 ? '-ml-24' : 'ml-0'));

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
                </div>
                <div class="mt-3 text-center transition group-hover:scale-105">
                    <span class="text-sm font-bold text-gray-700 block">${lesson.title}</span>
                    <span class="text-xs text-gray-400 uppercase tracking-tighter">${status === 'completed' ? 'Tugatildi' : (status === 'locked' ? 'Bekulangan' : 'Boshlash')}</span>
                </div>
            </div>
        `;
    }).join('');

    container.onclick = (e) => {
        const node = e.target.closest('.path-node');
        if (!node) return;

        const id = node.dataset.id;
        const status = node.dataset.status;

        if (status === 'locked') {
            showToast("Ushbu dars qulflangan! Oldingi darsni 80% dan yuqori yakunlang. 🔒", 'error');
            return;
        }

        window.location.href = `lesson.html?subject=${subjId}&lesson=${id}`;
    };
}

function getNodeStatusClass(status) {
    switch (status) {
        case 'completed': return 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-200';
        case 'current': return 'bg-indigo-600 text-white border-indigo-700 shadow-xl scale-110 ring-4 ring-indigo-100';
        default: return 'bg-white text-gray-300 border-gray-200 opacity-60 grayscale';
    }
}
