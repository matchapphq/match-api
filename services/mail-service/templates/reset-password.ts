import { getBaseLayout } from './layout';

interface ResetPasswordData {
  resetLink: string;
  userName?: string;
}

export const getResetPasswordTemplate = (data: ResetPasswordData) => {
  const content = `
    <h1>Réinitialisation de mot de passe</h1>
    <p>Bonjour${data.userName ? ` <strong>${data.userName}</strong>` : ''},</p>
    <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte <strong>Match</strong>.</p>
    <p>Si vous êtes à l'origine de cette demande, vous pouvez définir un nouveau mot de passe en cliquant sur le bouton ci-dessous :</p>
    <div class="text-center my-32">
      <a href="${data.resetLink}" class="button">Réinitialiser mon mot de passe</a>
    </div>
    <p class="text-muted border-top mt-32">
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe restera inchangé.
    </p>
    <p class="text-muted">
      Ce lien est valide pour <strong>1 heure</strong>.
    </p>
  `;
  
  return getBaseLayout(content, 'Réinitialisation de mot de passe - Match');
};
