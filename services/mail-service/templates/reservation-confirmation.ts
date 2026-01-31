import { getBaseLayout } from './layout';

interface ReservationConfirmationData {
  userName: string;
  venueName: string;
  matchName: string;
  date: string;
  time: string;
  guests: number;
  bookingId?: string;
  address?: string;
}

export const getReservationConfirmationTemplate = (data: ReservationConfirmationData) => {
  const content = `
    <h1>Réservation Confirmée !</h1>
    <p>Bonjour <strong>${data.userName}</strong>,</p>
    <p>Votre réservation pour le match <strong>${data.matchName}</strong> chez <span class="accent">${data.venueName}</span> est confirmée.</p>
    
    <div class="ticket-container">
        <div class="mb-12">
            <strong class="label">Match</strong><br>
            <span style="font-size: 18px; font-weight: 600;">${data.matchName}</span>
        </div>
        <div class="mb-12">
            <strong class="label">Lieu</strong><br>
            <span style="font-size: 16px;">${data.venueName}</span>
            ${data.address ? `<br><span class="text-muted text-small">${data.address}</span>` : ''}
        </div>
        <div class="flex-between">
            <div>
                <strong class="label">Date & Heure</strong><br>
                <span style="font-size: 16px;">${data.date} à ${data.time}</span>
            </div>
            <div>
                <strong class="label">Invités</strong><br>
                <span style="font-size: 16px;">${data.guests} pers.</span>
            </div>
        </div>
        ${data.bookingId ? `
        <div class="mt-32 border-dashed" style="padding-top: 16px;">
            <strong class="label">Référence</strong><br>
            <span style="font-family: monospace; font-size: 16px; letter-spacing: 1px;">#${data.bookingId}</span>
        </div>` : ''}
    </div>

    <p>Pensez à arriver 15 minutes avant le début du match pour garantir votre table.</p>
    
    <div class="text-center my-32">
      <a href="https://match.app/bookings/${data.bookingId || ''}" class="button">Voir ma réservation</a>
    </div>
  `;
  
  return getBaseLayout(content, 'Confirmation de réservation - Match');
};
