// 소켓 통신

const net = require('net');

const server = net.createServer((socket) => {
    console.log('---- 클라이언트 연결 ----');

    socket.on('data', (data) => {
        console.log('받은 데이터: ' + data);
        socket.write(data);
    });

    socket.on('end', () => {
        console.log('클라이언트 연결 종료.');
    });

    socket.on('error', (err) => {
        console.log('에러 발생:', err.message);
    });
});

server.listen(8080, () => {
    console.log('서버 대기');
});
