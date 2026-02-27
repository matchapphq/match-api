import { EmailType } from '../types/mail.types';
import { getResetPasswordTemplate } from './reset-password';
import { getWelcomeTemplate } from './welcome';
import { getWelcomeBackTemplate } from './welcome-back';
import { getWelcomePartnerTemplate } from './welcome-partner';
import { getVenuePaymentSuccessTemplate } from './venue-payment-success';
import { getReservationConfirmationTemplate } from './reservation-confirmation';
import { getAccountDeletionTemplate } from './account-deletion';
import { getBugReportTemplate } from './bug-report';
import { getDataExportRequestTemplate } from './data-export-request';
import { getBaseLayout } from './layout';

const TEMPLATE_ALIASES: Record<string, EmailType> = {
  welcome: EmailType.WELCOME,
  welcomeback: EmailType.WELCOME_BACK,
  'welcome-back': EmailType.WELCOME_BACK,
  welcome_partner: EmailType.WELCOME_PARTNER,
  'welcome-partner': EmailType.WELCOME_PARTNER,
  venue_payment_success: EmailType.VENUE_PAYMENT_SUCCESS,
  'venue-payment-success': EmailType.VENUE_PAYMENT_SUCCESS,
  forgot_password: EmailType.FORGOT_PASSWORD,
  'forgot-password': EmailType.FORGOT_PASSWORD,
  reset_password: EmailType.RESET_PASSWORD,
  'reset-password': EmailType.RESET_PASSWORD,
  reservation_confirmation: EmailType.RESERVATION_CONFIRMATION,
  'reservation-confirmation': EmailType.RESERVATION_CONFIRMATION,
  account_deletion: EmailType.ACCOUNT_DELETION,
  'account-deletion': EmailType.ACCOUNT_DELETION,
  bug_report: EmailType.BUG_REPORT,
  'bug-report': EmailType.BUG_REPORT,
  data_export_request: EmailType.DATA_EXPORT_REQUEST,
  'data-export-request': EmailType.DATA_EXPORT_REQUEST,
};

const normalizeTemplateType = (type: EmailType | string): EmailType | null => {
  const normalized = String(type).trim().toLowerCase();
  if (!normalized) return null;
  const directMatch = TEMPLATE_ALIASES[normalized];
  if (directMatch) return directMatch;
  const dashed = normalized.replace(/_/g, '-');
  return TEMPLATE_ALIASES[dashed] || null;
};

export const getEmailTemplate = (type: EmailType | string, data: any): string => {
  const templateType = normalizeTemplateType(type);

  switch (templateType) {
    case EmailType.RESET_PASSWORD:
    case EmailType.FORGOT_PASSWORD:
      return getResetPasswordTemplate(data);
    case EmailType.WELCOME:
      return getWelcomeTemplate(data);
    case EmailType.WELCOME_BACK:
      return getWelcomeBackTemplate(data);
    case EmailType.WELCOME_PARTNER:
      return getWelcomePartnerTemplate(data);
    case EmailType.VENUE_PAYMENT_SUCCESS:
      return getVenuePaymentSuccessTemplate(data);
    case EmailType.RESERVATION_CONFIRMATION:
      return getReservationConfirmationTemplate(data);
    case EmailType.ACCOUNT_DELETION:
      return getAccountDeletionTemplate(data);
    case EmailType.BUG_REPORT:
      return getBugReportTemplate(data);
    case EmailType.DATA_EXPORT_REQUEST:
      return getDataExportRequestTemplate(data);
    default:
      return getBaseLayout(`<p>${data.text || 'Message from Match'}</p>`, 'Match Notification');
  }
};
