import axios from "axios";

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";

export const sendDiscordAlert = async (message: string): Promise<void> => {
  if (!DISCORD_WEBHOOK_URL) {
    console.log("DISCORD_WEBHOOK_URL no configurado");
    return;
  }
  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content: message });
    console.log("Alerta enviada a Discord");
  } catch (error) {
    console.error("Error enviando alerta a Discord:", error);
  }
};
