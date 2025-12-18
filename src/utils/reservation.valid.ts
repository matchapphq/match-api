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
});

// ============================================
// INTERFACES
// ============================================

export type HoldTableInput = z.infer<typeof HoldTableSchema>;
export type ConfirmReservationInput = z.infer<typeof ConfirmReservationSchema>;

export interface TableWithHoldStatus {
    id: string;
    name: string;
    capacity: number;
    isAccessible: boolean;
    status: 'available' | 'held' | 'reserved';
    holdExpiresAt?: string;
}
