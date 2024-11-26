const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('node:fs');
const Gpio = require('pigpio').Gpio;

// Configuração do pino de transmissão (pino 23)
const pinOut = new Gpio(23, {
    mode: Gpio.OUTPUT,
});

// Configuração do pino de recepção (pino 24)
const pinIn = new Gpio(24, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_OFF, // Não usar resistores de pull-up ou pull-down
});

const webcamOptions = {
    width: 1280,
    height: 720,
    quality: 100,
    saveShots: true,
    output: "jpeg",
    device: '/dev/video0',
    callbackReturn: "location",
    verbose: false
};

const webcam = NodeWebcam.create(webcamOptions);

const takePicture = () => {
    return new Promise((resolve, reject) => {
        const imageName = `photo_${Date.now()}.jpeg`;
        webcam.capture(imageName, function (err, data) {
            if (err) {
                console.error("Erro ao capturar a imagem:", err);
                reject(err);
            } else {
                console.log(`Imagem capturada e salva como: ${data}`);
                resolve(imageName);
            }
        });
    });
};

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    },
    authStrategy: new LocalAuth()
});

client.on('ready', () => {
    console.log('Client is ready!');

    let signalLost = false;

    setInterval(async () => {
        const signal = pinIn.digitalRead(); // Lê o estado do pino de recepção
        console.log(`Estado do pino de recepção (GPIO 24): ${signal}`);

        if (signal === 0 && !signalLost) {
            signalLost = true;
            console.log('🚨 Sinal perdido! Capturando e enviando foto...');
            try {
                const imgName = await takePicture();
                const media = await MessageMedia.fromFilePath(`./${imgName}`);
                await client.sendMessage('SEU_NUMERO_AQUI', media);
                fs.unlinkSync(`./${imgName}`);
            } catch (err) {
                console.error("Erro ao processar a imagem:", err);
            }
        } else if (signal === 1) {
            signalLost = false;
        }
    }, 500);

    // Simulando o envio do sinal (pino 23) a cada 2 segundos
    setInterval(() => {
        pinOut.digitalWrite(1); // Envia sinal alto
        console.log('Sinal enviado: 1');
        setTimeout(() => {
            pinOut.digitalWrite(0); // Envia sinal baixo
            console.log('Sinal enviado: 0');
        }, 1000); // Mantém sinal alto por 1 segundo
    }, 3000); // Envia um sinal a cada 3 segundos
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

process.on('SIGINT', () => {
    console.log("\nEncerrando...");
    process.exit();
});
