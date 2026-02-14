import { NotificationsRepository } from "../../repository/notifications.repository";
import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { venueMatchesTable } from "../../config/db/matches.table";
import { eq } from "drizzle-orm";

const notificationsRepository = new NotificationsRepository();

interface ReservationNotificationPayload {
    venueMatchId: string;
    reservationId: string;
    userId: string;
    partySize: number;
    status: string;
}

interface CancellationNotificationPayload {
    venueMatchId: string;
    reservationId: string;
    userId: string;
    partySize: number;
    reason?: string;
}

/**
 * Helper to resolve the venue owner from a venue_match ID.
 */
async function getVenueOwnerFromMatch(venueMatchId: string) {
    const result = await db.select({
        ownerId: venuesTable.owner_id,
        venueName: venuesTable.name,
    })
    .from(venueMatchesTable)
    .innerJoin(venuesTable, eq(venueMatchesTable.venue_id, venuesTable.id))
    .where(eq(venueMatchesTable.id, venueMatchId))
    .limit(1);

    const first = result[0];
    return first ?? null;
}

/**
 * Notify the venue owner about a new reservation, and the user about confirmation.
 */
export async function notifyNewReservation(payload: ReservationNotificationPayload) {
    const venueInfo = await getVenueOwnerFromMatch(payload.venueMatchId);

    // Notify the customer
    const isConfirmed = payload.status === 'confirmed';
    await notificationsRepository.create({
        user_id: payload.userId,
        type: 'reservation_confirmed',
        title: isConfirmed ? 'Réservation confirmée' : 'Réservation en attente',
        message: isConfirmed
            ? `Votre réservation pour ${payload.partySize} personne(s) à ${venueInfo?.venueName ?? 'un bar'} a été confirmée.`
            : `Votre demande de réservation pour ${payload.partySize} personne(s) à ${venueInfo?.venueName ?? 'un bar'} est en attente de confirmation.`,
        related_entity_type: 'reservation',
        related_entity_id: payload.reservationId,
        send_push: true,
    });

    // Notify the venue owner (if found)
    if (venueInfo?.ownerId) {
        await notificationsRepository.create({
            user_id: venueInfo.ownerId,
            type: 'reservation_confirmed',
            title: 'Nouvelle réservation',
            message: `Nouvelle réservation de ${payload.partySize} personne(s) pour ${venueInfo.venueName}.`,
            related_entity_type: 'reservation',
            related_entity_id: payload.reservationId,
            send_push: true,
        });
    }
}

/**
 * Notify the venue owner and user about a cancelled reservation.
 */
export async function notifyReservationCancelled(payload: CancellationNotificationPayload) {
    const venueInfo = await getVenueOwnerFromMatch(payload.venueMatchId);

    // Notify the customer
    await notificationsRepository.create({
        user_id: payload.userId,
        type: 'reservation_canceled',
        title: 'Réservation annulée',
        message: `Votre réservation pour ${payload.partySize} personne(s) à ${venueInfo?.venueName ?? 'un bar'} a été annulée.${payload.reason ? ` Raison : ${payload.reason}` : ''}`,
        related_entity_type: 'reservation',
        related_entity_id: payload.reservationId,
        send_push: true,
    });

    // Notify the venue owner (if found)
    if (venueInfo?.ownerId) {
        await notificationsRepository.create({
            user_id: venueInfo.ownerId,
            type: 'reservation_canceled',
            title: 'Réservation annulée',
            message: `Une réservation de ${payload.partySize} personne(s) pour ${venueInfo.venueName} a été annulée.${payload.reason ? ` Raison : ${payload.reason}` : ''}`,
            related_entity_type: 'reservation',
            related_entity_id: payload.reservationId,
            send_push: true,
        });
    }
}
