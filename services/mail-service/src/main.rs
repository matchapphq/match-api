mod mail;

use serde_json::json;
use dotenvy::dotenv;


#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let brokers = "localhost:9092";
    let topic = "mail-events";
    let group = "mail-group";
    let brokers_clone = brokers.to_string();
    let topic_clone = topic.to_string();
    dotenv().ok();
    let producer_task = tokio::spawn(async move {
        let event = json!({"to": "user@matchapp.com", "subject": "New Match"});
        println!("thread")
    });
    tokio::try_join!(producer_task)?;
    Ok(())
}
