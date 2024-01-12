const express = require('express');
const rateLimit = require('express-rate-limit');

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

router.post('/create',limiter,async(req,res) => {
    const {name,users} = req.body;
    if(!name || !users || !Array.isArray(users)) return res.status(400).json({success:false,message:"Body err!"});

    let group = await prisma.group.create({
        data:{
            name,
            usersId:users,
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

module.exports = router;
