const express = require('express');
const app =express();
const cors = require('cors');
const admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require('mongodb').ObjectId;
const port = process.env.PORT || 5000;
const serviceAccount = require('./smart-baby-toy-firebase-adminsdk.json');


// jwt token admin  initialize


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// middle ware 
app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bdgqc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req,res,next){
    if(req.headers?.authorization?.startsWith('Bearer')){
        const token = req.headers.authorization.split(' ')[1];
        try{
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail= decodedUser.email;
        }
        catch{

        }

    }

    next();
}
async function run(){
    try{
        await client.connect();
        const database = client.db('baby_toys');
        const usersCollection = database.collection('users');
        const allProductsCollection= database.collection('allProducts');
        const  ordersCollection = database.collection('orders');
        const reviewsCollection = database.collection('reviews')

        //  post user  to server
        app.post('/users',async(req,res)=>{
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            console.log(result)
            res.json(result);
        }); 
        //if not user exist then update user data into DB
        app.put('/users',async (req,res)=>{
            const user = req.body;
            const filter = {email: user.email};
            const options ={upsert: true};
            const updateDoc = {$set:user};
            const result = await usersCollection.updateOne(filter,updateDoc,options);
            res.json(result);
        });



        // //update products data into DB
        app.put('/updateProduct/:id', async (req,res)=>{
            const id = req.params.id;
            const updatedProduct=req.body.update;
            const filter= {_id:ObjectId(id)};
            allProductsCollection.updateMany(filter,{$set:{update:updatedProduct}
            })
            .then(result=>{
                console.log(result)
            })
            console.log(updatedProduct);
        })
        
        //user role admin  and verify jwt token 
        app.put('/users/admin', verifyToken, async(req,res)=>{
            const user =req.body;
            const requester = req.decodedEmail;
            if(requester){
                const requesterAccount = await usersCollection.findOne({email:requester});
                if(requesterAccount.role==='admin'){
                    const filter ={email:user.email};
                    const updateDoc = {$set:{role:'admin'}}
                    const result = await usersCollection.updateOne(filter,updateDoc)
                    res.json(result)
                }
            }
            else{
                res.status(403).json({message:'Your Do Not Have Access to Make Admin'})
            }
            

        });
        // Add Products 
        app.post('/addProducts', async(req,res)=>{
            const result = await allProductsCollection.insertOne(req.body);
            res.send(result);
        })
          // GET API
    app.get('/allProducts',async(req,res)=>{
        const cursor = allProductsCollection.find({});
        const allProducts = await cursor.toArray();
        res.send(allProducts);
    });
     // Add Review 
     app.post('/addReview', async(req,res)=>{
        const result = await reviewsCollection.insertOne(req.body);
        res.send(result);
    })
    //get all reviews 
    app.get('/reviews', async (req,res)=>{
        const result = await reviewsCollection.find({}).toArray();
        res.send(result);
    })
    // manage product delete 
    app.delete('/deleteProduct/:id',async (req,res)=>{
        const result = await allProductsCollection.deleteOne({_id: ObjectId(req.params.id)
        });
        res.send(result);
    })
    // Get a specific user using email
    app.get('/users/:email',async(req,res)=>{
        const email = req.params.email;
        const query = {email:email}
        const user = await usersCollection.findOne(query);
        let isAdmin = false;
        if(user?.role==='admin'){
            isAdmin=true;
        }
        res.json({admin:isAdmin});
    })

    // Get single Product
    app.get('/singleProduct/:id', async (req,res)=>{
        const result = await allProductsCollection.find({_id: ObjectId(req.params.id)}).toArray();
        res.send(result[0])
    });
    // post Orders to the Database 
    app.post('/orders',async (req,res)=>{
        const order = req.body;
        const result = await ordersCollection.insertOne(order);
        res.json(result);
    }); 
    // GET Order BY Email ID 
    app.get('/orders',verifyToken, async (req,res)=>{
        const email = req.query.email;
        const query = {email: email}
        const cursor =  ordersCollection.find(query);
        const orders = await cursor.toArray();
        res.json(orders);
    });
    // delete order my order 
    app.delete('/cancelOrder/:id',async (req,res)=>{
        const result = await ordersCollection.deleteOne({_id: ObjectId(req.params.id)
        });
        res.send(result);
    })
    // Manage All Orders 
    app.get('/allOrders', async (req,res)=>{
        const result = await ordersCollection.find({}).toArray();
        res.send(result);
    })

    }
    finally{
        // await client.close();

    }
}
run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('Smart Baby Toy');
})
app.listen(port,()=>{
    console.log(`App listenig at: ${port}`);
})