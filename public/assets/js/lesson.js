import { db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { DbService } from './modules/db-service.js';
import { showToast } from './auth.js';

const urlParams = new URLSearchParams(window.location.search);
const lessonId = urlParams.get('lesson'); // UUID String
const subjectId = urlParams.get('subject') || 'math';

const init = async (user) => {
    try {
        const [lessonSnap, userData] = await Promise.all([
            get(ref(db, `subjects/${subjectId}/lessons/${lessonId}`)),
            DbService.getUser(user.uid)
        ]);

        if (lessonSnap.exists()) {
            const lesson = lessonSnap.val();
            // lesson.id = lessonId; // Already present in UUID architecture

            const userProgress = userData?.progress || {};
            const score = userProgress[subjectId]?.[lessonId] || 0;
            const progressPercent = score; // Show actual percentage

            renderLesson(lesson, progressPercent);

            // Update back link
            const backLink = document.getElementById('backToPath');
            if (backLink) backLink.href = `path.html?subject=${subjectId}`;
        } else {
            // Fallback UI
            document.getElementById('lessonTitle').textContent = "Dars topilmadi";
            document.getElementById('lessonText').textContent = "Ushbu dars topilmadi yoki hali yuklanmagan. 🤷‍♂️";
            document.getElementById('lessonIcon').textContent = "❌";
            document.getElementById('interactiveArea').classList.add('hidden');
            const nextBtn = document.getElementById('nextBtn');
            nextBtn.textContent = "Bosh sahifaga qaytish";
            nextBtn.onclick = () => window.location.href = 'dashboard.html';
        }
    } catch (e) {
        console.error("Lesson load error", e);
    }
};

if (window.__AUTH_USER__) {
    init(window.__AUTH_USER__);
} else {
    document.addEventListener('authReady', (e) => init(e.detail));
}

function renderLesson(lesson, progress) {
    if (!lesson) return;

    document.getElementById('lessonProgress').style.width = `${progress}%`;
    document.getElementById('lessonTitle').textContent = lesson.title;
    document.getElementById('lessonIcon').textContent = lesson.icon || "📚";
    document.getElementById('lessonHomework').textContent = lesson.homework || "Vazifa yo'q";

    // AI Content Rendering
    const contentDiv = document.getElementById('lessonContent');
    if (lesson.content) {
        // Secure Rendering (XSS Protection)
        contentDiv.textContent = lesson.content;
        contentDiv.style.whiteSpace = "pre-wrap"; // Preserve formatting
        contentDiv.classList.remove('hidden');
    } else {
        contentDiv.classList.add('hidden');
    }

    const textContainer = document.getElementById('lessonText');
    textContainer.textContent = ''; // Clear existing

    const p = document.createElement('p');
    p.textContent = `Mavzu: ${lesson.title}`;
    p.className = "text-xl font-bold mb-4";
    textContainer.appendChild(p);

    const homeworkDiv = document.createElement('div');
    homeworkDiv.className = "mt-8 p-6 bg-indigo-50 rounded-2xl border border-indigo-100 italic";

    const strong = document.createElement('strong');
    strong.textContent = "Vazifa: ";
    homeworkDiv.appendChild(strong);

    const span = document.createElement('span');
    span.textContent = lesson.homework || "Hali vazifa qo'shilmagan.";
    homeworkDiv.appendChild(span);

    textContainer.appendChild(homeworkDiv);

    document.getElementById('nextBtn').onclick = () => {
        window.location.href = `test.html?subject=${subjectId}&lesson=${lessonId}`;
    };
}
