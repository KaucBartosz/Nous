// src/modules/cryptoService.js

// =========================================================
// 1. LOCAL MACHINE ENCRYPTION (Data At Rest - IndexedDB)
// =========================================================

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
 * Encrypts an object or string for local DB storage.
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
 * Decrypts local DB data.
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


// =========================================================
// 2. CLOUD E2E ENCRYPTION (Firebase Sync)
// =========================================================

let cloudCryptoKey = null;

export function hasCloudKey() {
    return !!cloudCryptoKey;
}

export async function setCloudKeyFromHex(hexKey) {
    if (!hexKey) {
        throw new Error("Cloud encryption key is missing!");
    }
    const keyBytes = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    cloudCryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false, 
        ["encrypt", "decrypt"]
    );
    console.log("CryptoService: Cloud E2E Key loaded into RAM.");
}

export function clearCloudKey() {
    cloudCryptoKey = null;
}

export async function encryptCloudData(data) {
    if (!cloudCryptoKey) throw new Error("Cloud E2E Key not initialized!");
    const jsonString = JSON.stringify(data);
    const encodedData = new TextEncoder().encode(jsonString);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        cloudCryptoKey,
        encodedData
    );
    
    return {
        payload: await arrayBufferToBase64(encryptedBuffer),
        iv: await arrayBufferToBase64(iv.buffer)
    };
}

export async function decryptCloudData(encryptedBase64, ivBase64) {
    if (!cloudCryptoKey) throw new Error("Cloud E2E Key not initialized!");
    const encryptedBuffer = base64ToArrayBuffer(encryptedBase64);
    const iv = base64ToArrayBuffer(ivBase64);
    
    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            cloudCryptoKey,
            encryptedBuffer
        );
        const decodedString = new TextDecoder().decode(decryptedBuffer);
        return JSON.parse(decodedString);
    } catch (e) {
        console.error("Cloud Decryption failed:", e);
        throw new Error("Failed to decrypt cloud data. Invalid E2E Key or data corruption.");
    }
}


// =========================================================
// 3. SECURE KEY DERIVATION & WRAPPING (PIN SYSTEM)
// =========================================================

export function generateRandomHexKey(bytes = 32) {
    const array = new Uint8Array(bytes);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKeyFromPIN(pin, saltHex) {
    const encoder = new TextEncoder();
    const pinKeyMaterial = await window.crypto.subtle.importKey(
        "raw",
        encoder.encode(pin),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    const saltBytes = new Uint8Array(saltHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));

    return await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: saltBytes,
            iterations: 200000,
            hash: "SHA-256"
        },
        pinKeyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

export async function wrapCloudKey(hexKey, pin, saltHex) {
    const pinKey = await deriveKeyFromPIN(pin, saltHex);
    const encoder = new TextEncoder();
    const encodedKey = encoder.encode(hexKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        pinKey,
        encodedKey
    );

    return {
        encryptedKey: await arrayBufferToBase64(encryptedContent),
        iv: await arrayBufferToBase64(iv.buffer)
    };
}

export async function unwrapCloudKey(encryptedKeyBase64, ivBase64, pin, saltHex) {
    const pinKey = await deriveKeyFromPIN(pin, saltHex);
    const encryptedBuffer = base64ToArrayBuffer(encryptedKeyBase64);
    const iv = base64ToArrayBuffer(ivBase64);

    try {
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(iv) },
            pinKey,
            encryptedBuffer
        );
        return new TextDecoder().decode(decryptedBuffer);
    } catch (e) {
        throw new Error("Invalid PIN");
    }
}

export function formatRecoveryKey(hexKey) {
    return hexKey.match(/.{1,4}/g).join('-');
}

export function unformatRecoveryKey(formatted) {
    return formatted.replace(/-/g, '').toLowerCase();
}


// =========================================================
// 4. HELPERS
// =========================================================

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
