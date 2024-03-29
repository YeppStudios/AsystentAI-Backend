require('./src/models/User');
require('./src/models/Conversation');
require('./src/models/Message');
require('./src/models/Plan');
require('./src/models/Transaction');
require('./src/models/Payment');
require('./src/models/Profile');
require('./src/models/Prompt');
require('./src/models/Content');
require('./src/models/Workspace');
require('./src/models/Assistant');
require('./src/models/Document');
require('./src/models/Reservations');
require('./src/models/Folder');
require('./src/models/OnboardingSurveyData');
require('./src/models/CompanyLogin');
require('./src/models/SeoContent');
require('./src/models/Template');
require('./src/models/Campaign');
require('./src/models/Persona');
require('./src/models/Tone');
require('./src/models/CompetitionResearch');
require('./src/models/WithdrawalRequest')
const express = require('express');
const mongoose = require('mongoose');
const bodyParser =  require('body-parser');
const authRoutes =  require('./src/routes/authRoutes');
const messageRoutes =  require('./src/routes/messageRoutes');
const conversationRoutes =  require('./src/routes/conversationRoutes');
const tokenRoutes =  require('./src/routes/tokenRoutes');
const statsRoutes =  require('./src/routes/statsRoutes');
const planRoutes =  require('./src/routes/planRoutes');
const stripeRoutes =  require('./src/routes/stripeRoutes');
const contentGenerationRoutes =  require('./src/routes/contentGenerationRoutes');
const contentGatheringRoutes =  require('./src/routes/contentGatheringRoutes');
const userRoutes =  require('./src/routes/userRoutes');
const profileRoutes =  require('./src/routes/profileRoutes');
const componentsRoutes =  require('./src/routes/componentsRoutes');
const assistantRoutes =  require('./src/routes/assistantRoutes');
const documentRoutes =  require('./src/routes/documentRoutes');
const reservationsRoutes =  require('./src/routes/reservationsRoutes');
const companyRoutes =  require('./src/routes/companyRoutes');
const apiRoutes =  require('./src/routes/apiRoutes');
const agentRoutes =  require('./src/routes/agentRoutes');
const campaignRoutes =  require('./src/routes/campaignRoutes');
const personaRoutes =  require('./src/routes/personaRoutes');
const competitionResearchRoutes =  require('./src/routes/competitionResearchRoutes');
const toneRoutes =  require('./src/routes/toneRoutes');
const { emailJob, blockSubscriptionsJob } = require('./src/cron');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('port', (process.env.PORT || 3004));

app.use(express.static('public'));
app.use(cors());
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
app.use(profileRoutes);
app.use(componentsRoutes);
app.use(contentGatheringRoutes);
app.use(reservationsRoutes);
app.use(assistantRoutes);
app.use(documentRoutes);
app.use(companyRoutes);
app.use(apiRoutes);
app.use(agentRoutes);
app.use(campaignRoutes);
app.use(personaRoutes);
app.use(toneRoutes);
app.use(competitionResearchRoutes);

const mongoUri = process.env.MONGO_URI;
mongoose.connect(mongoUri);

mongoose.connection.on('error', (err) => {
    console.log("Error connecting to mongo ", err);
    emailJob.stop();
    blockSubscriptionsJob.stop();
});

app.listen(app.get('port'), function () {
  console.log('Server running on port ' + app.get('port'));
  emailJob.start();
  blockSubscriptionsJob.start();
});

module.exports = app;