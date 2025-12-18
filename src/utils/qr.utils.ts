import QRCode from "qrcode";
import { createHmac } from "crypto";

/**
 * QR Code utilities for reservation check-in.
 * QR codes are signed with HMAC to prevent forgery.
 */

const QR_SECRET = process.env.QR_SECRET || "match-qr-secret-change-in-production";

export interface QRPayload {
    rid: string;  // Reservation ID
    uid: string;  // User ID
    mid: string;  // Venue Match ID
    tid: string;  // Table ID
    exp: number;  // Expiry timestamp (match start + buffer)
}

export interface SignedQRPayload extends QRPayload {
    sig: string;  // HMAC signature
}

/**
 * Generate HMAC signature for QR payload
 */
function generateSignature(payload: QRPayload): string {
    const data = `${payload.rid}:${payload.uid}:${payload.mid}:${payload.tid}:${payload.exp}`;
    return createHmac("sha256", QR_SECRET).update(data).digest("hex").slice(0, 16);
}

/**
 * Create a signed QR code payload
 */
export function createQRPayload(
    reservationId: string,
    userId: string,
    venueMatchId: string,
    tableId: string,
    matchStartTime: Date
): SignedQRPayload {
    // QR valid until 2 hours after match start
    const expiryBuffer = 2 * 60 * 60 * 1000; // 2 hours
    const exp = matchStartTime.getTime() + expiryBuffer;

    const payload: QRPayload = {
        rid: reservationId,
        uid: userId,
        mid: venueMatchId,
        tid: tableId,
        exp
    };

    return {
        ...payload,
        sig: generateSignature(payload)
    };
}

/**
 * Verify QR code signature and expiry
 */
export function verifyQRPayload(payload: SignedQRPayload): { valid: boolean; error?: string } {
    // Check expiry
    if (Date.now() > payload.exp) {
        return { valid: false, error: "QR code has expired" };
    }

    // Verify signature
    const expectedPayload: QRPayload = {
        rid: payload.rid,
        uid: payload.uid,
        mid: payload.mid,
        tid: payload.tid,
        exp: payload.exp
    };

    const expectedSig = generateSignature(expectedPayload);
    if (payload.sig !== expectedSig) {
        return { valid: false, error: "Invalid QR code signature" };
    }

    return { valid: true };
}

/**
 * Generate QR code as base64 data URL
 */
export async function generateQRCodeImage(payload: SignedQRPayload): Promise<string> {
    const jsonPayload = JSON.stringify(payload);
    return await QRCode.toDataURL(jsonPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 300
    });
}

/**
 * Parse QR code content back to payload
 */
export function parseQRContent(content: string): SignedQRPayload | null {
    try {
        return JSON.parse(content) as SignedQRPayload;
    } catch {
        return null;
    }
}
