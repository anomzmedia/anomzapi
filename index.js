require('dotenv').config();
const express = require('express');
const bodyparser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');

const {PrismaClient} = require('@prisma/client');

const app = express();

const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server,{
    cors:"*"
});

globalThis.sockets = [];

io.of("api").addListener('connection',(s) => {
    s.on('disconnect',() => {
        sockets = sockets.filter((b) => b.id != s.id);
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
});

app.use(morgan('dev'));

globalThis.prisma = new PrismaClient();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:false
}))

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({extended:false}));

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

const PORT = process.env.PORT || 5000;
prisma.$connect().then(() => server.listen(PORT,() => console.log(`App listening on port ${PORT}`)));
