import { type Transporter, createTransport } from "nodemailer";
import { isMailEnvVarsInit, mailEnvVars } from "../types/mail.types";

class MailService {
    private readonly transporter: Transporter;
    private readonly defaultReplyTo: string;
    private readonly fromAddress: string;
    
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

        this.defaultReplyTo = (process.env.SUPPORT_EMAIL || "support@matchapp.fr").trim();
        this.fromAddress = (process.env.SMTP_NO_REPLY || mailEnvVars.SMTP_SEND_MAIL).trim();
    }
    
    async sendMail(
        to: string,
        subject: string,
        text: string,
        html: string,
    ): Promise<void> {
        // Product requirement: all replies must go to support.
        const effectiveReplyTo = this.defaultReplyTo;

        await this.transporter.sendMail(
            {
                from: {
                    name: mailEnvVars.SMTP_SEND_NAME,
                    address: this.fromAddress
                },
                to,
                replyTo: effectiveReplyTo,
                subject: subject,
                text,
                html
            }
        );
    }
}

export default MailService;
