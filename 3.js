"use strict"
const express = require("express");
const routes = express.Router();
const ctrl = require("./home.ctrl")
routes.get("/", ctrl.basics)
routes.get("/adminlogin", ctrl.adminlogin)

routes.use('/static', express.static('public/css'));
routes.use('/html', express.static('public/html'));
routes.use('/icon', express.static('icon'));
routes.use('/js', express.static('js'));
routes.use('/ejs', express.static('views'));
routes.use('/ejs/css', express.static('views/css'));
module.exports = routes;