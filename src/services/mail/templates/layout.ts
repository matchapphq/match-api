const PRIMARY_COLOR = '#5a03cf';
const SECONDARY_COLOR = '#9cff02';
const BG_COLOR = '#fafafa';
const TEXT_COLOR = '#0a0a0a';

// Dark Mode Colors
const DARK_BG_COLOR = '#121212';
const DARK_CARD_COLOR = '#1e1e1e';
const DARK_TEXT_COLOR = '#e5e5e5';
const DARK_TEXT_MUTED = '#a3a3a3';
const DARK_BORDER_COLOR = '#333333';

export const getBaseLayout = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    
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

    /* Utility Classes */
    .text-center { text-align: center; }
    .my-32 { margin-top: 32px; margin-bottom: 32px; }
    .mt-32 { margin-top: 32px; }
    .mb-12 { margin-bottom: 12px; }
    .text-muted { color: #6b7280; font-size: 14px; }
    .text-small { font-size: 13px; }
    .text-xs { font-size: 12px; }
    .uppercase { text-transform: uppercase; letter-spacing: 0.5px; }
    .border-top { border-top: 1px solid #f3f4f6; padding-top: 16px; }
    .border-dashed { border-top: 1px dashed #cbd5e1; }
    
    .ticket-container {
        background-color: #f8fafc;
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
        border: 1px solid #e2e8f0;
    }
    
    .label {
        color: #64748b;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .flex-between {
        display: flex;
        justify-content: space-between;
    }

    /* Dark Mode Styles */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: ${DARK_BG_COLOR} !important;
        color: ${DARK_TEXT_COLOR} !important;
      }
      .card {
        background-color: ${DARK_CARD_COLOR} !important;
        border-color: ${DARK_BORDER_COLOR} !important;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3) !important;
      }
      .logo {
        color: #7c3aed !important; /* Slightly lighter purple for dark mode contrast */
      }
      h1 {
        color: #7c3aed !important;
      }
      p {
        color: #d4d4d4 !important;
      }
      .footer {
        color: #737373 !important;
      }
      .text-muted, .label {
        color: ${DARK_TEXT_MUTED} !important;
      }
      .border-top {
        border-color: ${DARK_BORDER_COLOR} !important;
      }
      .ticket-container {
        background-color: #262626 !important;
        border-color: ${DARK_BORDER_COLOR} !important;
      }
      .border-dashed {
        border-color: #404040 !important;
      }
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
      <p class="text-muted">&copy; ${new Date().getFullYear()} Match. Tous droits réservés.</p>
      <p class="text-muted">Vous recevez cet email car vous avez un compte sur Match.</p>
    </div>
  </div>
</body>
</html>
`;
