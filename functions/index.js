const functions = require('firebase-functions');
const axios = require('axios');

// Konfiguracja: firebase functions:config:set recaptcha.secret="TWÓJ_SECRET_KEY"

exports.verifyRecaptcha = functions.https.onCall(async (data, context) => {
    const { token, expectedAction } = data;
    const secretKey = functions.config().recaptcha.secret;

    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "token".');
    }

    if (!secretKey) {
        // Fallback for development/testing if config not set, BUT SHOULD BE SET
        console.error("Recaptcha Secret Key is NOT set in functions config!");
        throw new functions.https.HttpsError('failed-precondition', 'Server misconfiguration: missing recaptcha secret.');
    }

    try {
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`;

        const response = await axios.post(verificationUrl);
        const result = response.data;

        console.log("Recaptcha verification result:", result);

        if (!result.success) {
            throw new functions.https.HttpsError('permission-denied', `Recaptcha verification failed: ${result['error-codes']}`);
        }

        if (result.score < 0.5) {
            throw new functions.https.HttpsError('permission-denied', `Recaptcha low score: ${result.score}`);
        }

        if (expectedAction && result.action !== expectedAction) {
            throw new functions.https.HttpsError('permission-denied', `Recaptcha execution action mismatch: ${result.action}`);
        }

        return {
            success: true,
            score: result.score
        };

    } catch (error) {
        console.error("Recaptcha error:", error);
        // Re-throw if it's already an HttpsError
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Recaptcha verification internal error', error.message);
    }
});
