"use strict"
var express = require('express');
var app = express();
const favicon = require('serve-favicon');
const path = require('path');
//라우팅
const home = require(".")

// 'favicon.ico' 파일을 정확한 경로로 설정
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//파일 정적화


app.use("/",home);
app.use("/adminlogin",home);
var port = 3000;
app.listen(port, function() {
    console.log(`서버 열려습니다 포트는 ${port}`);
});
