import express, { Request, Response } from 'express';
import { KHQR, CURRENCY, COUNTRY, TAG } from 'ts-khqr';
import QRCode from 'qrcode';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import https from 'https';
import yaml from 'js-yaml';

// Load config
const configPath = path.join(__dirname, 'config.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8')) as any;

console.log('Starting server...');

const app = express();
const PORT = config.server.port || 3000;
const USE_HTTPS = config.server.useHttps || false;
const DOMAIN = config.server.domain;

const DISCORD_WEBHOOK_URL = config.webhooks.discord.url;
const DISCORD_ENABLED = config.webhooks.discord.enabled;
const TELEGRAM_BOT_TOKEN = config.webhooks.telegram.token;
const TELEGRAM_CHAT_ID = config.webhooks.telegram.chatId;
const TELEGRAM_ENABLED = config.webhooks.telegram.enabled;

const BANK_ID = config.account.accountID;
const BANK_NAME = config.account.CustomName;

const THANK_PAGE = config.general.ThankPage;

app.use(express.static('public'));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('../success', function (req, res) {
  res.sendFile(path.join(__dirname, 'public', THANK_PAGE));
});

app.post('/generate-khqr', async (req: Request, res: Response) => {
  const { amount, itemId, userId, zoneId, transactionId } = req.body;
  console.log('Received request to generate KHQR:', { amount, itemId, userId, zoneId, transactionId });

  let responseSent = false; // Flag to check if response is already sent

  try {
    const khqrResult = KHQR.generate({
      tag: TAG.INDIVIDUAL,
      accountID: BANK_ID,
      merchantName: BANK_NAME,
      currency: CURRENCY.USD,
      amount: Number(amount),
      countryCode: COUNTRY.KH,
      additionalData: {
        billNumber: transactionId,
        purposeOfTransaction: 'Payment'
      }
    });

    console.log('Generated KHQR result:', khqrResult);

    if (khqrResult.status.code === 0 && khqrResult.data) {
      const qrString = khqrResult.data.qr;

      if (qrString) {
        console.log('QR Data:', qrString);

        const qrCodeData = await QRCode.toDataURL(qrString);
        console.log('Generated QR Code data');

        // Start checking payment status
        await checkPaymentStatus(khqrResult.data.md5, amount, itemId, userId, zoneId, transactionId, res, responseSent);

        if (!responseSent) {
          // Send the QR code data if the payment status hasn't been confirmed
          res.json({ qrCodeData });
          responseSent = true;
        }
      } else {
        console.error('QR data is null or undefined');
        if (!responseSent) {
          res.status(500).json({ error: 'QR data is null or undefined' });
          responseSent = true;
        }
      }
    } else {
      console.error('Invalid KHQR data:', khqrResult.status);
      if (!responseSent) {
        res.status(400).json({ error: 'Invalid KHQR data' });
        responseSent = true;
      }
    }
  } catch (error) {
    console.error('Error generating KHQR:', error);
    if (!responseSent) {
      res.status(500).json({ error: 'Error generating KHQR' });
      responseSent = true;
    }
  }
});

async function checkPaymentStatus(
  md5: string,
  amount: number,
  itemId: string,
  userId: string,
  zoneId: string,
  transactionId: string,
  res: Response,
  responseSent: boolean
): Promise<void> {
  const url = config.api.bakongUrl;
  const body = { md5 };
  const token = config.api.token;
  const header = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: header,
        body: JSON.stringify(body)
      });

      if (response.ok) {
        const jsonData = await response.json();

        if (jsonData.responseCode === 0 && jsonData.data && jsonData.data.hash) {
          clearInterval(intervalId);

          if (!responseSent) {
            // Redirect after successful payment status check
            res.redirect("../success");
            responseSent = true;

            // Send notifications to Discord and Telegram
            if (DISCORD_ENABLED) {
              const discordMessage = {
                content: `@everyone check this topup!`,
                embeds: [
                  {
                    title: 'Payment Success',
                    description: `💠 UserID: ${userId}\n🌐 ServerID: ${zoneId}\n💙 Items: ${itemId}\n💲 Price: ${amount}\n🌌 Transaction: ${transactionId}`,
                  }
                ]
              };

              try {
                await fetch(DISCORD_WEBHOOK_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(discordMessage)
                });
              } catch (err) {
                console.error('Failed to send Discord notification:', err);
              }
            }

            if (TELEGRAM_ENABLED) {
              try {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: `🛍️ New Order 📥\n\n💠 UserID: <code>${userId}</code>\n🌐 ServerID: ${zoneId}\n💙 Items: ${itemId}\n💲 Price: ${amount}\n🌌 Transaction: ${transactionId}\n`,
                    parse_mode: 'HTML'
                  })
                });
              } catch (err) {
                console.error('Failed to send Telegram notification:', err);
              }
            }
          }
        }
      } else {
        console.error('Failed to check payment status:', response.statusText);
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
    }
  }, 5000);

  setTimeout(() => {
    clearInterval(intervalId);
  }, 1000000);
}

if (USE_HTTPS) {
  const httpsOptions = {
    key: fs.readFileSync(config.server.ssl.keyPath),
    cert: fs.readFileSync(config.server.ssl.certPath)
  };

  https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server is running on https://${DOMAIN}:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`Server is running on http://${DOMAIN}:${PORT}`);
  });
}
