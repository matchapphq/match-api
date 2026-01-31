const PRIMARY_COLOR = '#5a03cf';
const SECONDARY_COLOR = '#9cff02';
const BG_COLOR = '#fafafa';
const TEXT_COLOR = '#0a0a0a';

export const getBaseLayout = (content: string, title: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: ${BG_COLOR};
      color: ${TEXT_COLOR};
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: ${PRIMARY_COLOR};
      text-decoration: none;
      font-style: italic;
    }
    .card {
      background-color: #ffffff;
      border-radius: 24px;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(0,0,0,0.05);
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, ${PRIMARY_COLOR}, #7a23ef);
      color: #ffffff !important;
      padding: 14px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 24px;
      text-align: center;
      box-shadow: 0 4px 14px 0 rgba(90, 3, 207, 0.39);
      transition: transform 0.2s;
    }
    .button:hover {
        transform: scale(1.02);
    }
    .footer {
      text-align: center;
      padding: 32px 20px;
      font-size: 13px;
      color: #666;
    }
    h1 {
      color: ${PRIMARY_COLOR};
      margin-top: 0;
      margin-bottom: 24px;
      font-size: 24px;
      font-weight: 700;
    }
    p {
      margin-bottom: 16px;
      font-size: 16px;
      color: #374151;
    }
    .accent {
        color: ${PRIMARY_COLOR};
        font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://match.app" class="logo">Match</a>
    </div>
    <div class="card">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Match. Tous droits réservés.</p>
      <p>Vous recevez cet email car vous avez un compte sur Match.</p>
    </div>
  </div>
</body>
</html>
`;
