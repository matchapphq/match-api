import { getBaseLayout } from './layout';

interface VenuePaymentSuccessData {
  userName: string;
  venueName: string;
  amount: string;
  planName: string;
  date: string;
  invoiceUrl?: string;
}

export const getVenuePaymentSuccessTemplate = (data: VenuePaymentSuccessData) => {
  const content = `
    <h1>Paiement Confirmé</h1>
    <p>Bonjour <strong>${data.userName}</strong>,</p>
    <p>Nous vous confirmons la réception de votre paiement pour l'établissement <strong>${data.venueName}</strong>.</p>
    
    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0;">Détails de la transaction</h3>
      <ul style="list-style: none; padding: 0;">
        <li style="margin-bottom: 10px;"><strong>Date :</strong> ${data.date}</li>
        <li style="margin-bottom: 10px;"><strong>Formule :</strong> ${data.planName}</li>
        <li style="margin-bottom: 10px;"><strong>Montant :</strong> ${data.amount}</li>
      </ul>
    </div>

    <p>Votre établissement est maintenant actif et visible par les utilisateurs de Match.</p>
    
    ${data.invoiceUrl ? `
    <div class="text-center my-32">
      <a href="${data.invoiceUrl}" class="button">Télécharger la facture</a>
    </div>
    ` : ''}
    
    <p>Merci de votre confiance.</p>
    <p>L'équipe Match</p>
  `;
  
  return getBaseLayout(content, 'Confirmation de paiement - Match');
};
