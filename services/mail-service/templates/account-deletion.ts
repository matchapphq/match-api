import { getBaseLayout } from './layout';

interface AccountDeletionData {
  userName: string;
}

export const getAccountDeletionTemplate = (data: AccountDeletionData) => {
  const content = `
    <h1>Compte supprimé avec succès</h1>
    <p>Bonjour <strong>${data.userName}</strong>,</p>
    <p>Nous vous confirmons que votre compte <strong>Match</strong> a été supprimé définitivement, conformément à votre demande.</p>
    <p>Toutes vos données personnelles, historiques de réservations et préférences ont été retirées de nos systèmes.</p>
    
    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <p style="color: #991b1b; margin-bottom: 0; font-size: 14px;">
            <strong>Note :</strong> Cette action est irréversible. Si vous souhaitez revenir parmi nous, vous devrez créer un nouveau compte.
        </p>
    </div>

    <p>Nous sommes désolés de vous voir partir. Si vous avez quelques minutes, n'hésitez pas à nous faire part de vos commentaires en répondant à cet email pour nous aider à nous améliorer.</p>
    
    <p>Merci d'avoir fait partie de l'aventure Match.</p>
    <p>L'équipe Match</p>
  `;
  
  return getBaseLayout(content, 'Confirmation de suppression de compte - Match');
};
