import { auth, db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('subject') || 'math';

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = "login.html";
        return;
    }

    try {
        const [subjectsRes, lessonsRes, dynSubjsSnap, dynLessonsSnap] = await Promise.all([
            fetch('data/subjects.json'),
            fetch('data/lessons.json'),
            get(ref(db, 'dynamic_subjects')),
            get(ref(db, 'dynamic_lessons'))
        ]);

        let subjects = await subjectsRes.json();
        let allLessons = await lessonsRes.json();

        // Merge dynamic subjects
        if (dynSubjsSnap.exists()) {
            const dynamicSubjects = dynSubjsSnap.val();
            Object.keys(dynamicSubjects).forEach(id => {
                const existingIdx = subjects.findIndex(s => s.id === id);
                if (existingIdx !== -1) {
                    subjects[existingIdx].path = dynamicSubjects[id].path;
                } else {
                    subjects.push({ id, ...dynamicSubjects[id] });
                }
            });
        }

        // Merge dynamic lessons
        if (dynLessonsSnap.exists()) {
            const dynamicLessons = dynLessonsSnap.val();
            Object.values(dynamicLessons).forEach(subjLessons => {
                Object.values(subjLessons).forEach(lesson => {
                    const existingIdx = allLessons.findIndex(l => l.id === lesson.id && l.subjectId === lesson.subjectId);
                    if (existingIdx !== -1) {
                        allLessons[existingIdx] = lesson;
                    } else {
                        allLessons.push(lesson);
                    }
                });
            });
        }

        const subject = subjects.find(s => s.id === subjectId);

        if (!subject) {
            document.getElementById('subjectTitle').textContent = "Fan topilmadi";
            document.getElementById('pathContainer').innerHTML = `
                <div class="col-span-full py-20 text-center">
                    <p class="text-xl text-gray-500 mb-6">Ushbu fan topilmadi yoki hali qo'shilmagan. 🤷‍♂️</p>
                    <a href="dashboard.html" class="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold transition shadow-lg shadow-indigo-200">
                        Bosh sahifaga qaytish
                    </a>
                </div>
            `;
            return;
        }

        const subjectLessons = subject.path.map(id => allLessons.find(l => l.id === id)).filter(Boolean);

        // Get user progress to unlock nodes
        const snapshot = await get(ref(db, `users/${user.uid}`));
        const userData = snapshot.val() || {};
        const progress = userData.progress || {};

        renderPath(subject, subjectLessons, progress);
    } catch (e) {
        console.error("Path load error", e);
    }
});

function renderPath(subject, lessons, userProgress) {
    const container = document.getElementById('pathContainer');
    document.getElementById('subjectTitle').textContent = subject ? subject.name : "Fan Yo'li";

    const subjectProgress = userProgress[subjectId] || {};

    container.innerHTML = lessons.map((lesson, index) => {
        const marginClass = index % 2 === 0 ? 'ml-0' : (index % 4 === 1 ? 'ml-20' : 'mr-20');

        // Logic for status
        let status = 'locked';
        const prevLessonId = index > 0 ? lessons[index - 1].id : null;
        const prevLessonProgress = prevLessonId ? (subjectProgress[prevLessonId] || 0) : 100;

        if (index === 0 || prevLessonProgress >= 80) {
            status = (subjectProgress[lesson.id] || 0) >= 80 ? 'completed' : 'active';
        }

        return `
            <div class="path-node flex flex-col items-center ${marginClass} cursor-pointer" 
                 data-id="${lesson.id}" 
                 data-status="${status}" 
                 data-title="${lesson.title}" 
                 data-desc="${(lesson.content || '').substring(0, 100)}..." 
                 data-icon="${lesson.icon}">
                <div class="node-circle ${getNodeStatusClass(status)}">
                    ${status === 'locked' ? '🔒' : lesson.icon}
                </div>
                <p class="mt-3 font-semibold text-gray-700">${lesson.title}</p>
            </div>
        `;
    }).join('');

    // Event delegation for nodes
    container.onclick = (e) => {
        const node = e.target.closest('.path-node');
        if (!node) return;

        const { id, status, title, desc, icon } = node.dataset;
        handleNodeClick(parseInt(id), status, title, desc, icon);
    };
}

function getNodeStatusClass(status) {
    if (status === 'completed') return 'node-completed';
    if (status === 'active') return 'node-active';
    return 'node-locked';
}

function handleNodeClick(id, status, title, desc, icon) {
    if (status === 'locked') {
        const toast = document.createElement('div');
        toast.className = "fixed bottom-5 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-xl animate-bounce";
        toast.textContent = "Bu dars hali yopiq! 🔒";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
        return;
    }

    const modal = document.getElementById('lessonModal');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalDesc').textContent = desc;
    document.getElementById('modalIcon').textContent = icon;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('startLessonBtn').onclick = () => {
        window.location.href = `lesson.html?subject=${subjectId}&lesson=${id}`;
    };
}

document.getElementById('closeModalBtn').onclick = () => {
    const modal = document.getElementById('lessonModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
};
