import { z } from "zod";

// ============================================
// VALIDATION SCHEMAS
// ============================================

export const HoldTableSchema = z.object({
    venueMatchId: z.string().uuid(),
    partySize: z.number().int().min(1).max(20),
    requiresAccessibility: z.boolean().optional().default(false),
});

export const ConfirmReservationSchema = z.object({
    holdId: z.string().uuid(),
    specialRequests: z.string().max(500).optional(),
});

export const CancelReservationSchema = z.object({
    reason: z.string().max(255).optional(),
});

export const VerifyQRSchema = z.object({
    qrContent: z.string().min(1),
});

// ============================================
// INTERFACES
// ============================================

export type HoldTableInput = z.infer<typeof HoldTableSchema>;
export type ConfirmReservationInput = z.infer<typeof ConfirmReservationSchema>;
export type CancelReservationInput = z.infer<typeof CancelReservationSchema>;
export type VerifyQRInput = z.infer<typeof VerifyQRSchema>;

export interface TableWithHoldStatus {
    id: string;
    name: string;
    capacity: number;
    isAccessible: boolean;
    status: 'available' | 'held' | 'reserved';
    holdExpiresAt?: string;
}
