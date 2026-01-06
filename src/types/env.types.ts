export interface MailEnvVars {
    SMTP_HOST: string;
    SMTP_PORT: string;
    SMTP_SECURE: boolean;
    SMTP_USER: string;
    SMTP_PASSWORD: string;
}

export const mailEnvVars: MailEnvVars = {
    SMTP_HOST: process.env.SMTP_HOST!,
    SMTP_PORT: process.env.SMTP_PORT!,
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER!,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD!,
};

export function isMailEnvVarsInit(): boolean {
    return (
        process.env.SMTP_HOST !== undefined &&
        process.env.SMTP_PORT !== undefined &&
        process.env.SMTP_SECURE !== undefined &&
        process.env.SMTP_USER !== undefined &&
        process.env.SMTP_PASSWORD !== undefined
    );
}
