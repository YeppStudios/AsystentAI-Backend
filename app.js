require('./src/models/User');
require('./src/models/Conversation');
require('./src/models/Message');
require('./src/models/Plan');
require('./src/models/Transaction');
require('./src/models/Payment');
require('./src/models/Whitelist');
require('./src/models/Profile');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser =  require('body-parser');
const authRoutes =  require('./src/routes/authRoutes');
const messageRoutes =  require('./src/routes/messageRoutes');
const conversationRoutes =  require('./src/routes/conversationRoutes');
const tokenRoutes =  require('./src/routes/tokenRoutes');
const statsRoutes =  require('./src/routes/statsRoutes');
const planRoutes =  require('./src/routes/planRoutes');
const whitelistRoutes =  require('./src/routes/whitelistRoutes');
const stripeRoutes =  require('./src/routes/stripeRoutes');
const contentGenerationRoutes =  require('./src/routes/contentGenerationRoutes');
const userRoutes =  require('./src/routes/userRoutes');
const profileRoutes =  require('./src/routes/profileRoutes');
// const job = require('./src/cron');
const cors = require('cors');
require('dotenv').config()


const app = express();
app.set('port', (process.env.PORT || 3004));

app.use(express.static('public'));
app.use(cors({
  origin: 'https://www.asystent.ai'
}));
app.use(bodyParser.json({
    verify: (req, res, buf) => {
      req.rawBody = buf
    }
  }))
app.use(authRoutes);
app.use(messageRoutes);
app.use(conversationRoutes);
app.use(tokenRoutes);
app.use(statsRoutes);
app.use(contentGenerationRoutes);
app.use(userRoutes);
app.use(planRoutes);
app.use(stripeRoutes);
app.use(whitelistRoutes);
app.use(profileRoutes);

const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);

// mongoose.connection.on('connected', () => {
//     console.log("Connected to mongo instance");
//     job.start();
// });

mongoose.connection.on('error', (err) => {
    console.log("Error connecting to mongo ", err);
    job.stop();
});

app.listen(app.get('port'), function () {
  console.log('Server running on port ' + app.get('port'));
});

module.exports = app;