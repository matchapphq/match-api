import { NotificationsRepository } from "../../repository/notifications.repository";
import UserRepository from "../../repository/user.repository";
import { pushNotificationService } from "../push-notification.service";
import { db } from "../../config/config.db";
import { venuesTable } from "../../config/db/venues.table";
import { venueMatchesTable } from "../../config/db/matches.table";
import { eq } from "drizzle-orm";

const notificationsRepository = new NotificationsRepository();
const userRepository = new UserRepository();

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
    const message = isConfirmed
        ? `Votre réservation pour ${payload.partySize} personne(s) à ${venueInfo?.venueName ?? 'un bar'} a été confirmée.`
        : `Votre demande de réservation pour ${payload.partySize} personne(s) à ${venueInfo?.venueName ?? 'un bar'} est en attente de confirmation.`;
    const title = isConfirmed ? 'Réservation confirmée' : 'Réservation en attente';

    await notificationsRepository.create({
        user_id: payload.userId,
        type: 'reservation_confirmed',
        title,
        message,
        related_entity_type: 'reservation',
        related_entity_id: payload.reservationId,
        send_push: true,
    });

    const user = await userRepository.getUserById(payload.userId);
    if (user?.push_token) {
        await pushNotificationService.sendToUser(user.push_token, title, message, {
            type: 'reservation_confirmed',
            reservationId: payload.reservationId
        });
    }

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
        
        const owner = await userRepository.getUserById(venueInfo.ownerId);
        if (owner?.push_token) {
            await pushNotificationService.sendToUser(owner.push_token, 'Nouvelle réservation', `Nouvelle réservation de ${payload.partySize} personne(s) pour ${venueInfo.venueName}.`, {
                type: 'reservation_new',
                reservationId: payload.reservationId
            });
        }
    }
}

/**
 * Notify the venue owner and user about a cancelled reservation.
 */
export async function notifyReservationCancelled(payload: CancellationNotificationPayload) {
    const venueInfo = await getVenueOwnerFromMatch(payload.venueMatchId);
    const message = `Votre réservation pour ${payload.partySize} personne(s) à ${venueInfo?.venueName ?? 'un bar'} a été annulée.${payload.reason ? ` Raison : ${payload.reason}` : ''}`;
    const title = 'Réservation annulée';

    // Notify the customer
    await notificationsRepository.create({
        user_id: payload.userId,
        type: 'reservation_canceled',
        title,
        message,
        related_entity_type: 'reservation',
        related_entity_id: payload.reservationId,
        send_push: true,
    });

    const user = await userRepository.getUserById(payload.userId);
    if (user?.push_token) {
        await pushNotificationService.sendToUser(user.push_token, title, message, {
            type: 'reservation_canceled',
            reservationId: payload.reservationId
        });
    }

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

        const owner = await userRepository.getUserById(venueInfo.ownerId);
        if (owner?.push_token) {
            await pushNotificationService.sendToUser(owner.push_token, 'Réservation annulée', `Une réservation de ${payload.partySize} personne(s) pour ${venueInfo.venueName} a été annulée.`, {
                type: 'reservation_canceled',
                reservationId: payload.reservationId
            });
        }
    }
}
