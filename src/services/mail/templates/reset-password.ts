import { getBaseLayout } from './layout';

interface ResetPasswordData {
  code: string;
  userName?: string;
  firstName?: string;
}

export const getResetPasswordTemplate = (data: ResetPasswordData) => {
  const name = data.userName || data.firstName;
  const content = `
    <h1>Réinitialisation de mot de passe</h1>
    <p>Bonjour${name ? ` <strong>${name}</strong>` : ''},</p>
    <p>Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte <strong>Match</strong>.</p>
    <p>Si vous êtes à l'origine de cette demande, utilisez le code de vérification suivant pour réinitialiser votre mot de passe :</p>
    
    <div class="text-center my-32">
      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 24px; display: inline-block; border: 1px solid #e5e7eb;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #5a03cf;">${data.code}</span>
      </div>
    </div>

    <p class="text-muted border-top mt-32">
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe restera inchangé.
    </p>
    <p class="text-muted">
      Ce code est valide pour <strong>15 minutes</strong>.
    </p>
  `;
  
  return getBaseLayout(content, 'Réinitialisation de mot de passe - Match');
};
