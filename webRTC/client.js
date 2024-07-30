const net = require('net');
const readline = require('readline');

const client = net.createConnection({ port: 8080 }, () => {
    console.log('----- 서버 연결 -----');
});

client.on('data', (data) => {
    console.log('서버가 받은 데이터: ' + data);
});

client.on('end', () => {
    console.log('----- 서버 연결 종료 -----');
});

client.on('error', (err) => {
    console.log('에러 발생:', err.message);
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    client.write(input);
});
