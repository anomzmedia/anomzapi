const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middleware/auth');

const router = express.Router();

const limiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    requestWasSuccessful: (req,res) => res.statusCode < 400,
    skipFailedRequests: true,
    message:{success:false,message:"You can create a maximum of 10 posts in 1 day."},
});

const commentLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    requestWasSuccessful: (req,res) => res.statusCode < 400,
    skipFailedRequests: true,
    message:{success:false,message:"You can create a maximum of 10 comments in 1 day."},
});

router.get('/all',async(req,res) => {
    const postPerpage = 30;

    const {cursor} = req.query;

    let query = {
        select:{
            id:true,
            content:true,
            author:{
                select:{
                    id:true,
                    username:true,
                    profilePhoto:true
                }
            },
            createdAt:true,
            updatedAt:true
        },
        orderBy:{
            createdAt:"desc"
        },
        take:postPerpage,
    }

    if(cursor){
        query["skip"] = 1;
        query["cursor"] = {id:cursor};
    }

    let posts = await prisma.post.findMany(query);

    posts.forEach((p) => p.content = p.content.slice(0,128));

    res.json({success:true,message:"Find!",posts});
});

router.post('/create',auth,limiter,async(req,res) => {
    const {content} = req.body;
    if(!content || content.length > 1024) return res.status(400).json({success:false,message:"Body err!"});

    try {
        let post = await prisma.post.create({
            data:{
                content,
                author:{
                    connect:{id:req.user.id}
                }
            },
            select:{
                id:true,
                content:true,
                author:{
                    select:{
                        id:true,
                        username:true,
                        profilePhoto:true
                    }
                },
                createdAt:true,
                updatedAt:true
            }
        })
    
        res.status(201).json({success:true,message:"Created!",post});
    } catch (error) {
        res.status(500).json({success:false,message:error.message});
    }
});

router.get('/:id',async(req,res) => {
    const {id} = req.params;

    try {
        let find = await prisma.post.findFirst({
            where:{
                id
            },
            select:{
                id:true,
                content:true,
                author:{
                    select:{
                        id:true,
                        username:true,
                        profilePhoto:true
                    }
                },
                createdAt:true,
                updatedAt:true
            }
        });
    
        if(!find) return res.status(400).json({success:false,message:"Post not found!"});
    
        res.json({success:true,message:"Find!",find});
    } catch (error) {
        res.json({success:false,message:error.message});
    }
});

router.get('/:id/comments',async(req,res) => {
    const {id} = req.params;

    const commentPerpage = 30;

    const {cursor} = req.query;

    try {
        let query = {
            select:{
                id:true,
                content:true,
                author:{
                    select:{
                        id:true,
                        username:true,
                        profilePhoto:true,
                    }
                },
                createdAt:true,
                updatedAt:true
            },
            where:{
                postId:id
            },
            orderBy:{
                createdAt:"desc"
            },
            take:commentPerpage,
        }

        if(cursor){
            query["skip"] = 1;
            query["cursor"] = {id:cursor};
        }

        let find = await prisma.comment.findMany(query);

        res.json({success:true,message:"Find!",find});
    } catch (error) {
        res.status(500).json({success:false,message:error.message});
    }
});

router.post('/:id/comments/create',auth,commentLimiter,async(req,res) => {
    const {id} = req.params;
    const {content} = req.body;

    if(!content || content.length > 512) return res.status(400).json({success:false,message:"Body err!"});

    try {
        let find = await prisma.post.findFirst({
            where:{
                id
            },
            select:{
                id:true
            },
        });
    
        if(!find) return res.status(400).json({success:false,message:"Post not found!"});

        let comment = await prisma.comment.create({
            data:{
                content,
                author:{
                    connect:{id:req.user.id}
                },
                post:{
                    connect:{id}
                },
            },
            select:{
                id:true,
                content:true,
                author:{
                    select:{
                        id:true,
                        username:true,
                        profilePhoto:true
                    }
                },
                createdAt:true,
            }
        })
    
        res.status(201).json({success:true,message:"Created!",comment});
    } catch (error) {
        res.status(500).json({success:false,message:error.message});
    }
});

module.exports = router;
