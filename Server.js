//* ~ console.log = something sent to the server for debugging purposes 

//used to set up dependencies for use on the server.
//Currently using:
//~ Express for changing "pages" and other real time things
//~ mysql for sql statements and reading/updating/inserting into database
//~ http for setting up the server/application
//~ io for setting up socket.io. Used to realtime update information and handle data importing/exporting to/from server
//~ bodyParser is used for handling data transfer via links and similar
//~ nodemailer is used for email

var express = require('express');
var app = express();
var mysql = require('mysql');
var server = require('http').createServer(app);
var io = require ('socket.io')(server);
var bodyParser = require('body-parser');
var nodemailer = require("nodemailer");
var multer  = require('multer');
app.use(bodyParser({uploadDir:'./files/temp'}));
var upload = multer({ dest: 'uploads/' });
var fs = require('fs');
//var im = require('imagemagick');
var type = upload.single('file');

app.post('/upload', type, function (req,res) {
    console.log(req.NName)
  /** When using the "single"
      data come in "req.file" regardless of the attribute "name". **/
  var tmp_path = req.file.path;

  /** The original name of the uploaded file
      stored in the variable "originalname". **/
  var target_path = 'uploads/'+req.NName+'.jpg';

  /** A better way to copy the uploaded file. **/
  var src = fs.createReadStream(tmp_path);
  var dest = fs.createWriteStream(target_path);
  var delTemp = fs.unlink(tmp_path);
  src.pipe(dest);
  src.on('end', function() { console.log("complete"); });
  src.on('error', function(err) { console.log(err); });

});

//Necessary for email
var smtpTransport = nodemailer.createTransport("SMTP",{
host: 'email.domain.org',
port: 25,
domain:'domain.org',
tls: {ciphers:'SSLv3'}
//auth: {
//user: "thing@email.org",
//pass: "pass"
//}
});

// Keeps track of all the users online (mainly for use in chat systems, but could be useful for responding to [or commenting on] Items)
var users = [];

//Links mySQL database to the Node server
var db = mysql.createPool({
    host: 'localhost', 
    user: 'root', 
    password: 'pass', 
    database: 'rentingspecialcollections'
    //port: 3000;
});

//sets up the socket variable
//The socket variable is used to pass and store data on the client side for use in data getting and setting on the server end.
//This will be mainly used for rememebering who's logged in. 
var socket;

//This connects to the service that sends and returns live data
io.on('connection', function(socket){
    //Lets the admin know when a user is connected. Only states when a connection is made to the login/landing page.
    console.log('A user connected');    
    
    socket.on('check_In', function(Item){
        console.log(Item);
        check_In(Item, function(res){
            if(res){
                //io.emit('refresh feed', msg);
                //console.log('refresh feed, status ');
            } else {
                io.emit('error');
                console.log('there was an error under socket.on check_In');
            }
        });
    });
    
    socket.on('check_Out', function(Item){
        console.log(Item);
        check_Out(Item, function(res){
            if(res){
                //io.emit('refresh feed', msg);
                //console.log('refresh feed, status ');
            } else {
                io.emit('error');
                console.log('there was an error under socket.on check_Out');
            }
        });
    });
    
    socket.on('create_Item', function(Item){
        //console.log(Item);
        create_Item(Item, function(res){
            if(res){
                if (res != "true"){
                    io.emit('refresh', res);
                    console.log("Res:" + res);
                }else{
                    io.emit('refresh',"s");
                    console.log('success, finishing create item');
                }
            } else {
                io.emit('error');
                io.emit('refresh',"f");
                console.log('there was an error under socket.on create_Item');
            }
        });
    });
    
    socket.on('get_Card', function(v_id){
        console.log("cardRet "+v_id);
        socket.emit('cardRet', v_id);
    });
    
    
    //disconnects link to server to prevent too many connections to the server
    socket.on('disconnect', function() {
     //Code inserted in here will run on user disconnect. 
     console.log('A user has disconnected');
        socket.disconnect();
        
    });
    
    

});

//used to start and run the server
server.listen(3004, function(){
    console.log("listening on *:3004");
});

app.use(express.static('files'));
app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());



app.get('/DB', function(req, res){
    db.query('SELECT * FROM rentingspecialcollections.rsc', function(err, rows)
                     {
        if (err) console.log(err);
        res.send(JSON.stringify(rows));

    });
});

app.get('/GGet', function(req, res){
    db.query('SELECT * FROM rentingspecialcollections.rsc', function(err, rows)
                     {
        if (err) console.log(err);
        var output = [];
        //console.log(rows);
        
        function f_groupExists(group) {
          return output.some(function(el) {
            return el.v_Group === group;
          }); 
        }
        
        for (i = 0; i < rows.length; i++) {
            console.log(f_groupExists(rows[i].v_Group));
            if(f_groupExists(rows[i].v_Group) == false){
                console.log("not logged "+ rows[i].v_Group);
                
               output.push({v_Group: rows[i].v_Group, v_id: rows[i].v_id});    
            }
        }
        console.log(output);
        res.send(JSON.stringify(output));

    });
});

