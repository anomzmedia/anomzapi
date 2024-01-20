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
        },
        select:{
            id:true,
            name:true,
            _count:{
                select:{
                    users:true
                }
            }
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
            users:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            }
        }
    });

    res.json({find});
});

router.get('/:id',async(req,res) => {
    const {id} = req.params;

    let find = await prisma.group.findFirst({
        where:{
            id,
            usersId:{
                has:req.user.id
            },
        },
        select:{
            name:true,
            users:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            }
        }
    });

    res.json({find});
});

router.get('/:id/messages',async(req,res) => {
    const {id} = req.params;

    let find = await prisma.group.findFirst({
        where:{
            id,
            usersId:{
                has:req.user.id
            },
        },
        select:{
            name:true,
            users:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            },
            messages:{
                select:{
                    id:true,
                    content:true,
                    from:{
                        select:{
                            id:true,
                            username:true,
                            profilePhoto:true,
                        }
                    }
                }
            }
        }
    });

    res.json({find});
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
            id:true
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

    res.json({success:true,message:"Created!",message});
});

module.exports = router;
