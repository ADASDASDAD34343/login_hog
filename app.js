const express = require('express');
const app = express();
const favicon = require('serve-favicon');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const nodemailer = require('nodemailer');
const multer = require('multer');
const linkify = require('linkify-it')();
require('dotenv').config();

const port = 3000;

app.use('/html', express.static('public/html'));
app.use('/icon', express.static('icon'));
app.use('/js', express.static('js'));
app.use('/ejs', express.static('views'));
app.use('/ejs/css', express.static('views/css'));

// MySQL 연결 설정
const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// 세션 저장소 설정
const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
});

// 이미지 업로드 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'image-' + uniqueSuffix + '.' + file.originalname.split('.').pop());
    }
});

const upload = multer({ storage: storage });

// 이메일 전송을 위한 transporter 생성
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
    }
});

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    store: sessionStore
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// 회원가입 화면
app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/html', 'signup.html'));
});

// 로그인 화면
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/html', 'login.html'));
});

// 홈 화면
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/html', 'index.html'));
});

// 이메일 인증 요청 처리
app.post('/send-verification', async (req, res) => {
    const { email } = req.body;

    // 6자리의 랜덤 인증 코드 생성 (000000부터 999999까지의 랜덤)
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const mailOptions = {
        from: 'seumaetik@gmail.com',
        to: email,
        subject: '이메일인증',
        text: `Your verification code is: ${verificationCode}`
    };

    try {
        // 클라이언트에게 인증 코드를 전달
        res.json({ verificationCode });

        // DB에 인증 코드 저장
        await connection.query('INSERT INTO email_verifications (email, verification_code) VALUES (?, ?)', [email, verificationCode]);

        // 이메일 전송
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
});

// 회원가입 요청 처리
app.post('/signup', async (req, res) => {
    const { username, email, password, verificationCode } = req.body;

    try {
        // 중복 아이디 확인
        const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            return res.status(400).json({ error: 'Username is already taken' });
        }

        // 이메일 인증 코드 확인
        const [verificationRows] = await connection.query('SELECT * FROM email_verifications WHERE email = ? AND verification_code = ?', [email, verificationCode]);

        if (verificationRows.length === 0) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // 비밀번호 해싱
        const hashedPassword = await bcrypt.hash(password, 10);

        // 새로운 사용자를 MySQL에 추가
        await connection.query('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);

        // 사용된 인증 코드는 삭제
        await connection.query('DELETE FROM email_verifications WHERE email = ?', [email]);

        req.session.user = {
            username,
            email,
            role: 'user'
        };

        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 로그인 요청 처리
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // 사용자 확인
        const [rows] = await connection.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(400).json({ error: 'User not found' });
        }

        // 비밀번호 비교
        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: 'Incorrect password' });
        }

        // 사용자 정보를 세션에 저장
        req.session.user = {
            id: user.id,
            username,
            email: user.email,
            role: user.role
        };

        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 게시물 목록 조회 (GET 요청)
app.get('/posts', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/html', 'post.html'));
});

// 게시물 생성 요청 처리
app.post('/create_post', upload.single('image'), async (req, res) => {
    // 세션에서 현재 로그인한 사용자의 정보를 가져오기
    const user = req.session.user;

    // 세션에 사용자 정보가 없거나 ID가 없으면 오류 처리
    if (!user || !user.id) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id: user_id } = user;
    const { title, content } = req.body;
    const image = req.file ? req.file.filename : null; // 이미지 파일명

    try {
        // Post 모델을 사용하여 데이터베이스에 새로운 게시물 생성
        await connection.query('INSERT INTO posts (user_id, title, content, image) VALUES (?, ?, ?, ?)', [user_id, title, content, image]);
        res.json({ message: 'Post created successfully' });
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/SD', async (req, res) => {
    try {
        // 게시물 목록을 데이터베이스에서 가져오기
        const [posts] = await connection.query('SELECT * FROM posts');

        // 가져온 게시물 목록을 EJS 파일에 전달하여 렌더링
        res.render('postList', { posts });
    } catch (error) {
        console.error('Error fetching posts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
