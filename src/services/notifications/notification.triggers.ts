import { NotificationsRepository } from "../../repository/notifications.repository";
import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { venueMatchesTable } from "../../config/db/matches.table";
import { usersTable } from "../../config/db/user.table";
import { eq } from "drizzle-orm";

const notificationsRepo = new NotificationsRepository();

/**
 * Notification type constants matching the DB enum
 */
export const NotificationTypes = {
    RESERVATION_CONFIRMED: 'reservation_confirmed',
    RESERVATION_CANCELED: 'reservation_canceled',
    RESERVATION_REMINDER: 'reservation_reminder',
    MATCH_STARTING: 'match_starting',
    REVIEW_RESPONSE: 'review_response',
    SUBSCRIPTION_EXPIRING: 'subscription_expiring',
    PAYMENT_FAILED: 'payment_failed',
    PROMOTIONAL: 'promotional',
    SYSTEM: 'system',
    MATCH_NEARBY: 'match_nearby',
    VENUE_NEARBY: 'venue_nearby',
} as const;

type NotificationType = typeof NotificationTypes[keyof typeof NotificationTypes];

/**
 * Helper to get venue owner ID from venue match
 */
async function getVenueOwnerFromVenueMatch(venueMatchId: string): Promise<{ 
    ownerId: string | null; 
    venueName: string | null;
    matchInfo: string | null;
}> {
    const result = await db.select({
        ownerId: venuesTable.owner_id,
        venueName: venuesTable.name,
    })
    .from(venueMatchesTable)
    .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
    .where(eq(venueMatchesTable.id, venueMatchId))
    .limit(1);

    const first = result[0];
    if (!first) {
        return { ownerId: null, venueName: null, matchInfo: null };
    }

    return {
        ownerId: first.ownerId,
        venueName: first.venueName,
        matchInfo: null
    };
}

/**
 * Get user info for notification message
 */
async function getUserInfo(userId: string): Promise<{ name: string; email: string } | null> {
    const user = await db.select({
        firstName: usersTable.first_name,
        lastName: usersTable.last_name,
        email: usersTable.email,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

    const first = user[0];
    if (!first) return null;

    return {
        name: `${first.firstName || ''} ${first.lastName || ''}`.trim() || 'Client',
        email: first.email
    };
}

/**
 * Trigger notification when a new reservation is created
 * Notifies the venue owner
 */
export async function notifyNewReservation(params: {
    venueMatchId: string;
    reservationId: string;
    userId: string;
    partySize: number;
    status: 'pending' | 'confirmed';
}) {
    const { venueMatchId, reservationId, userId, partySize, status } = params;

    console.log(`[Notifications] notifyNewReservation called with:`, {
        venueMatchId,
        reservationId,
        userId,
        partySize,
        status
    });

    try {
        // Get venue owner
        const { ownerId, venueName } = await getVenueOwnerFromVenueMatch(venueMatchId);
        console.log(`[Notifications] Venue owner lookup result:`, { ownerId, venueName });
        
        if (!ownerId) {
            console.warn(`[Notifications] No owner found for venueMatch ${venueMatchId}`);
            return null;
        }

        // Get user info
        const userInfo = await getUserInfo(userId);
        const userName = userInfo?.name || 'Un client';
        console.log(`[Notifications] User info:`, { userName, userInfo });

        // Create notification for venue owner
        const notification = await notificationsRepo.create({
            user_id: ownerId,
            type: NotificationTypes.RESERVATION_CONFIRMED,
            title: status === 'pending' 
                ? '📋 Nouvelle demande de réservation'
                : '🎉 Nouvelle réservation confirmée',
            message: `${userName} a réservé pour ${partySize} personne${partySize > 1 ? 's' : ''}${venueName ? ` chez ${venueName}` : ''}.`,
            related_entity_type: 'reservation',
            related_entity_id: reservationId,
            send_push: true,
            send_email: false, // Email can be enabled based on user preferences
        });

        console.log(`[Notifications] Created reservation notification:`, notification);
        return notification;
    } catch (error) {
        console.error('[Notifications] Error creating reservation notification:', error);
        return null;
    }
}

/**
 * Trigger notification when a reservation is cancelled
 */
export async function notifyReservationCancelled(params: {
    venueMatchId: string;
    reservationId: string;
    userId: string;
    partySize: number;
    reason?: string;
}) {
    const { venueMatchId, reservationId, userId, partySize, reason } = params;

    try {
        const { ownerId, venueName } = await getVenueOwnerFromVenueMatch(venueMatchId);
        if (!ownerId) return null;

        const userInfo = await getUserInfo(userId);
        const userName = userInfo?.name || 'Un client';

        const notification = await notificationsRepo.create({
            user_id: ownerId,
            type: NotificationTypes.RESERVATION_CANCELED,
            title: '❌ Réservation annulée',
            message: `${userName} a annulé sa réservation pour ${partySize} personne${partySize > 1 ? 's' : ''}.${reason ? ` Raison: ${reason}` : ''}`,
            related_entity_type: 'reservation',
            related_entity_id: reservationId,
            send_push: true,
        });

        return notification;
    } catch (error) {
        console.error('[Notifications] Error creating cancellation notification:', error);
        return null;
    }
}

/**
 * Trigger notification when a guest checks in
 */
export async function notifyCheckIn(params: {
    venueMatchId: string;
    reservationId: string;
    userId: string;
    partySize: number;
}) {
    const { venueMatchId, reservationId, userId, partySize } = params;

    try {
        const { ownerId } = await getVenueOwnerFromVenueMatch(venueMatchId);
        if (!ownerId) return null;

        const userInfo = await getUserInfo(userId);
        const userName = userInfo?.name || 'Un client';

        const notification = await notificationsRepo.create({
            user_id: ownerId,
            type: NotificationTypes.SYSTEM,
            title: '✅ Client arrivé',
            message: `${userName} (${partySize} pers.) vient d'arriver et a été enregistré.`,
            related_entity_type: 'reservation',
            related_entity_id: reservationId,
            send_push: true,
        });

        return notification;
    } catch (error) {
        console.error('[Notifications] Error creating check-in notification:', error);
        return null;
    }
}

/**
 * Create a generic system notification
 */
export async function createSystemNotification(params: {
    userId: string;
    title: string;
    message: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
}) {
    try {
        return await notificationsRepo.create({
            user_id: params.userId,
            type: NotificationTypes.SYSTEM,
            title: params.title,
            message: params.message,
            related_entity_type: params.relatedEntityType,
            related_entity_id: params.relatedEntityId,
        });
    } catch (error) {
        console.error('[Notifications] Error creating system notification:', error);
        return null;
    }
}
