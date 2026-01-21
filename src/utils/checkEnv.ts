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
        "STRIPE_PRICE_MONTHLY",
        "STRIPE_PRICE_ANNUAL",
        "FRONTEND_URL",
        "LOCATIONIQ_KEY",
        "PORT",
    ];

    const missingEnvs = requiredEnvs.filter((env) => process.env[env] === undefined);

    if (missingEnvs.length > 0) {
        console.error("[ERROR]: Missing environment variables:", missingEnvs.join(", "));
        return false;
    }

    return true;
}

export default isEnvsDefined;
