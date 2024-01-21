const express = require('express');
const auth = require('../middleware/auth');
const { messageLimiter } = require('../middleware/limiters');

const router = express.Router();

router.get('/',auth,async(req,res) => {
    let list = req.user.DMList;

    for (let i = 0; i < list.length; i++) {
        list[i] = await prisma.user.findFirst({
            where:{
                username:list[i],
            },
            select:{
                id:true,
                username:true,
                profilePhoto:true
            }
        });
    };

    res.json({success:true,message:"Find!",find:list});
});

router.get('/:id',async(req,res) => {
    let {id} = req.params;

    let find = await prisma.user.findFirst({
        where:{
            username:id
        },
        select:{
            id:true,
            username:true,
            profilePhoto:true,
            noteText:true,
            noteEndDate:true,
            noteTrackId:true,
            createdAt:true,
            updatedAt:true,
        }
    });

    if(!find) return res.status(400).json({success:false,message:"User not found!"});

    let active = sockets.find((e) => e.user.id == find.id);
    if(!active) active = false;
    else active = true;

    find.active = active;

    res.json({success:true,message:"Find!",find});

    /*if(!req.user) return;
    
    let list = [find.username,...req.user.DMList.filter((e) => e != find.username)];

    if(list.length > 5) list = list.slice(0,-(list.length-10));

    await prisma.user.update({
        where:{
            id:req.user.id
        },
        data:{
            DMList:list
        }
    });*/
});

router.get('/:id/messages',auth,async(req,res) => {
    const messagesPerPage = 30;

    let {id} = req.params;

    let find = await prisma.user.findFirst({
        where:{
            username:id
        },
        select:{
            id:true,
            username:true
        }
    });

    if(!find) return res.status(400).json({success:false,message:"User not found!"});

    const {cursor} = req.query;

    let query = {
        where:{
            OR:[
                {
                    fromId:req.user.id,
                    toId:find.id
                },
                {
                    fromId:find.id,
                    toId:req.user.id
                }
            ]
        },
        orderBy:{
            createdAt:"desc"
        },
        take:messagesPerPage,
        select:{
            id:true,
            content:true,
            createdAt:true,
            from:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            },
            to:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            }
        }
    };

    if(cursor) {
        query["cursor"] = {id:cursor};
        query["skip"] = 1;
    }

    let messages = await prisma.message.findMany(query);

    res.json({success:true,message:"Find!",messages});
});

router.post('/:id/messages/create',auth,messageLimiter,async(req,res) => {
    let {id} = req.params;

    const {content} = req.body;
    if(!content || content.length > 1024) return res.status(400).json({success:false,message:"Body err!"});

    let find = await prisma.user.findFirst({
        where:{
            username:id
        },
        select:{
            id:true,
            username:true,
            DMList:true
        }
    });

    if(!find) return res.status(400).json({success:false,message:"User not found!"});

    let message = await prisma.message.create({
        data:{
            content,
            from:{
                connect:{
                    id:req.user.id
                }
            },
            to:{
                connect:{
                    id:find.id
                }
            }
        },
        select:{
            id:true,
            content:true,
            createdAt:true,
            from:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true,
                }
            },
            to:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            }
        }
    });

    sockets.filter((b) => b.user.id == find.id).forEach((sock) => {
        sock.emit("message",{
            channel:req.user.id,
            message
        });
    });

    res.status(201).json({success:true,message:"Created!",result:message});

    let list = [req.user.username,...find.DMList.filter((e) => e != req.user.username)];

    if(list.length > 10) list = list.slice(0,-(list.length-10));

    await prisma.user.update({
        where:{
            id:find.id
        },
        data:{
            DMList:list
        }
    });
});

router.post('/me/note/edit',auth,async(req,res) => {
    const {text,track_id} = req.body;

    if(text && text.length > 32) return res.status(400).json({success:false,message:"Max text length 32!"});
    if(track_id && track_id.length > 128) return res.status(400).json({success:false,message:"Max track_id length 128!"});

    await prisma.user.update({
        where:{
            id:req.user.id
        },
        data:{
            noteText:text ?? null,
            noteTrackId:track_id ?? null,
            noteEndDate:new Date(Date.now()+24*60*60*1000),
        }
    });

    res.json({success:true,message:"Updated!"});
});

module.exports = router;
