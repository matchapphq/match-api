import { type Transporter, createTransport } from "nodemailer";
import { isMailEnvVarsInit, mailEnvVars } from "../types/mail.types";

class MailService {
    private readonly transporter: Transporter;
    
    constructor() {
        if (!isMailEnvVarsInit()) {
            throw new Error("Mail environment variables are not initialized");
        }
        
        this.transporter = createTransport({
            host: mailEnvVars.SMTP_HOST,
            port: parseInt(mailEnvVars.SMTP_PORT),
            secure: mailEnvVars.SMTP_SECURE,
            auth: {
                user: mailEnvVars.SMTP_USER,
                pass: mailEnvVars.SMTP_PASSWORD
            },
            connectionTimeout: 15000,
            tls: {
                rejectUnauthorized: false
            }
        });
    }
    
    async sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
        await this.transporter.sendMail({
            from: mailEnvVars.SMTP_USER,
            to,
            subject,
            text,
            html
        });
    }
}

export default MailService;