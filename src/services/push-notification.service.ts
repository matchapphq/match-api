import { Expo } from 'expo-server-sdk';

export class PushNotificationService {
    private expo: Expo;

    constructor() {
        this.expo = new Expo();
    }

    /**
     * Send push notifications to a list of tokens
     * @param tokens Array of Expo push tokens
     * @param title Notification title
     * @param body Notification body
     * @param data Optional data payload
     */
    async sendNotifications(tokens: string[], title: string, body: string, data?: any) {
        const messages = [];
        
        for (const token of tokens) {
            if (!Expo.isExpoPushToken(token)) {
                console.error(`Push token ${token} is not a valid Expo push token`);
                continue;
            }

            messages.push({
                to: token,
                sound: 'default' as const, // Fix type inference
                title,
                body,
                data,
            });
        }

        const chunks = this.expo.chunkPushNotifications(messages);
        
        for (const chunk of chunks) {
            try {
                const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
                console.log('Notification tickets:', ticketChunk);
                // NOTE: For production, you should process tickets to handle errors (e.g., DeviceNotRegistered)
            } catch (error) {
                console.error('Error sending push notifications chunk:', error);
            }
        }
    }

    /**
     * Send a notification to a single user
     * @param token User's push token
     * @param title Notification title
     * @param body Notification body
     * @param data Optional data payload
     */
    async sendToUser(token: string, title: string, body: string, data?: any) {
        return this.sendNotifications([token], title, body, data);
    }
}

export const pushNotificationService = new PushNotificationService();
