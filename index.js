const express = require('express');
const app = express();
const jwt = require('jsonwebtoken')
require('dotenv').config();
const cors = require('cors');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5050;


//middleware
app.use(cors());
app.use(express.json());


// pass: effCUePG8xjCLddB
// user: Bistro_Boss


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@mujahid.frqpuda.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {

    const userCollection = client.db("Bistro_Boss").collection("user");
    const menuCollection = client.db("Bistro_Boss").collection("Bistrobd");
    const reviewsCollection = client.db("Bistro_Boss").collection("Reviewdb");
    const cartsCollection = client.db("Bistro_Boss").collection("carts");
    const paymentCollection = client.db("Bistro_Boss").collection("payments");

    // jwt related api 
    app.post('/jwt', async(req,res)  =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res.send({token});
    })

    // middlewares
    const verifyToken = (req, res, next) =>{
      console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorize access'});
      }
      const token =  req.headers.authorization.split(' ')[1]; 
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'unauthorize access'})
        }
        req.decoded = decoded;
        next();
      })
    }

    // admin verify
    const verifyAdmin = async(req, res, next) =>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }

    // user related api
    app.get('/users', verifyToken, verifyAdmin, async(req, res) =>{
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) =>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }

      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
        if(user){
          admin = user?.role === 'admin';
        }
      res.send({admin});
    })

    app.post('/users', async (req, res) =>{
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message: 'user already exist', insetId:null })
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users/admin/:id',verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id : new ObjectId(id)};
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })
    // menu related api


    app.get('/menu', async (req, res) =>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    app.get('/review', async (req, res) =>{
        const result = await reviewsCollection.find().toArray();
        res.send(result);
    })

    app.post('/menu', verifyToken, verifyAdmin, async(req, res) =>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result);
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/menu/:id',  async(req, res) =>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.findOne(query);
      res.send(result);
    })

    app.patch('/menu/:id', async(req, res) =>{
      const item = req.body;
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }
      const result = await menuCollection.updateOne(query, updatedDoc)
      res.send(result);
    })

    // shopping cart
    app.get('/cart', async (req, res) =>{
      const email = req.query.email;
      const query = {email:email}
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    })

    // cart delete
    app.delete('/cart/:id', async(req, res) =>{
      const id = req.params.id;
      const query = {_id:new ObjectId(id)};
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })

    app.post('/cart', async(req, res) =>{
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result)
    })

    app.post('/create-payment-intent', async(req, res) =>{
      const {price} = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount intent');



      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.get('/payments/:email', verifyToken, async(req, res) =>{
      const query = {email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result)
    })


    app.post('/payments', async(req, res) =>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      console.log('payment info', payment);
      const query = {_id: {
      $in: payment.cartIds.map(id => new ObjectId(id))
      }}
      const deleteResult = await cartsCollection.deleteMany(query)
      res.send({paymentResult, deleteResult})
    })

    // stats or analysis
    app.get('/admin-stats', verifyToken, verifyAdmin, async(req, res) =>{
      const user = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // this is not the best way
      // const payments  = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => total + payment.price, 0);

      const result = await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      const revenue =  result.length > 0 ? result[0].totalRevenue : 0;

      res.send({
        user,
        menuItems,
        orders,
        revenue
      })
    })


    app.get('/order-stats', verifyToken, verifyAdmin, async(req, res) =>{
      const result = await paymentCollection.aggregate([
        { $unwind: { path: "$menuIds" } },
        {
          $lookup: {
            from: "Bistrobd",
            let: { menuIds: { $toObjectId: "$menuIds" } },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$_id", "$$menuIds"] }
                }
              }
            ],
            as: "menuItemsData"
          }
        },
        { $unwind: { path: "$menuItemsData" } },
        {
          $group: {
          _id: '$menuItemsData.category',
          count: { $sum: 1 },
          total: { $sum: '$menuItemsData.price' }
        }
          }
      ]).toArray();
      res.send(result);
    })

    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res ) =>{
    res.send('boss is sitting')
})

app.listen(port, () =>{
    console.log(`Bistro BOSS is sitting on port ${port}`);
})