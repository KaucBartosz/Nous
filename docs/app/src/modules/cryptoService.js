// src/modules/cryptoService.js

let cryptoKey = null;

/**
 * Initialize the crypto service with the master key from the main process.
 * @param {string} hexKey - The 32-byte master key in hex string format.
 */
export async function initCrypto(hexKey) {
    if (!hexKey) {
        throw new Error("Encryption key is missing!");
    }

    // Convert hex string to Uint8Array
    const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

    // Import key for AES-GCM
    cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false, // not extractable
        ["encrypt", "decrypt"]
    );
    console.log("CryptoService: Key initialized successfully.");
}

/**
 * Encrypts an object or string.
 * @param {any} data - Data to encrypt.
 * @returns {Promise<{payload: string, iv: string}>} - Base64 encoded payload and IV.
 */
export async function encryptData(data) {
    if (!cryptoKey) throw new Error("CryptoService not initialized!");

    const jsonString = JSON.stringify(data);
    const encodedData = new TextEncoder().encode(jsonString);

    // Generate random IV (12 bytes for GCM)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        cryptoKey,
        encodedData
    );

    return {
        payload: await arrayBufferToBase64(encryptedBuffer),
        iv: await arrayBufferToBase64(iv.buffer)
    };
}

/**
 * Decrypts data.
 * @param {string} encryptedBase64 
 * @param {string} ivBase64 
 * @returns {Promise<any>} - The original data object.
 */
export async function decryptData(encryptedBase64, ivBase64) {
    if (!cryptoKey) throw new Error("CryptoService not initialized!");

    const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: new Uint8Array(iv)
            },
            cryptoKey,
            encryptedBuffer
        );

        const decodedString = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decodedString);
    } catch (e) {
        console.error("Decryption failed:", e);
        throw new Error("Failed to decrypt data. Key mismatch or data corruption.");
    }
}

// Helpers

/**
 * Zoptymalizowana konwersja ArrayBuffer do Base64 przy użyciu Bloba.
 * Zapobiega zawieszaniu UI i błędów stosu przy bardzo dużych wynikach testów.
 */
function arrayBufferToBase64(buffer) {
    return new Promise((resolve) => {
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            resolve(dataUrl.split(',')[1]);
        };
        reader.readAsDataURL(blob);
    });
}

function base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}
