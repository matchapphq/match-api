interface SupportContactRequestData {
  traceId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  accountType?: string;
  subject?: string;
  message?: string;
  variables?: {
    traceId?: string;
    userId?: string;
    userName?: string;
    userEmail?: string;
    accountType?: string;
    subject?: string;
    message?: string;
  };
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const getSupportContactRequestTemplate = (data: SupportContactRequestData): string => {
  const payload = data.variables ?? data;
  const traceId = payload.traceId || 'N/A';
  const userId = payload.userId || 'N/A';
  const userName = payload.userName || 'N/A';
  const userEmail = payload.userEmail || 'N/A';
  const accountType = payload.accountType || 'N/A';
  const subject = payload.subject || 'N/A';
  const message = payload.message || '';
  const normalizedMessage = message.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const messageHtml = escapeHtml(normalizedMessage).replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demande contact support</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 24px;
      color: #111827;
      line-height: 1.45;
      background: #ffffff;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 20px;
    }
    p {
      margin: 0 0 12px;
    }
    .meta-line {
      margin: 0 0 8px;
      font-size: 14px;
      color: #111827;
    }
    .message-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px;
      color: #374151;
      font-size: 13px;
      margin: 0;
      white-space: normal;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }
  </style>
</head>
<body>
  <h2>Nouvelle demande de contact support</h2>
  <p>Une nouvelle demande de support a été envoyée depuis l&apos;application Match.</p>
  <p class="meta-line"><strong>Trace ID:</strong> ${escapeHtml(traceId)}</p>
  <p class="meta-line"><strong>User ID:</strong> ${escapeHtml(userId)}</p>
  <p class="meta-line"><strong>Nom:</strong> ${escapeHtml(userName)}</p>
  <p class="meta-line"><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
  <p class="meta-line"><strong>Type de compte:</strong> ${escapeHtml(accountType)}</p>
  <p class="meta-line"><strong>Sujet:</strong> ${escapeHtml(subject)}</p>
  <p class="meta-line"><strong>Message utilisateur:</strong></p>
  <div class="message-box">${messageHtml || '&nbsp;'}</div>
</body>
</html>
`;
};
