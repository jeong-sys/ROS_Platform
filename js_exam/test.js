// 할일, 날짜 html로 입력시 terminal에서 확인 가능

const express = require('express');
const path = require('path'); // path 모듈 사용
const app = express();

// JSON과 URL 인코딩된 폼 데이터를 파싱하기 위한 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(8080, function(){
    console.log('listening on 8080');
});

// HTML 파일을 서비스하는 라우트
app.get('/write', function(req, res){
    res.sendFile(path.join(__dirname, 'test.html'));
});

// POST 요청을 처리하는 라우트
app.post('/add', function(req, res) {
    res.send('전송 완료');
    console.log('할일: ', req.body.title);
    console.log('날짜: ', req.body.date);
});
