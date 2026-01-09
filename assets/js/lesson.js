import { auth, db } from './firebase.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const urlParams = new URLSearchParams(window.location.search);
const lessonId = parseInt(urlParams.get('lesson')) || 1;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        localStorage.removeItem("user");
        window.location.href = "login.html";
        return;
    }

    try {
        const subjectId = urlParams.get('subject') || 'math';

        const [lessonsRes, subjectsRes, dynLessonSnap] = await Promise.all([
            fetch('data/lessons.json'),
            fetch('data/subjects.json'),
            get(ref(db, `dynamic_lessons/${subjectId}/${lessonId}`))
        ]);

        let lessons = await lessonsRes.json();
        const subjects = await subjectsRes.json();

        // Merge dynamic lesson if it exists
        if (dynLessonSnap.exists()) {
            const dynLesson = dynLessonSnap.val();
            const idx = lessons.findIndex(l => l.id === lessonId && l.subjectId === subjectId);
            if (idx !== -1) lessons[idx] = dynLesson;
            else lessons.push(dynLesson);
        }

        const lesson = lessons.find(l => l.id === lessonId && l.subjectId === subjectId);
        const subject = subjects.find(s => s.id === subjectId);

        if (lesson && subject) {
            // Update back link with subject param
            const backLink = document.getElementById('backToPath');
            if (backLink) backLink.href = `path.html?subject=${subjectId}`;

            // Get user progress to check if passed
            const snapshot = await get(ref(db, `users/${user.uid}/progress/${subject.id}/${lessonId}`));
            const score = snapshot.val() || 0;

            // Binary progress: 100% if passed, 0% otherwise
            const progress = score >= 80 ? 100 : 0;
            renderLesson(lesson, progress);
        } else {
            // Fallback UI
            document.getElementById('lessonTitle').textContent = "Dars topilmadi";
            document.getElementById('lessonText').textContent = "Ushbu dars topilmadi yoki xato fanga tegishli. 🤷‍♂️";
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
    document.getElementById('lessonIcon').textContent = lesson.icon;

    const textContainer = document.getElementById('lessonText');
    textContainer.textContent = ''; // Clear

    const p = document.createElement('p');
    p.textContent = lesson.content;
    textContainer.appendChild(p);

    const exampleDiv = document.createElement('div');
    exampleDiv.className = "mt-8 p-6 bg-gray-50 rounded-2xl border border-gray-100 italic";

    const strong = document.createElement('strong');
    strong.textContent = "Misol: ";
    exampleDiv.appendChild(strong);

    const span = document.createElement('span');
    span.textContent = lesson.example;
    exampleDiv.appendChild(span);

    textContainer.appendChild(exampleDiv);

    document.getElementById('nextBtn').onclick = () => {
        const subjectId = urlParams.get('subject') || 'math';
        window.location.href = `test.html?subject=${subjectId}&lesson=${lesson.id}`;
    };
}
