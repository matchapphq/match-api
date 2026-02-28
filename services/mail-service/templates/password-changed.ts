import { getBaseLayout } from "./layout";

interface PasswordChangedData {
  userName?: string;
  changedAt?: string;
  supportEmail?: string;
}

export const getPasswordChangedTemplate = (data: PasswordChangedData) => {
  const displayName = data.userName?.trim();
  const supportEmail = (data.supportEmail || "support@matchapp.fr").trim();
  const changedAtLabel = data.changedAt
    ? new Date(data.changedAt).toLocaleString("fr-FR", {
        dateStyle: "long",
        timeStyle: "short",
      })
    : null;

  const content = `
    <h1>Alerte de sécurité</h1>
    <p>Bonjour${displayName ? ` <strong>${displayName}</strong>` : ""},</p>
    <p>Le mot de passe de votre compte <strong>Match</strong> a été modifié.</p>
    ${
      changedAtLabel
        ? `<p class="text-muted">Date du changement: <strong>${changedAtLabel}</strong></p>`
        : ""
    }
    <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="color: #991b1b; margin: 0;">
        Si vous ne reconnaissez pas cette activité ou si vous n'êtes pas à l'origine de ce changement, répondez à cet email ou contactez immédiatement <strong>${supportEmail}</strong>.
      </p>
    </div>
    <p class="text-muted border-top mt-32">Pour votre sécurité, nous vous recommandons aussi de vérifier vos sessions actives dans les paramètres de sécurité.</p>
  `;

  return getBaseLayout(content, "Mot de passe modifié - Match");
};
