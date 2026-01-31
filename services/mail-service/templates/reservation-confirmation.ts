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
    
    <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
        <div style="margin-bottom: 12px;">
            <strong style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Match</strong><br>
            <span style="font-size: 18px; font-weight: 600;">${data.matchName}</span>
        </div>
        <div style="margin-bottom: 12px;">
            <strong style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Lieu</strong><br>
            <span style="font-size: 16px;">${data.venueName}</span>
            ${data.address ? `<br><span style="font-size: 14px; color: #64748b;">${data.address}</span>` : ''}
        </div>
        <div style="display: flex; justify-content: space-between;">
            <div>
                <strong style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date & Heure</strong><br>
                <span style="font-size: 16px;">${data.date} à ${data.time}</span>
            </div>
            <div>
                <strong style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Invités</strong><br>
                <span style="font-size: 16px;">${data.guests} pers.</span>
            </div>
        </div>
        ${data.bookingId ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed #cbd5e1;">
            <strong style="color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Référence</strong><br>
            <span style="font-family: monospace; font-size: 16px; letter-spacing: 1px;">#${data.bookingId}</span>
        </div>` : ''}
    </div>

    <p>Pensez à arriver 15 minutes avant le début du match pour garantir votre table.</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="https://match.app/bookings/${data.bookingId || ''}" class="button">Voir ma réservation</a>
    </div>
  `;
  
  return getBaseLayout(content, 'Confirmation de réservation - Match');
};
