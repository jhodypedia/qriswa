const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const midtrans = require('midtrans-client');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const app = express();
app.use(bodyParser.json());

const produk = JSON.parse(fs.readFileSync('./produk.json'));
const orderFile = './orders.json';

function simpanOrder(order) {
    let orders = [];
    if (fs.existsSync(orderFile)) {
        orders = JSON.parse(fs.readFileSync(orderFile));
    }
    orders.push(order);
    fs.writeFileSync(orderFile, JSON.stringify(orders, null, 2));
}

function generateOrderId() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const random = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * 26)]).join('');
    return `order-${hh}${mm}${ss}-${random}`;
}

const snap = new midtrans.Snap({
    isProduction: false,
    serverKey: process.env.MIDTRANS_SERVER_KEY
});

app.post('/order', async (req, res) => {
    const { produk_id, phone } = req.body;
    const item = produk.find(p => p.id === produk_id);
    if (!item) return res.status(404).json({ error: 'Produk tidak ditemukan' });

    const orderId = generateOrderId();

    const param = {
        transaction_details: {
            order_id: orderId,
            gross_amount: item.price
        },
        qris: {
            acquirer: "gopay"
        }
    };

    try {
        const trx = await snap.createTransaction(param);
        const qr = trx.actions.find(a => a.name === "generate-qr-code");
        const link = trx.actions.find(a => a.name === "deeplink-redirect");
        const time = new Date().toLocaleString('id-ID');

        simpanOrder({
            order_id: orderId,
            product_name: item.name,
            price: item.price,
            phone,
            time,
            qr_url: qr.url,
            deeplink: link.url,
            is_paid: false
        });

        res.json({
            order_id: orderId,
            product_name: item.name,
            price: item.price,
            qr_url: qr.url,
            deeplink: link.url
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Gagal membuat transaksi' });
    }
});

app.post('/mark-paid', (req, res) => {
    const { order_id } = req.body;
    let orders = JSON.parse(fs.readFileSync(orderFile));
    let found = false;

    orders = orders.map(order => {
        if (order.order_id === order_id && !order.is_paid) {
            order.is_paid = true;
            found = true;
        }
        return order;
    });

    fs.writeFileSync(orderFile, JSON.stringify(orders, null, 2));
    res.json({ status: found ? 'success' : 'not_found_or_already_paid' });
});

app.get('/admin', (req, res) => {
    let orders = JSON.parse(fs.readFileSync(orderFile));
    let html = `<h2>Daftar Order</h2><table border="1" cellpadding="6">
    <tr><th>No</th><th>Order ID</th><th>Produk</th><th>Harga</th><th>Waktu</th><th>Nomor</th><th>QR</th><th>Status</th></tr>`;
    orders.forEach((o, i) => {
        html += `<tr>
            <td>${i + 1}</td>
            <td>${o.order_id}</td>
            <td>${o.product_name}</td>
            <td>Rp ${o.price.toLocaleString()}</td>
            <td>${o.time}</td>
            <td>${o.phone}</td>
            <td><a href="${o.qr_url}" target="_blank">QR</a></td>
            <td>${o.is_paid ? '✅ Lunas' : '❌ Belum'}</td>
        </tr>`;
    });
    html += '</table>';
    res.send(html);
});

app.listen(3000, () => console.log('✅ Server jalan di http://localhost:3000'));
