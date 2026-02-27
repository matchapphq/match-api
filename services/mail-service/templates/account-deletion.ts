import { getBaseLayout } from './layout';

interface AccountDeletionData {
  userName: string;
  role?: 'user' | 'venue_owner' | 'admin' | string;
  graceDays?: number;
  reactivationDeadline?: string;
}

export const getAccountDeletionTemplate = (data: AccountDeletionData) => {
  const graceDays = Number.isFinite(data.graceDays) && (data.graceDays as number) > 0
    ? Math.floor(data.graceDays as number)
    : 30;
  const deadlineDate = data.reactivationDeadline
    ? new Date(data.reactivationDeadline)
    : new Date(Date.now() + graceDays * 24 * 60 * 60 * 1000);
  const deadlineLabel = Number.isNaN(deadlineDate.getTime())
    ? `dans ${graceDays} jours`
    : deadlineDate.toLocaleDateString('fr-FR', { dateStyle: 'long' });
  const isVenueOwner = data.role === 'venue_owner';

  const content = isVenueOwner
    ? `
      <h1>Compte partenaire désactivé</h1>
      <p>Bonjour <strong>${data.userName}</strong>,</p>
      <p>Votre compte partenaire <strong>Match</strong> a bien été désactivé à votre demande.</p>
      <p>Vos données (établissement, paramètres, historique lié au compte) sont conservées pendant <strong>${graceDays} jours</strong>.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="color: #991b1b; margin-bottom: 8px; font-size: 14px;">
              <strong>Suppression définitive :</strong> vos données seront supprimées automatiquement après le <strong>${deadlineLabel}</strong>.
          </p>
          <p style="color: #991b1b; margin-bottom: 0; font-size: 14px;">
              Si vous changez d'avis, reconnectez-vous simplement avant cette date pour réactiver votre compte.
          </p>
      </div>
      <p>Merci d'avoir utilisé Match partenaire.</p>
      <p>L'équipe Match</p>
    `
    : `
      <h1>Compte désactivé</h1>
      <p>Bonjour <strong>${data.userName}</strong>,</p>
      <p>Votre compte <strong>Match</strong> a bien été désactivé à votre demande.</p>
      <p>Vos données sont conservées pendant <strong>${graceDays} jours</strong>.</p>
      <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="color: #991b1b; margin-bottom: 8px; font-size: 14px;">
              <strong>Suppression définitive :</strong> vos données seront supprimées automatiquement après le <strong>${deadlineLabel}</strong>.
          </p>
          <p style="color: #991b1b; margin-bottom: 0; font-size: 14px;">
              Si vous changez d'avis, reconnectez-vous simplement avant cette date pour réactiver votre compte.
          </p>
      </div>
      <p>Merci d'avoir fait partie de l'aventure Match.</p>
      <p>L'équipe Match</p>
    `;
  
  return getBaseLayout(content, 'Compte désactivé - Match');
};
