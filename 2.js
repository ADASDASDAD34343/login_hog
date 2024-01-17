const basics = (req, res) => {
    
    res.sendFile(__dirname + "/public/html/index.html");
}
const adminlogin = (req, res) => {

    res.sendFile(__dirname + "/public/html/adminlogin.html");
}   
module.exports ={
    basics,
    adminlogin,
};