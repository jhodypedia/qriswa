const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const axios = require('axios');
const mime = require('mime-types');
const produk = require('./produk.json');

const client = new Client({ authStrategy: new LocalAuth() });

client.on('ready', () => console.log('✅ WhatsApp Bot Siap'));

client.on('message', async (msg) => {
    const text = msg.body.trim();

    if (text.startsWith('.order')) {
        const arg = text.split(' ')[1];
        const item = produk.find(p => p.id === arg || p.name.toLowerCase().includes(arg.toLowerCase()));
        if (!item) return msg.reply('❌ Produk tidak ditemukan.');

        try {
            const res = await axios.post('http://localhost:3000/order', {
                produk_id: item.id,
                phone: msg.from
            });

            const { order_id, product_name, price, qr_url, deeplink } = res.data;

            const qrImage = await axios.get(qr_url, { responseType: 'arraybuffer' });
            const mimeType = qrImage.headers['content-type'];
            const media = new MessageMedia(mimeType, Buffer.from(qrImage.data).toString('base64'));

            await client.sendMessage(msg.from, media, {
                caption: `✅ *Order Diterima!*\n\n🛍️ Produk: *${product_name}*\n💰 Harga: *Rp ${price.toLocaleString()}*\n\n🔗 Link Pembayaran:\n${deeplink}\n\nJika sudah membayar, ketik:\n.paid ${order_id}`
            });
        } catch (err) {
            console.error(err);
            msg.reply('❌ Gagal memproses order.');
        }
    }

    if (text.startsWith('.paid')) {
        const orderId = text.split(' ')[1];
        try {
            const res = await axios.post('http://localhost:3000/mark-paid', {
                order_id: orderId
            });

            if (res.data.status === 'success') {
                msg.reply(`✅ Pembayaran untuk *${orderId}* berhasil dikonfirmasi. Terima kasih!`);
            } else {
                msg.reply(`❌ Order *${orderId}* tidak ditemukan atau sudah dibayar.`);
            }
        } catch (err) {
            msg.reply('❌ Gagal memverifikasi pembayaran.');
        }
    }
});

client.initialize();
