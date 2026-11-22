/** AES-256-GCM 加解密：用于 API Key / 第三方凭证落库加密。 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { getSecret } from '../runtime-config';

function key(): Buffer {
  const hex = getSecret('keyEncryptionKey');
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('KEY_ENCRYPTION_KEY 必须是 32 字节的 64 位 hex');
  return Buffer.from(hex, 'hex');
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), authTag: authTag.toString('hex'), ciphertext: enc.toString('hex') });
}

export function decrypt(payload: string): string {
  const p = JSON.parse(payload);
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(p.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(p.authTag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(p.ciphertext, 'hex')), decipher.final()]).toString('utf8');
}

export function maskSecret(s: string): string {
  if (!s) return '';
  if (s.length <= 8) return '••••';
  return s.slice(0, 6) + '••••' + s.slice(-4);
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
