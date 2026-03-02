import type { JobsOptions } from "bullmq";
import UserRepository, { type NotificationPreferences } from "../repository/user.repository";
import { mailQueue } from "../queue/notification.queue";
import type { EmailType } from "../types/mail.types";

export type NotificationEmailPreferenceKey = Extract<
    keyof NotificationPreferences,
    `email_${string}`
>;

interface MailJobPayload {
    to: string;
    subject?: string;
    text?: string;
    html?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
}

interface ShouldQueueEmailParams {
    recipientUserId?: string | null;
    isTransactional: boolean;
    preferenceKey?: NotificationEmailPreferenceKey;
}

interface QueueEmailIfAllowedParams extends ShouldQueueEmailParams {
    jobName: EmailType;
    payload: MailJobPayload;
    options?: JobsOptions;
}

const userRepository = new UserRepository();

function getRequiredNonTransactionalParams({
    recipientUserId,
    preferenceKey,
}: {
    recipientUserId?: string | null;
    preferenceKey?: NotificationEmailPreferenceKey;
}) {
    if (!recipientUserId) {
        throw new Error("NON_TRANSACTIONAL_EMAIL_REQUIRES_RECIPIENT_USER_ID");
    }

    if (!preferenceKey) {
        throw new Error("NON_TRANSACTIONAL_EMAIL_REQUIRES_PREFERENCE_KEY");
    }

    return { recipientUserId, preferenceKey };
}

export async function shouldQueueEmail({
    recipientUserId,
    isTransactional,
    preferenceKey,
}: ShouldQueueEmailParams): Promise<boolean> {
    if (isTransactional) {
        return true;
    }

    const requiredParams = getRequiredNonTransactionalParams({ recipientUserId, preferenceKey });

    const preferences = await userRepository.getNotificationPreferences(requiredParams.recipientUserId);
    return preferences[requiredParams.preferenceKey];
}

export async function queueEmailIfAllowed({
    jobName,
    payload,
    options,
    recipientUserId,
    isTransactional,
    preferenceKey,
}: QueueEmailIfAllowedParams): Promise<{ queued: boolean; reason?: string }> {
    const allowed = await shouldQueueEmail({
        recipientUserId,
        isTransactional,
        preferenceKey,
    });

    if (!allowed) {
        console.info("[MAIL] Email skipped by preferences", {
            jobName,
            recipientUserId,
            preferenceKey,
        });
        return { queued: false, reason: "preference_disabled" };
    }

    await mailQueue.add(jobName, payload, options);
    return { queued: true };
}
