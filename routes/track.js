const express = require('express');
const {default:axios} = require('axios');

const router = express.Router();

router.get('/:id',async(req,res) => {
    try {
        let {data} = await axios.post("https://accounts.spotify.com/api/token",{
            grant_type:"client_credentials",
            client_id:process.env.SPOTIFY_CLIENT_ID,
            client_secret:process.env.SPOTIFY_CLIENT_SECRET,
        },{
            headers:{
                "Content-Type":"application/x-www-form-urlencoded"
            }
        });
    
        let {access_token,token_type} = data;
        let token = token_type + " " + access_token;
    
        let r = await axios.get(`https://api.spotify.com/v1/tracks/${req.params.id}`,{
            headers:{
                Authorization:token
            }
        });
    
        data = r.data;
    
        res.redirect(data.preview_url);
    } catch (error) {
        res.status(500).json({success:false});
    }
});

module.exports = router;
