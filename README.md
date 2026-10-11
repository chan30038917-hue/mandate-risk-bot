# Mandate Risk Monitor Bot

Bot de Discord + API HTTP para monitorear el riesgo de liquidacion en Aave V3 y Curvance en Monad Mainnet.

## Que hace

- Monitorea multiples wallets en tiempo real
- Lee el health factor de Aave V3 y Curvance en Monad
- Envia alertas por DM de Discord cuando el health factor baja de 1.5
- API HTTP para que la extension de Chrome consulte los datos
- Sin custodia, sin permisos, solo lectura

## Comandos de Discord

### /monitor <wallet>
Registra una wallet para monitorear su riesgo de liquidacion.

Ejemplo:
/monitor 0xc0A0dd5de293Ce2784b535c6b187A051e1608B0c

### /wallets
Lista todas tus wallets registradas.

## API HTTP

Base URL: https://mandate-risk-bot-production.up.railway.app

### GET /
Devuelve informacion de la API.

### GET /health
Health check para Railway.

### POST /api/register
Registra una wallet para un usuario de Discord.

Body:
{
  "discordId": "123456789012345678",
  "wallet": "0xc0A0dd5de293Ce2784b535c6b187A051e1608B0c"
}

### GET /api/wallets/:discordId
Lista las wallets de un usuario.

### GET /api/health-factor/:wallet
Devuelve el health factor de una wallet en Aave V3.

## Umbrales de riesgo

| Health Factor | Estado |
|--------------|--------|
| > 1.5 | SEGURO |
| 1.1 - 1.5 | PRECAUCION |
| < 1.1 | CRITICO |
| > 100 | SIN DEUDA |

## Red

- Red: Monad Mainnet
- Chain ID: 143
- RPC: https://rpc.monad.xyz

### Contratos monitoreados

- Aave V3 Pool: 0x69a5f9ad4f96ebf0a0c792dd42a01cc5c0102fef
- Curvance ProtocolReader: 0x2677738657F27e1A3591E00AD7E5a78807688C08

## Variables de entorno

DISCORD_TOKEN=tu_token_del_bot
DISCORD_CLIENT_ID=tu_application_id
NIXPACKS_NODE_VERSION=22

## Tecnologias

- Node.js 22
- TypeScript
- discord.js
- Express
- better-sqlite3
- ethers.js

## Licencia

MIT
