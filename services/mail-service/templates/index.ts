import { EmailType } from '../types/mail.types';
import { getResetPasswordTemplate } from './reset-password';
import { getWelcomeTemplate } from './welcome';
import { getReservationConfirmationTemplate } from './reservation-confirmation';
import { getBaseLayout } from './layout';

export const getEmailTemplate = (type: EmailType, data: any): string => {
  switch (type) {
    case EmailType.RESET_PASSWORD:
    case EmailType.FORGOT_PASSWORD:
      return getResetPasswordTemplate(data);
    case EmailType.WELCOME:
      return getWelcomeTemplate(data);
    case EmailType.RESERVATION_CONFIRMATION:
      return getReservationConfirmationTemplate(data);
    default:
      // Fallback for other types or throw error if strict
      // For now, return a basic HTML
      return getBaseLayout(`<p>${data.text || 'Message from Match'}</p>`, 'Match Notification');
  }
};
