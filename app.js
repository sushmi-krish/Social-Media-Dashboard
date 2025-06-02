const express = require('express');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your_secret_key';

mongoose.set('strictQuery', false);

const uri =  "mongodb://root:cUvedV7NJfzXUwgFj2rFAtxX@172.21.57.136";
mongoose.connect(uri,{'dbName':'SocialDB'});

const User = mongoose.model('User', { username: String, email: String, password: String });
const Post = mongoose.model('Post', { userId: mongoose.Schema.Types.ObjectId, text: String });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: SECRET_KEY, resave: false, saveUninitialized: true, cookie: { secure: false } }));


// authenticateJWT Function code .

function authenticateJWT(req,res,next){
    //Get token from session
    const token = req.session.token;

    //If no token , return 401 Unauthorized
    if(!token) return res.status(401).json({message:'Unauthorized'});

    try{
        //Verify token 
        const decoded = jwt.verify(token,SECRET_KEY);

        //Attach user data to request
        req.user = decoded;

        //Continue to the next midleware
        next();
    }catch(error){
        res.status(401).json({message: 'Invalid token'})
    }
}

// requireAuth Function code.

function requireAuth(req, res, next){
    const token = req.session.token; //Retrive token

    if(!token) return res.redirect('/login') //If no token ,redirect to login page

    try{
        const decoded = jwt.verify(token,SECRET_KEY);//verify the secret key by using token
        req.user = decoded //Attach decoded user data to the request
        next();//pass the control to the next midddleware/route
    }catch(error){
        return res.redirect('/login')//If token fails redirect to the login page
    }
}


//routing HTML files.

app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/register',(req,res)=> res.sendFile(path.join(__dirname,'public','register.html')))
app.get('/login',(req,res)=> res.sendFile(path.join(__dirname,'public','logic.html')));
app.get('/post',requireAuth,(req,res)=>res.sendFile(path.join(__dirname,'public','post.html')));
app.get('/index', requireAuth, (req,res)=>res.sendFile(path.join(__dirname,'public','index.html'),{username: req.user.username}));

// user registration code .
app.post('/register', async(req, res)=>{
    const {username, email, password} = req.body;

    try{
        //Check if the user already exists
        const existingUser = await User.findOne({$or: [{username},{email}]});

        if(existingUser) return res.status(400).json({message: 'User already exit'});
     
        //Create and save the new user
        const newUser = new User({ username, email, password});
        await newUser.save();

        //Generate JWT token and store in session 
        const token = jwt.sign({userId: newUser._id,username: newUser.username}, SECRET_KEY, { expiresIn: '1h'})
        req.session.token = token;

        //Respond with success message
         res.redirect(`/index?username=${newUser.username}`);
    }catch(error){
        console.log(error);
        //Handle the errors;
        res.status(500).json({message: 'Internal Server Error'});
    }
});

//  user login .
app.post('/login',async(req,res)=>{
    const {username,password} = req.body;
    try{
        //Check if the user exits with the provided Credentials
        const user = await User.findOne({username,password});

        if(!user) return res.status(401).json({message:'Invaild credentials'});

        //Generate JWT token and store in session 
        const token = jwt.sign({userId: user._id,username:user.username},SECRET_KEY,{expiresIn: '1h'})
        req.session.token = token;

        //Respond with the success message 
    res.redirect(`/index?username=${user.username}`);
    } catch(error){
        console.log(error);
        //Handle the server error 
        res.status(500).json({message:'Internal sever Error'})
    }
});

//post creation .
app.post('/post',authenticateJWT,async(req,res) => {
    const {text} = req.body;
//Validate post content
if(!text || typeof text !== 'string'){
    return res.status(400).json({message:'Please provide valid post content'});

}
try{
    //Create and save new post with userId
    const newPost = new Post({userId: req.user.userId,text});
    await newPost.save();
    res.status(201).json({message:'Post created successfully ',post:newPost})

}catch(error){
    console.log(error)
//Handle the error 
res.status(400).json({message:'Internal storage Error'})
}

});

//Get all Posts for the authenticated User

app.get('/posts', authenticateJWT, async(req,res)=>{
    try{
        //Fetch posts for the logged-in user
        const posts = await Post.find({userId: req.user.userId})
        res.json({posts});
    }catch(error){
        console.log(error);
        res.status(500).json({message: 'Internal Service Error'})
    }
});

//post updation 
app.put('/posts/postId',authenticateJWT,async(req,res)=>{
    const postId = req.params.postId;
    const{text} = req.body;

    try{
        //Find and update the post, ensuring its owned by authenticate user
        const post = await Post.findOneAndUpdate(
            {_id: postId, userId: req.user.userId},
            {text},
            {new: true}//Return updated post
        );

        //Return error if post not found
        if(!post) return res.status(404).json({message:"Page is not found"})

        //else page found successfully
        res.json({message: 'Post Updated Successfully',updatedPost: post});
    } catch(error){
        console.log(error);
        res.status(500).json({message:'Internal Service Error'})
    }
})

// Insert your post deletion code here.
app.delete('/posts/:postId', authenticateJWT, async(req,res)=>{
    const postId = req.params.postId;

    try{
        //Find and delete the post , ensuring it's owned by the suthenticated user
        const post = await Post.findByIdAndDelete({_id:postId, userId: req.user.userId})

        //Return error if post not found
        if(!post) return res.status(404).json({message:'Page Not Found'});

        res.json({messgae:'Post deletd successfully', deletedPost: post});
    }catch(error){
        console.log(error);
        res.status(500).json({message: `Internal Service Error`})
    }
});

app.get('/logout',(req,res)=>{
    req.session.destroy((err)=>{
        if(err) console.log(err);//Log any session destruction error
        res.redirect('/login');//Redirect to login page after logout
    })
})

// Insert your user logout code here.

app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
