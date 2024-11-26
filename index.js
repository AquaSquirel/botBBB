const NodeWebcam = require("node-webcam");
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('node:fs');
const Gpio = require('pigpio').Gpio;

// Configuração do pino de transmissão (pino 23)
const pinOut = new Gpio(23, {
    mode: Gpio.OUTPUT,
    pullUpDown: Gpio.PUD_OFF,  // Não usar resistores de pull-up ou pull-down
});

// Configuração do pino de recepção (pino 24) para o sensor de abertura da porta
const pinIn = new Gpio(24, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_OFF,  // Não usar resistores de pull-up ou pull-down
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

    let isDoorOpen = false;

    setInterval(async () => {
        const signal = pinIn.digitalRead(); // Lê o estado do pino de entrada (sensor)
        console.log(`Estado do pino de recepção (GPIO 24): ${signal}`);

        // Se o sinal for 0, significa que a porta está aberta (sensor interrompido a corrente)
        if (signal === 0 && !isDoorOpen) {
            isDoorOpen = true;
            console.log('🚨 Porta aberta! Capturando foto a cada 10 segundos...');
            try {
                setInterval(async () => {
                    const imgName = await takePicture();
                    const media = await MessageMedia.fromFilePath(`./${imgName}`);
                    await client.sendMessage('SEU_NUMERO_AQUI', media);
                    fs.unlinkSync(`./${imgName}`);
                }, 10000); // Captura uma foto a cada 10 segundos enquanto a porta está aberta
            } catch (err) {
                console.error("Erro ao processar a imagem:", err);
            }
        }

        // Se o sinal for 1, significa que a porta foi fechada (sensor com a corrente restabelecida)
        if (signal === 1 && isDoorOpen) {
            isDoorOpen = false;
            console.log('🚪 Porta fechada! Parando a captura de fotos.');
        }
    }, 500); // Verifica o estado do sensor a cada 500ms
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

process.on('SIGINT', () => {
    console.log("\nEncerrando...");
    process.exit();
});
