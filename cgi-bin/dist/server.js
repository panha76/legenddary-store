"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const ts_khqr_1 = require("ts-khqr");
const qrcode_1 = __importDefault(require("qrcode"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const js_yaml_1 = __importDefault(require("js-yaml"));
// Load config
const configPath = path_1.default.join(__dirname, 'config.yml');
const config = js_yaml_1.default.load(fs_1.default.readFileSync(configPath, 'utf8'));
console.log('Starting server...');
const app = (0, express_1.default)();
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
app.use(express_1.default.static('public'));
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'public', 'index.html'));
});
app.post('../success', function (req, res) {
    res.sendFile(path_1.default.join(__dirname, 'public', THANK_PAGE));
});
app.post('/generate-khqr', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { amount, itemId, userId, zoneId, transactionId } = req.body;
    console.log('Received request to generate KHQR:', { amount, itemId, userId, zoneId, transactionId });
    let responseSent = false; // Flag to check if response is already sent
    try {
        const khqrResult = ts_khqr_1.KHQR.generate({
            tag: ts_khqr_1.TAG.INDIVIDUAL,
            accountID: BANK_ID,
            merchantName: BANK_NAME,
            currency: ts_khqr_1.CURRENCY.USD,
            amount: Number(amount),
            countryCode: ts_khqr_1.COUNTRY.KH,
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
                const qrCodeData = yield qrcode_1.default.toDataURL(qrString);
                console.log('Generated QR Code data');
                // Start checking payment status
                yield checkPaymentStatus(khqrResult.data.md5, amount, itemId, userId, zoneId, transactionId, res, responseSent);
                if (!responseSent) {
                    // Send the QR code data if the payment status hasn't been confirmed
                    res.json({ qrCodeData });
                    responseSent = true;
                }
            }
            else {
                console.error('QR data is null or undefined');
                if (!responseSent) {
                    res.status(500).json({ error: 'QR data is null or undefined' });
                    responseSent = true;
                }
            }
        }
        else {
            console.error('Invalid KHQR data:', khqrResult.status);
            if (!responseSent) {
                res.status(400).json({ error: 'Invalid KHQR data' });
                responseSent = true;
            }
        }
    }
    catch (error) {
        console.error('Error generating KHQR:', error);
        if (!responseSent) {
            res.status(500).json({ error: 'Error generating KHQR' });
            responseSent = true;
        }
    }
}));
function checkPaymentStatus(md5, amount, itemId, userId, zoneId, transactionId, res, responseSent) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = config.api.bakongUrl;
        const body = { md5 };
        const token = config.api.token;
        const header = {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
        const intervalId = setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield (0, node_fetch_1.default)(url, {
                    method: 'POST',
                    headers: header,
                    body: JSON.stringify(body)
                });
                if (response.ok) {
                    const jsonData = yield response.json();
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
                                    yield (0, node_fetch_1.default)(DISCORD_WEBHOOK_URL, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(discordMessage)
                                    });
                                }
                                catch (err) {
                                    console.error('Failed to send Discord notification:', err);
                                }
                            }
                            if (TELEGRAM_ENABLED) {
                                try {
                                    yield (0, node_fetch_1.default)(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            chat_id: TELEGRAM_CHAT_ID,
                                            text: `🛍️ New Order 📥\n\n💠 UserID: <code>${userId}</code>\n🌐 ServerID: ${zoneId}\n💙 Items: ${itemId}\n💲 Price: ${amount}\n🌌 Transaction: ${transactionId}\n`,
                                            parse_mode: 'HTML'
                                        })
                                    });
                                }
                                catch (err) {
                                    console.error('Failed to send Telegram notification:', err);
                                }
                            }
                        }
                    }
                }
                else {
                    console.error('Failed to check payment status:', response.statusText);
                }
            }
            catch (error) {
                console.error('Error checking payment status:', error);
            }
        }), 5000);
        setTimeout(() => {
            clearInterval(intervalId);
        }, 1000000);
    });
}
if (USE_HTTPS) {
    const httpsOptions = {
        key: fs_1.default.readFileSync(config.server.ssl.keyPath),
        cert: fs_1.default.readFileSync(config.server.ssl.certPath)
    };
    https_1.default.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`Server is running on https://${DOMAIN}:${PORT}`);
    });
}
else {
    app.listen(PORT, () => {
        console.log(`Server is running on http://${DOMAIN}:${PORT}`);
    });
}