//In this version of app.get, the '/' sets the home page when you access the URL/link. 
app.get('/', function(req, res){
        res.sendFile(__dirname + '/index.html');
});

//function for adding a new Item and sending emails
var check_In = function (Item, callback){
    
    console.log("connecting check_In");
    db.getConnection(function(err, connection){
        if(err){
            console.log('there was an issue in at the check_In function');
            connection.release();
            callback(false);
            return;
        }
            
        console.log("connected");
        //item, set patron id to blank
        var ReqVar = [Item.v_Item];
        console.log(ReqVar);
        //update
        //
        //"INSERT INTO  ( `v_Location`) VALUES ( ? )"
        connection.query("UPDATE `rentingspecialcollections`.`rsc` SET `v_Status`='In' WHERE `v_id`= ?", ReqVar, function(err, rows){
            console.log("sending");
            if(!err) {
                callback(true);
            }
        });
        
        connection.on('error', function(err) {
            console.log("insert issue found");
            callback(false);
            return;
        });
        
        
        connection.release();
        });
};

var check_Out = function (Item, callback){
    
    console.log("connecting check_In");
    db.getConnection(function(err, connection){
        if(err){
            console.log('there was an issue in at the check_In function');
            connection.release();
            callback(false);
            return;
        }
            
        console.log("connected");
        //Item, patron ID
        var ReqVar = [Item.v_IDPatron, Item.v_Item];
        console.log(ReqVar);
        connection.query("UPDATE `rentingspecialcollections`.`rsc` SET `v_Status`= ? WHERE `v_Barcode`= ?", ReqVar, function(err, rows){
            console.log("sending");
            if(!err) {
                callback(true);
            }
        });
        
        connection.on('error', function(err) {
            console.log("insert issue found");
            callback(false);
            return;
        });
        
        console.log("Finished")
        connection.release();
        });
};

var create_Item = function (Item, callback){
    
    console.log("connecting create_Item");
    db.getConnection(function(err, connection){
        if(err){
            console.log('there was an issue in at the create_Item function');
            connection.release();
            callback(false);
            return;
        }
            
        console.log("connected");
        //Item, patron ID
        //console.log(Item);
        if (Item.v_ID == "" || Item.v_ID == undefined)
        {
            var errMess = "No ID";
            console.log(errMess);
            callback(errMess);
            return;
        }
        if (Item.v_Desc == "" || Item.v_Desc == undefined)
        {
            var errMess = "No Desc";
            console.log(errMess);
            callback(errMess);
            return;
        }
        if (Item.v_Group == "" || Item.v_Group == undefined)
        {
            var errMess = "No Group";
            console.log(errMess);
            callback(errMess);
            return;
        }
        if (Item.v_Barcode == "" || Item.v_Barcode == undefined)
        {
            var errMess = "No Barcode";
            console.log(errMess);
            callback(errMess);
            return;
        }
        if (Item.v_Manufacturer == "" || Item.v_Manufacturer == undefined)
        {
            var errMess = "No Manurfacturer";
            console.log(errMess);
            callback(errMess);
            return;
        }
        if (Item.nFile == "" || Item.nFile == undefined)
        {
            var errMess = "No File";
            console.log(errMess);
            callback(errMess);
            return;
        }

        var ReqVar = [Item.v_ID, Item.v_Desc, Item.v_Group, Item.v_Barcode, Item.v_Manufacturer];
        //v_Image v_ID v_Desc v_Group
        console.log(ReqVar);
        connection.query("INSERT INTO `rentingspecialcollections`.`rsc` ( `v_iD`, `v_Description`, `v_Group`, v_Status, v_Barcode, v_Manufacturer) VALUES (? , ?, ?, 'In', ?, ?)", ReqVar, function(err, rows){
            console.log("sending");
            if (!err){
                
                    var data = Item.nFile;
                    //console.log(Item.nFile);

                    function decodeBase64Image(dataString) {
                      var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
                        response = {};

                      if (matches.length !== 3) {
                        return new Error('Invalid input string');
                      }

                      response.type = matches[1];
                      response.data = new Buffer(matches[2], 'base64');

                      return response;
                    }

                    var imageBuffer = decodeBase64Image(data);
                    /*console.log(imageBuffer);*/
                    // { type: 'image/jpeg',
                    //   data: <Buffer 89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52 00 00 00 b4 00 00 00 2b 08 06 00 00 00 d1 fd a2 a4 00 00 00 04 67 41 4d 41 00 00 af c8 37 05 8a e9 00 00 ...> }

                    fs.writeFile('files/assets/img/'+Item.v_ID+'.jpg', imageBuffer.data, function(err) {
                        if(err){
                            console.log("failed to write image");
                        }else{
                            callback("true"); 
                            console.log("succesfully wrote image");
                        }
                    });
                
                console.log("Finished fs.writefile portion")
                    
                } else{
                    console.log(err);
                }
        });
        
        connection.on('error', function(err) {
            console.log("insert issue found");
            callback(false);
            return;
        });
        
        
        connection.release();
        });
};
