const express = require('express');

const router = express.Router();

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

    if(!find) return res.status(404).json({success:false,message:"Not found!"});

    return res.json({success:true,message:"Find!",find});
});

router.get('/:id/messages',async(req,res) => {
    if(!req.user) return res.status(401).json({success:false,message:"Unauthorized!"});

    let {page} = req.query;
    if(!page) page = 0;
    page = Number(page);

    if(page < 0) page = 0;

    const messagesPerPage = 10;

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

    let messages = await prisma.message.findMany({
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
        skip:page*messagesPerPage,
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
    });

    return res.json({success:true,message:"Find!",messages});
});

router.post('/:id/messages/create',async(req,res) => {
    if(!req.user) return res.status(401).json({success:false,message:"Unauthorized!"});

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
        }
    });

    if(!find) return res.status(404).json({success:false,message:"Not found!"});

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
                    username:id
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

    return res.status(201).json({success:true,message:"Created!",result:message});
});

router.post('/me/note/edit',async(req,res) => {
    if(!req.user) return res.status(401).json({success:false,message:"Unauthorized!"});

    const {text,track_id} = req.body;

    if(text && text.length > 32) return res.status(400).json({success:false,message:"Max text length 32!"});
    if(track_id && track_id.length > 128) return res.status(400).json({success:false,message:"Max track_id length 128!"});

    await prisma.user.update({
        where:{
            id:req.user.id
        },
        data:{
            noteText:text ? text : null,
            noteTrackId:track_id ? track_id : null,
            noteEndDate:new Date(Date.now()+24*60*60*1000),
        }
    });

    return res.json({success:true,message:"Updated!"});
});

module.exports = router;
