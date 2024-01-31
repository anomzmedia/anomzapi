require('dotenv').config();
const express = require('express');
const bodyparser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');
const fileUpload = require('express-fileupload');
const { default: ImgurClient } = require('imgur');

const {PrismaClient} = require('@prisma/client');

const app = express();

app.use(fileUpload({
 useTempFiles:false,
 abortOnLimit:true,
 limits:{
    fileSize:10485760
 },
}));

const server = http.createServer(app);

const { Server } = require("socket.io");
globalThis.io = new Server(server,{
    cors:"*"
});

//globalThis.sockets = [];
//globalThis.voices = [];

globalThis.imgurClient = new ImgurClient({
    clientId: process.env.IMGUR_CLIENT_ID,
    clientSecret: process.env.IMGUT_CLIENT_SECRET,
    //refreshToken: process.env.IMGUR_REFRESH_TOKEN,
});

globalThis.sockets = {};

io.use((sock,next) => {
    let token = sock.handshake.auth?.token;
    if(!token) return next(new Error('Authentication error'));

    jwt.verify(token,process.env.SECRET,async(err,decoded) => {
        if(err) return next(new Error('Authentication error'));

        let find = await prisma.user.findFirst({
            where:{
                id:decoded.user.id
            },
            select:{
                id:true,
                username:true,
                profilePhoto:true,
                noteText:true,
                noteTrackId:true,
                noteEndDate:true,
                createdAt:true,
                updatedAt:true,
            }
        })

        if(!find) return next(new Error('Authentication error'));

        sock.user = find;
        next();
    });
}).on('connection',(sock) => {
    sockets[sock.user.id] = sock.id;

    sock.on('disconnect',() => {
        delete sockets[sock.user.id]
    });

    sock.on('ping',(callback) => {
        if(!callback || typeof(callback) != "function") return;
        callback();
    });
});

/*io.addListener('connection',(s) => {
    s.on('disconnect',() => {
        sockets = sockets.filter((b) => b.id != s?.id);
        voices = voices.filter((b) => b.from != s?.user?.id);
    });

    s.on('voicejoin',(data) => {
        if(!s.user) return;

        if(!data) return;

        voices = voices.filter((e) => e.from != s.user.id && e.to != data);

        voices.push({from:s.user.id,to:data});
    });

    s.on('voiceleft',(data) => {
        if(!s.user) return;

        if(!data) return;

        voices = voices.filter((e) => e.from != s.user.id && e.to != data);
    });

    s.on('voice',(data) => {
        if(!s.user || !data || !data.to || !data.buffer) return;

        let find = sockets.find((e) => e.user.id == data.to);
        let find1 = voices.find((e) => e.from == s.user.id && e.to == data.to);
        let find2 = voices.find((e) => e.to == s.user.id && e.from == data.to);

        if(!find || !find1 || !find2) return;

        find.emit('voice',data.buffer);
    });

    s.on('login',(b) => {
        try {
            if(!b) return;
            let c = jwt.verify(b,process.env.SECRET);
            s.user = c.user;
            sockets.push(s);
        } catch (error) {
            
        }
    });

    s.on("ping", (callback) => {
        callback();
    });
});*/

app.use(morgan('dev'));

globalThis.prisma = new PrismaClient();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:false
}))

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:false}));

app.set('trust proxy',1);

app.use(async(req,res,next) => {
    try {
        let authorization = req.headers.authorization;
        if(!authorization) return next();

        let decode = jwt.verify(authorization,process.env.SECRET);

        let find = await prisma.user.findFirst({
            where:{
                id:decode.user.id
            },
            select:{
                id:true,
                username:true,
                password:true,
                profilePhoto:true,
                createdAt:true,
                updatedAt:true,
                noteText:true,
                noteEndDate:true,
                noteTrackId:true,
                DMList:true
            }
        });

        if(!find || find.password != decode.user.password || Date.now() > decode.end) return next();

        req.user = find;

        next();
    } catch (error) {
        next();
    }
});

const auth = require('./routes/auth');
const post = require('./routes/post');
const user = require('./routes/user');
const track = require('./routes/track');
const group = require('./routes/group');

app.use('/api/auth',auth);
app.use('/api/post',post);
app.use('/api/user',user);
app.use('/api/track',track);
app.use('/api/group',group);

app.get('/api/stats',async(req,res) => {
    let posts = await prisma.post.count();
    let users = await prisma.user.count();
    let messages = await prisma.message.count();
    res.json({posts,users,messages});
});

const PORT = process.env.PORT || 5000;
prisma.$connect().then(() => server.listen(PORT,() => console.log(`App listening on port ${PORT}`)));
