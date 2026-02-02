import { getBaseLayout } from './layout';

interface WelcomePartnerData {
  userName: string;
  actionLink: string;
}

export const getWelcomePartnerTemplate = (data: WelcomePartnerData) => {
  const content = `
    <h1>Bienvenue sur Match Partner !</h1>
    <p>Bonjour <strong>${data.userName}</strong>,</p>
    <p>Félicitations ! Votre compte partenaire a été créé avec succès.</p>
    <p>Avec Match Partner, vous pouvez gérer vos établissements, diffuser vos événements sportifs et attirer de nouveaux clients passionnés de sport.</p>
    <p>Accédez dès maintenant à votre tableau de bord pour configurer votre premier établissement :</p>
    <div class="text-center my-32">
      <a href="${data.actionLink}" class="button">Accéder à mon tableau de bord</a>
    </div>
    <p>Nous sommes ravis de collaborer avec vous.</p>
    <p>L'équipe Match</p>
  `;
  
  return getBaseLayout(content, 'Bienvenue sur Match Partner !');
};
