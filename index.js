const NodeWebcam = require("node-webcam");
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('node:fs');

const client = new Client({
    authStrategy: new LocalAuth()
});

// Configurações da webcam
const webcamOptions = {
    width: 1280,
    height: 720,
    quality: 100,
    saveShots: true,
    output: "jpeg",
    device: 1,
    callbackReturn: "location",
    verbose: false
};

// Cria uma instância da webcam
const webcam = NodeWebcam.create(webcamOptions);

// Função para capturar a imagem com Promise
const takePicture = () => {
    return new Promise((resolve, reject) => {
        const imageName = `photo_${Date.now()}.jpeg`; // Nome da imagem com timestamp

        // Captura a imagem e salva no arquivo
        webcam.capture(imageName, function (err, data) {
            if (err) {
                console.error("Erro ao capturar a imagem:", err);
                reject(err); // Rejeita a Promise em caso de erro
            } else {
                console.log(`Imagem capturada e salva como: ${data}`);
                resolve(imageName); // Resolve a Promise com o nome da imagem
            }
        });
    });
};

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    if (msg.body.toLowerCase() === `cam`) {
        console.log('Tirando foto...');
        msg.reply('Tirando foto...');
        try {
            const imgName = await takePicture(); // Espera a função retornar o nome da imagem
            const media = await MessageMedia.fromFilePath(`./${imgName}`);
            await msg.reply(media); // Envia a imagem como resposta
            fs.unlinkSync(`./${imgName}`)
        } catch (err) {
            console.error("Erro ao processar a imagem:", err);
            await msg.reply("Desculpe, houve um erro ao tirar a foto.");
        }
    }
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();