function isEnvsDefined(): boolean {
    const requiredEnvs = [
        "NODE_ENV",
        "DATABASE_HOST",
        "DATABASE_PORT",
        "DATABASE_USER",
        "DATABASE_PASSWORD",
        "DATABASE_NAME",
        "DATABASE_URL",
        "SECRET_KEY",
        "REFRESH_SECRET_KEY",
        "ACCESS_JWT_SIGN_KEY",
        "REFRESH_JWT_SIGN_KEY",
        "QR_SECRET",
        "STRIPE_SECRET_KEY",
        "STRIPE_PUBLISHABLE_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "FRONTEND_URL",
        "LOCATIONIQ_KEY",
        "PORT",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_SECURE",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "SMTP_SEND_MAIL",
        "SMTP_SEND_NAME",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
        "S3_BUCKET",
        "REDIS_HOST",
        "REDIS_PORT",
    ];

    const missingEnvs = requiredEnvs.filter((env) => process.env[env] === undefined);

    if (missingEnvs.length > 0) {
        console.error("[ERROR]: Missing environment variables:", missingEnvs.join(", "));
        return false;
    }

    return true;
}

export default isEnvsDefined;
