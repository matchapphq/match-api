use std::io::Error;
use anyhow::Context;
use serde_json::Value;
use lettre::{
    message::header::ContentType,
    message::Mailbox,
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport,
    Message,
    Tokio1Executor,
    AsyncTransport
};

pub async fn send_email(email: String, subject: String, body: String) -> anyhow::Result<()> {
    // let from_email = std::env::var("ZOHO_FROM")?;
    let from_email = "dev@matchapp.fr";
    let from = from_email.parse()?;
    let to = Message::builder()
        .from(from)
        .to(Mailbox::new(None, email.parse()?))
        .header(ContentType::TEXT_HTML)
        .subject(subject)
        .body(body)
        .unwrap();
    let creds = Credentials::new(
            std::env::var("SMTP_USER")?,
            std::env::var("SMTP_PASS")?,
    );
    let transport = AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.zoho.com:587")?
            .credentials(creds)
            .build();
    transport.send(to).await.context("ZOHO failed !")?;
    Ok(())
}
