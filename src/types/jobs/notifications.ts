enum NotificationType {
    EMAIL = 'send_email',
    PUSH = 'send_push',
    SMS = 'send_sms',
    PUSH_NOTIFICATION = 'send_push_notification'
}

enum EmailTemplate {
    BOOKING_REQUEST = 'booking_request',
    PASSWORD_RESET = 'password_reset',
    PASSWORD_CHANGED = 'password_changed',
    VERIFICATION = 'verification',
    WELCOME = 'welcome',
    BOOKING_CONFIRMATION = 'booking_confirmation',
    BOOKING_CANCELLED = 'booking_cancelled',
    BOOKING_REMINDER = 'booking_reminder'
}

export interface NotificationWorkerData {
    type: NotificationType;
    payload: any;
}

export interface NotificationJob {
  type: NotificationType;
  recipientId: string; // user_id
  venueId?: string;
  traceId: string;
}

export interface SmsData {
  phone: string;
  message: string;
}

export interface EmailData {
  to: string;
  subject: string;
  template: EmailTemplate;
  variables: Record<string, any>;
}

export interface PushData {
  tokens: string[]; // Expo tokens
  title: string;
  body: string;
}

export type NotificationPayload = NotificationJob & (
  | { type: 'sms'; data: SmsData }
  | { type: 'email'; data: EmailData }
  | { type: 'push'; data: PushData }
);
