const express = require('express');
const app = express();
const port = 3000;
const path = require('path'); // path 모듈을 추가
app.use(express.static(path.join(__dirname, 'public')));

// 루트 경로에 대한 요청 처리
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/html', 'index.html'))
});

// 서버를 지정한 포트에서 시작
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
