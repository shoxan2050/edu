/**
 * Netlify Serverless Function: Send Visitor Log to Telegram
 * Uses environment variables BOT_TOKEN and CHAT_ID
 */

exports.handler = async (event) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get environment variables
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const CHAT_ID = process.env.CHAT_ID;

    if (!BOT_TOKEN || !CHAT_ID) {
        console.error('Missing BOT_TOKEN or CHAT_ID environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Server configuration error' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const messages = body.messages;

        if (!messages || !Array.isArray(messages)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid request body' })
            };
        }

        // Send each message to Telegram
        for (const text of messages) {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: CHAT_ID,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
            // Small delay between messages
            await new Promise(r => setTimeout(r, 300));
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to send message' })
        };
    }
};
