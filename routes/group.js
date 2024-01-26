const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');
const { messageLimiter } = require('../middleware/limiters');

const router = express.Router();

const limiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 2,
    standardHeaders: true,
    legacyHeaders: false,
    requestWasSuccessful: (req,res) => res.statusCode < 400,
    skipFailedRequests: true,
    message:{success:false,message:"You can create a maximum of 2 group in 1 day."},
});

router.post('/create',auth,limiter,async(req,res) => {
    let {name,users} = req.body;
    if(!name || !users || !Array.isArray(users)) return res.status(400).json({success:false,message:"Body err!"});

    users = users.filter((e) => e != req.user.id);

    if(users.length < 1) return res.status(400).json({success:false,message:"Body err!"});

    let group = await prisma.group.create({
        data:{
            name,
            usersId:[...users,req.user.id],
            messages:{
                create:{
                    content:"good chats",
                    system:true,
                }
            },
            ownerId:req.user.id,
        },
        select:{
            id:true,
            name:true,
        }
    });

    res.status(201).json({success:true,message:"Created!",group})
});

router.get('/all',auth,async(req,res) => {
    let find = await prisma.group.findMany({
        where:{
            usersId:{
                has:req.user.id
            }
        },
        select:{
            id:true,
            name:true,
            profilePhoto:true,
        },
        orderBy:{
            createdAt:"desc"
        }
    });

    res.json({success:true,find});
});

router.get('/:id',auth,async(req,res) => {
    const {id} = req.params;

    let find = await prisma.group.findFirst({
        where:{
            id,
            usersId:{
                has:req.user.id
            },
        },
        select:{
            id:true,
            name:true,
            profilePhoto:true,
            users:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            },
            ownerId:true
        }
    });

    if(!find) return res.status(400).json({success:false,message:"Not found!"});

    res.json({success:true,message:"Find!",find});
});

router.get('/:id/messages',auth,async(req,res) => {
    const {id} = req.params;

    const {cursor} = req.query;

    let query = {
        where:{
            group:{
                id,
                usersId:{
                    has:req.user.id
                }
            }
        },
        select:{
            id:true,
            content:true,
            from:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            },
            createdAt:true,
            system:true
        },
        take:30,
        orderBy:{
            createdAt:"desc"
        }
    };

    if(cursor) {
        query["cursor"] = {id:cursor};
        query["skip"] = 1;
    }

    let find = await prisma.message.findMany(query);
    
    res.json({success:true,find});
});

router.post('/:id/messages/create',auth,messageLimiter,async(req,res) => {
    const {id} = req.params;

    let find = await prisma.group.findFirst({
        where:{
            id,
            usersId:{
                has:req.user.id
            },
        },
        select:{
            id:true,
            usersId:true
        }
    });

    if(!find) return res.status(400).json({success:false,message:"Group not found!"});

    const {content} = req.body;
    if(!content) return res.status(400).json({success:false,message:"Body err!"});

    let message = await prisma.message.create({
        data:{
            content,
            fromId:req.user.id,
            groupId:id,
        },
        select:{
            id:true,
            content:true,
            groupId:true,
            from:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            }
        }
    });

    find.usersId.forEach((i) => {
        sockets.filter((b) => b.user.id == i && i != req.user.id).forEach((sock) => {
            sock.emit("message",{
                group:find.id,
                message
            });
        });
    });

    res.json({success:true,message:"Created!",message});
});

module.exports = router;
