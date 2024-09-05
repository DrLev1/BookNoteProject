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

async function GetSearchResults(query){
    const usernameQuery = await db.query(`SELECT booknotes.id,booktitle,userid, paragraph,date,picurl,rating,username
        FROM booknotes INNER JOIN users 
        ON userid = users.id 
        WHERE booktitle = '${query}'`);
    const titleQuery = await db.query(`SELECT booknotes.id,booktitle,userid, paragraph,date,picurl,rating,username
    FROM booknotes INNER JOIN users 
    ON userid = users.id 
    WHERE username = '${query}'`);
    const arr1 = usernameQuery.rows;
    const arr2 = titleQuery.rows;
    const merged = arr1.concat(arr2);
    const unique = merged.filter((item, index, self) =>
        index === self.findIndex((t) => (
            t.id === item.id
        ))
    );
    return unique;
}
async function GetFeed(id){
    const usernameQuery = await db.query(`SELECT username FROM users WHERE id = ${id}`);
    const userFeedQuery = await db.query(`SELECT * FROM booknotes WHERE userid = ${id}`);
    const username = usernameQuery.rows[0].username;
    const feed = userFeedQuery.rows;
    return [username,feed];
}

async function GetBookCover(bookTitle) {//function to get the cover of a book acording to its name
    const apiKey = 'fuck yop';
    const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(bookTitle)}&key=${apiKey}`;
    
    try {
      const response = await axios.get(url); // Wait for the API response
      if (response.data.items && response.data.items.length > 0) {
        const book = response.data.items[0];
        const coverImage = book.volumeInfo.imageLinks?.thumbnail; // Get the cover image if available
        return coverImage ? coverImage : -1; // Return cover image or -1 if not found
      }
      return -1; // Return -1 if no items are found
    } catch (error) {
      console.error('Error fetching data:', error);
      return -1; // Return -1 on error
    }
  }

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
            const user = await db.query(`SELECT id FROM users WHERE username = '${username}'`);
            const id = user.rows[0].id;
            res.render("manageFeed.ejs",{username:username,posts:[],id: id});
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
    if(user.length === 0){
        res.render("login.ejs",{error:"credentials are incorrect"});
    }
    else{
        const userFeed = await db.query(`SELECT * FROM booknotes WHERE userid = ${user[0].id}`);
        const feed = userFeed.rows;
        const id = user[0].id;
        res.render("manageFeed.ejs",{
            username:username,
            posts: feed,
            id: id
        })
    }
})



app.get('/newCard/:id', (req, res) => {
    const id = req.params.id;
    res.render("createNew.ejs",{id:id})
});

app.post('/newCard/:id', async (req, res) => {//create a new post
    const id = req.params.id;
    const data = req.body;
    const title = data.title;
    const cover = await GetBookCover(title);
    const date = data.date;
    const rating = data.rating;
    const bookNote = data.BookNote;
    await db.query(`INSERT INTO booknotes (BookTitle,UserId,paragraph,date,picurl,rating) VALUES ('${title}',${id},'${bookNote}','${date}','${cover}',${rating})` );
    const essentialsFeed = await GetFeed(id);
    res.render("manageFeed.ejs",{
        id:id,
        username:essentialsFeed[0],
        posts:essentialsFeed[1]
    });

}); 


app.get('/edit-card/user/:id/post/:postId', async (req, res) => {
    const id = req.params.id;
    const postId = req.params.postId;
    const postQuery = await db.query(`SELECT * FROM booknotes WHERE id = ${postId}`)
    const post = postQuery.rows[0];
    res.render("editFeed.ejs",{id:id,post:post});
});

app.post('/edit-card/user/:id/post/:postId', async (req, res) => {
    const id = req.params.id;
    const postId = req.params.postId;
    const data = req.body;
    const title = data.title
    const bookNote = data.BookNote;
    const date = data.date;
    const rating = data.rating;
    const cover = await GetBookCover(title)
    db.query(`UPDATE booknotes
        SET BookTitle = '${title}',paragraph='${bookNote}',date='${date}',picurl='${cover}',rating=${rating}
        WHERE id = ${postId}`);
    const essentialsFeed = await GetFeed(id);
        res.render("manageFeed.ejs",{
            id:id, 
            username:essentialsFeed[0],
            posts:essentialsFeed[1]
        });
});

app.post('/delete/user/:id/post/:postId', async (req,res)=>{
    const id = req.params.id;
    const postId = req.params.postId;
    await db.query(`DELETE FROM booknotes WHERE id = ${postId}`);
    const essentialsFeed = await GetFeed(id);
    res.render("manageFeed.ejs",{
        id:id, 
        username:essentialsFeed[0],
        posts:essentialsFeed[1]
    });
});

app.get("/search",async (req,res)=>{
    const query = req.query.query;
    const feed = await GetSearchResults(query);
    console.log(feed);
    res.render("feed.ejs",{posts:feed})
})
app.get("/search/:id",async (req,res)=>{
    const query = req.query.query;
    const id = req.params.id;
    const feed = await GetSearchResults(query);
    console.log(feed);
    res.render("feed.ejs",{posts:feed,id:id})   
});
app.get("/:id",async(req,res)=>{
    const id = req.params.id;
    const essentialsFeed = await GetFeed(id);
    res.render("manageFeed.ejs",{
        id:id, 
        username:essentialsFeed[0],
        posts:essentialsFeed[1]
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
