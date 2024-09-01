import express from "express";
import bodyParser from "body-parser";
import pg from "pg"
import axios from "axios"
import { render } from "ejs";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book-notes",
  password: "omer1377",
  port: 5432,
});


db.connect();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("views"));

app.get("/",(req,res)=>{
    res.render("login.ejs");
})

app.get("/CreateUser",(req,res)=>{
    res.render("createUser.ejs");
})
app.post("/CreateUser",async (req,res)=>{
    const username = req.body.username;
    const pass = req.body.password;
    const userExist = await db.query(`SELECT * FROM users WHERE username = '${username}'`);
    if(userExist.rows.length==0){
        if(pass.length<50){
            await db.query(`INSERT INTO users (username,password) VALUES ('${username}','${pass}')`)
            res.render("manageFeed.ejs",{username:username,posts:[]});
        }
        else{
            res.render("createUser.ejs",{error:"password too long"})
        }
    }
    else{
        res.render("createUser.ejs",{error:"username is taken"})
    }
})

app.post("/login",async (req,res)=>{
    const username = req.body.username;
    const pass = req.body.password;
    const userData = await db.query(`SELECT * FROM users WHERE username = '${username}' and password = '${pass}'`)
    const user = userData.rows;
    if(userData.length === 0){
        res.render("login.ejs",{error:"credentials are incorrect"});
    }
    else{
        const userFeed = await db.query(`SELECT * FROM booknotes WHERE userid = ${user[0].id}`);
        const feed = userFeed.rows;
        console.log(feed);
        res.render("manageFeed.ejs",{
            username:username,
            posts: feed
        });
    }
})



app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});