import { getBaseLayout } from './layout';

interface WelcomeBackData {
  userName: string;
  role?: 'user' | 'venue_owner' | 'admin' | string;
  actionLink?: string;
}

export const getWelcomeBackTemplate = (data: WelcomeBackData) => {
  const isVenueOwner = data.role === 'venue_owner';
  const targetLink = data.actionLink || 'https://matchapp.fr/dashboard';
  const buttonLabel = isVenueOwner ? 'Accéder au tableau de bord' : 'Reprendre sur Match';

  const content = isVenueOwner
    ? `
      <h1>Bon retour sur Match Partner</h1>
      <p>Bonjour <strong>${data.userName}</strong>,</p>
      <p>Votre compte partenaire a bien été réactivé suite à votre reconnexion.</p>
      <p>Nous sommes ravis de vous retrouver. Vous pouvez reprendre la gestion de votre établissement dès maintenant.</p>
      <div class="text-center my-32">
        <a href="${targetLink}" class="button">${buttonLabel}</a>
      </div>
      <p>Besoin d'aide pour relancer votre activité sur la plateforme ? Contactez-nous à support@matchapp.fr.</p>
    `
    : `
      <h1>Bon retour sur Match</h1>
      <p>Bonjour <strong>${data.userName}</strong>,</p>
      <p>Votre compte a bien été réactivé suite à votre reconnexion.</p>
      <p>Nous sommes heureux de vous revoir parmi nous.</p>
      <p>Si vous avez des questions, contactez-nous à support@matchapp.fr.</p>
    `;

  return getBaseLayout(content, 'Bon retour sur Match');
};
