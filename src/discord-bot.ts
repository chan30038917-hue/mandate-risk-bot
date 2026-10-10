import { Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder } from "discord.js";
import { getHealthFactor } from "./libs/aave";
import { addWalletToUser, getUserWallets } from "./db";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || "";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";

export const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
});

const commands = [
  new SlashCommandBuilder()
    .setName("monitor")
    .setDescription("Registra una wallet para monitorear su riesgo de liquidacion")
    .addStringOption((option) =>
      option.setName("wallet").setDescription("Direccion 0x...").setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("wallets")
    .setDescription("Lista tus wallets monitoreadas"),
];

export async function startDiscordBot() {
  discordClient.once(Events.ClientReady, async (c) => {
    console.log(`Bot de Discord listo: ${c.user.tag}`);
    
    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log("Comandos slash registrados");
    } catch (error) {
      console.error("Error registrando comandos:", error);
    }
  });

  discordClient.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "monitor") {
      const wallet = interaction.options.getString("wallet")!;
      
      if (!wallet.startsWith("0x") || wallet.length !== 42) {
        await interaction.reply({ content: "Direccion invalida. Debe empezar con 0x y tener 42 caracteres.", ephemeral: true });
        return;
      }

      addWalletToUser(interaction.user.id, wallet);
      await interaction.reply({ 
        content: `Wallet registrada: \`${wallet.slice(0, 6)}...${wallet.slice(-4)}\`\n\nRecibiras alertas por DM cuando el health factor baje de 1.5.`,
        ephemeral: true 
      });
    }

    if (interaction.commandName === "wallets") {
      const wallets = getUserWallets(interaction.user.id);
      if (wallets.length === 0) {
        await interaction.reply({ content: "No tienes wallets registradas. Usa `/monitor 0x...` para anadir una.", ephemeral: true });
        return;
      }
      const list = wallets.map((w) => `\`${w.slice(0, 6)}...${w.slice(-4)}\``).join("\n");
      await interaction.reply({ content: `Tus wallets:\n${list}`, ephemeral: true });
    }
  });

  await discordClient.login(DISCORD_TOKEN);
}

export async function sendDMToUser(userId: string, message: string) {
  try {
    const user = await discordClient.users.fetch(userId);
    await user.send(message);
    console.log(`DM enviado a ${userId}`);
  } catch (error) {
    console.error(`Error enviando DM a ${userId}:`, error);
  }
}
