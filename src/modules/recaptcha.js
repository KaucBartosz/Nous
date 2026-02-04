// src/modules/recaptcha.js
// reCAPTCHA v3 - Darmowe do 10,000 weryfikacji/miesiąc
// Dokumentacja: https://developers.google.com/recaptcha/docs/v3

// WAŻNE: Aby włączyć reCAPTCHA:
// 1. Zarejestruj się na: https://www.google.com/recaptcha/admin
// 2. Wybierz reCAPTCHA v3
// 3. Dodaj domenę (dla Electron użyj: localhost)
// 4. Wklej SITE_KEY poniżej
// 5. SECRET_KEY użyj w Cloud Functions do weryfikacji

const RECAPTCHA_SITE_KEY = '6LcGbmAsAAAAANONNS0csIA_MB5ePSLplsbuob6R'; // Wpisz swój Site Key tutaj
const RECAPTCHA_ENABLED = RECAPTCHA_SITE_KEY.length > 0;

let isRecaptchaLoaded = false;

/**
 * Ładuje skrypt reCAPTCHA v3 jeśli skonfigurowany
 */
export async function loadRecaptcha() {
    if (!RECAPTCHA_ENABLED) {
        console.log('reCAPTCHA: Nie skonfigurowano (brak SITE_KEY)');
        return false;
    }

    if (isRecaptchaLoaded) return true;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            isRecaptchaLoaded = true;
            console.log('reCAPTCHA: Załadowano pomyślnie');
            resolve(true);
        };

        script.onerror = (e) => {
            console.error('reCAPTCHA: Błąd ładowania', e);
            reject(new Error('Nie udało się załadować reCAPTCHA'));
        };

        document.head.appendChild(script);
    });
}

/**
 * Pobiera token reCAPTCHA dla danej akcji
 * @param {string} action - Nazwa akcji (np. 'register', 'login')
 * @returns {Promise<string|null>} - Token lub null jeśli wyłączono
 */
export async function getRecaptchaToken(action = 'submit') {
    if (!RECAPTCHA_ENABLED) {
        return null; // reCAPTCHA wyłączona
    }

    if (!isRecaptchaLoaded) {
        await loadRecaptcha();
    }

    return new Promise((resolve, reject) => {
        if (typeof grecaptcha === 'undefined') {
            reject(new Error('reCAPTCHA nie załadowana'));
            return;
        }

        grecaptcha.ready(() => {
            grecaptcha.execute(RECAPTCHA_SITE_KEY, { action })
                .then(token => {
                    console.log(`reCAPTCHA: Token wygenerowany dla akcji '${action}'`);
                    resolve(token);
                })
                .catch(err => {
                    console.error('reCAPTCHA: Błąd generowania tokenu', err);
                    reject(err);
                });
        });
    });
}

/**
 * Sprawdza czy reCAPTCHA jest włączona
 */
export function isRecaptchaEnabled() {
    return RECAPTCHA_ENABLED;
}

/**
 * Weryfikuje token po stronie serwera (do użycia w Cloud Functions)
 * 
 * PRZYKŁAD CLOUD FUNCTION:
 * 
 * const functions = require('firebase-functions');
 * const fetch = require('node-fetch');
 * 
 * exports.verifyRecaptcha = functions.https.onCall(async (data, context) => {
 *     const { token, expectedAction } = data;
 *     const secretKey = functions.config().recaptcha.secret;
 *     
 *     const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
 *         body: `secret=${secretKey}&response=${token}`
 *     });
 *     
 *     const result = await response.json();
 *     
 *     if (!result.success || result.score < 0.5 || result.action !== expectedAction) {
 *         throw new functions.https.HttpsError('permission-denied', 'reCAPTCHA verification failed');
 *     }
 *     
 *     return { success: true, score: result.score };
 * });
 */
