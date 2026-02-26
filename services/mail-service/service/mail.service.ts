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
            secure: false,
            requireTLS: true,
            auth: {
                user: mailEnvVars.SMTP_USER,
                pass: mailEnvVars.SMTP_PASSWORD
            },
        });
    }
    
    async sendMail(
        to: string,
        subject: string,
        text: string,
        html: string,
        replyTo?: string,
    ): Promise<void> {
        await this.transporter.sendMail(
            {
                from: {
                    name: mailEnvVars.SMTP_SEND_NAME,
                    address: mailEnvVars.SMTP_USER
                },
                to,
                replyTo,
                subject: subject,
                text,
                html
            }
        );
    }
}

export default MailService;
