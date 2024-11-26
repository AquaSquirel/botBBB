const NodeWebcam = require("node-webcam");
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('node:fs');
const Gpio = require('pigpio').Gpio;

// Configuração do pino de transmissão
const pinOut = new Gpio(17, {
    mode: Gpio.OUTPUT,
    pullUpDown: Gpio.PUD_OFF,
});

// Configuração do pino de recepção (sensor de abertura da porta)
const pinIn = new Gpio(18, {
    mode: Gpio.INPUT,
    pullUpDown: Gpio.PUD_OFF,
});

// Configuração da webcam
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

// Função para capturar uma foto
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

// Inicialização do cliente WhatsApp
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
    let photoCountAfterClose = 0; // Para contar as fotos após fechar a porta
    let photoInterval; // Para armazenar o ID do intervalo de captura

    setInterval(async () => {
        const signal = pinIn.digitalRead(); // Lê o estado do pino de entrada (sensor)
        console.log(`Estado do pino de recepção (GPIO 24): ${signal}`);

        // Porta aberta (sinal 0)
        if (signal === 0 && !isDoorOpen) {
            isDoorOpen = true;
            photoCountAfterClose = 0; // Reseta o contador de fotos pós-fechamento
            console.log('🚪 Porta aberta! Capturando fotos...');
            
            photoInterval = setInterval(async () => {
                try {
                    const imgName = await takePicture();
                    const media = await MessageMedia.fromFilePath(`./${imgName}`);
                    await client.sendMessage('5515996652810@c.us', media);
                    fs.unlinkSync(`./${imgName}`); // Deleta a foto após o envio
                } catch (err) {
                    console.error("Erro ao processar a imagem:", err);
                }
            }, 10000); // Captura uma foto a cada 10 segundos enquanto a porta estiver aberta
        }

        // Porta fechada (sinal 1)
        if (signal === 1 && isDoorOpen) {
            isDoorOpen = false;
            console.log('🚪 Porta fechada! Capturando mais 2 fotos...');
            
            // Para o intervalo atual de captura de fotos
            clearInterval(photoInterval);

            // Captura mais duas fotos após a porta fechar
            const capturePhotos = async () => {
                if (photoCountAfterClose < 2) {
                    try {
                        const imgName = await takePicture();
                        const media = await MessageMedia.fromFilePath(`./${imgName}`);
                        await client.sendMessage('5515996652810@c.us', media);
                        fs.unlinkSync(`./${imgName}`);
                        photoCountAfterClose++;
                        console.log(`Foto ${photoCountAfterClose} capturada após fechamento.`);
                    } catch (err) {
                        console.error("Erro ao processar a imagem:", err);
                    }
                }
            };

            // Captura as duas fotos em um intervalo controlado
            const postCloseInterval = setInterval(() => {
                if (photoCountAfterClose >= 2) {
                    clearInterval(postCloseInterval); // Para após capturar 2 fotos
                } else {
                    capturePhotos();
                }
            }, 5000); // 5 segundos entre cada foto adicional
        }
    }, 500); // Verifica o estado do sensor a cada 500ms
});

// Geração do QR Code para autenticação no WhatsApp
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

// Encerramento ao pressionar Ctrl+C
process.on('SIGINT', () => {
    console.log("\nEncerrando...");
    process.exit();
});
