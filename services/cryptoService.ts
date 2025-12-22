
export class CryptoService {
  private static async getPasswordKey(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    return window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
  }

  private static async deriveKey(passwordKey: CryptoKey, salt: Uint8Array): Promise<CryptoKey> {
    return window.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256"
      },
      passwordKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  static async encrypt(text: string, password: string): Promise<string> {
    try {
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      const passwordKey = await this.getPasswordKey(password);
      const aesKey = await this.deriveKey(passwordKey, salt);
      
      const enc = new TextEncoder();
      const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        enc.encode(text)
      );

      // Combine salt + iv + ciphertext
      const buffer = new Uint8Array(salt.byteLength + iv.byteLength + encryptedContent.byteLength);
      buffer.set(salt, 0);
      buffer.set(iv, salt.byteLength);
      buffer.set(new Uint8Array(encryptedContent), salt.byteLength + iv.byteLength);

      return this.arrayBufferToBase64(buffer);
    } catch (e) {
      console.error("Encryption failed", e);
      throw new Error("Encryption failed");
    }
  }

  static async decrypt(encryptedBase64: string, password: string): Promise<string> {
    try {
      const buffer = this.base64ToArrayBuffer(encryptedBase64);
      
      const salt = buffer.slice(0, 16);
      const iv = buffer.slice(16, 28);
      const data = buffer.slice(28);

      const passwordKey = await this.getPasswordKey(password);
      const aesKey = await this.deriveKey(passwordKey, salt);

      const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        data
      );

      const dec = new TextDecoder();
      return dec.decode(decryptedContent);
    } catch (e) {
      console.error("Decryption failed. Wrong password?", e);
      throw new Error("Decryption failed. Check your password.");
    }
  }

  private static arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private static base64ToArrayBuffer(base64: string): Uint8Array {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }
}
