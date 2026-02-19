import { getBaseLayout } from './layout';

export const getBugReportTemplate = (data: {
    subject: string;
    template: string;
    variables: {
        userName: string;
        userEmail: string;
        description: string;
        metadata?: any;
    }
}): string => {
  const content = `
    <div style="padding: 20px; background-color: #ffffff; border-radius: 8px;">
      <h2 style="color: #f47b25; margin-top: 0;">Nouveau Rapport de Bug</h2>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f9f9f9; border-radius: 6px; border-left: 4px solid #f47b25;">
        <p style="margin: 0; font-weight: bold; color: #333;">Utilisateur:</p>
        <p style="margin: 5px 0 0 0; color: #555;">${data.variables.userName} (${data.variables.userEmail})</p>
      </div>

      <div style="margin-bottom: 20px;">
        <p style="margin: 0; font-weight: bold; color: #333;">Description du bug:</p>
        <p style="margin: 10px 0; color: #555; line-height: 1.6; white-space: pre-wrap;">${data.variables.description}</p>
      </div>

      ${data.variables.metadata ? `
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="margin: 0; font-size: 12px; font-weight: bold; color: #999; text-transform: uppercase;">Informations système:</p>
        <pre style="margin: 10px 0 0 0; font-size: 11px; color: #777; background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto;">${JSON.stringify(data.variables.metadata, null, 2)}</pre>
      </div>
      ` : ''}
    </div>
  `;

  return getBaseLayout(content, 'Bug Report - Match');
};
