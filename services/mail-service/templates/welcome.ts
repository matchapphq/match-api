import { getBaseLayout } from './layout';

interface WelcomeData {
  userName: string;
  actionLink: string;
}

export const getWelcomeTemplate = (data: WelcomeData) => {
  const content = `
    <h1>Bienvenue sur Match !</h1>
    <p>Bonjour <strong>${data.userName}</strong>,</p>
    <p>Nous sommes ravis de vous compter parmi nous. Votre compte a été créé avec succès.</p>
    <p>Match est la plateforme idéale pour trouver les meilleurs endroits pour regarder vos matchs préférés avec d'autres passionnés.</p>
    <p>Pour commencer, découvrez les établissements autour de vous :</p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${data.actionLink}" class="button">Trouver un match</a>
    </div>
    <p>Si vous avez des questions, n'hésitez pas à répondre à cet email.</p>
  `;
  
  return getBaseLayout(content, 'Bienvenue sur Match !');
};
