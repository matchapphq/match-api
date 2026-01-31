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
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.resetLink}" class="button">Réinitialiser mon mot de passe</a>
    </div>
    <p style="font-size: 14px; color: #6b7280; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe restera inchangé.
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Ce lien est valide pour <strong>1 heure</strong>.
    </p>
  `;
  
  return getBaseLayout(content, 'Réinitialisation de mot de passe - Match');
};
