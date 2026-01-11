import { auth, db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const lessonId = parseInt(urlParams.get('lesson')) || 1;
const subjectId = urlParams.get('subject') || 'math';

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = "login.html";
        return;
    }

    try {
        // Fetch specific Lesson from Firebase (Single Source of Truth)
        const lessonSnap = await get(ref(db, `subjects/${subjectId}/lessons/${lessonId}`));

        if (lessonSnap.exists()) {
            const lesson = lessonSnap.val();
            lesson.id = lessonId; // Ensure ID is present

            // Get user progress for this specific lesson
            const progressSnap = await get(ref(db, `users/${user.uid}/progress/${subjectId}/${lessonId}`));
            const score = progressSnap.val() || 0;
            const progressPercent = score >= 80 ? 100 : 0;

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
});

function renderLesson(lesson, progress) {
    if (!lesson) return;

    document.getElementById('lessonProgress').style.width = `${progress}%`;
    document.getElementById('lessonTitle').textContent = lesson.title;
    document.getElementById('lessonIcon').textContent = lesson.icon || "📚";

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
        window.location.href = `test.html?subject=${subjectId}&lesson=${lesson.id}`;
    };
}
