export const AiService = {
    async generateTest(topic, subjectId, lessonId, token, force = false) {
        // Cooldown check (handled primarily by backend but good to have here too)
        const response = await fetch('/.netlify/functions/generateTest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ topic, subjectId, lessonId, force })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || `AI error: ${response.status}`);
        }

        return await response.json();
    }
};
