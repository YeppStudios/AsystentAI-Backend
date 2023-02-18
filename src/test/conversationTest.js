const request = require('supertest');
const expect = require('chai').expect;
const app = require('../src/index');
const chaiHttp = require('chai-http');
const chai = require('chai');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const should = chai.should();
const Conversation = mongoose.model('Conversation');
const Message = mongoose.model('Message');

chai.use(chaiHttp);

describe('Conversation routes', () => {

  let user, conversation, message1, message2, token;

  beforeEach(async () => {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    user = new User({ name: 'user', email: 'user@example.com', password: 'password', accountType: "individual" });
    await user.save();
    conversation = new Conversation({ user: user._id });
    await conversation.save();
    message1 = new Message({ conversation: conversation._id, sender: "User", text: "Hello" });
    message2 = new Message({ conversation: conversation._id, sender: "Assistant", text: "Hi" });
    await message1.save();
    await message2.save();
    const loginResponse = await request(app)
        .post('/login')
        .send({ email: 'user@example.com', password: 'password' });
    token = loginResponse.body.token;
});
afterEach(async () => {
    await User.deleteMany();
    await Conversation.deleteMany();
    await Message.deleteMany();
});


  it('should create a new conversation for a logged in user', async () => {
      const res = await request(app)
        .post('/createConversation')
        .set('Authorization', `Bearer ${token}`)
        .send();
      expect(res.statusCode).to.equal(201);
      expect(res.body).to.have.property('conversation');
  });

  it('should return the conversations for user', async () => {
    const res = await request(app)
        .get(`/getConversations/${user._id}`)
        .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('conversations');
    expect(res.body.conversations.length).to.equal(1);
    expect(res.body.conversations[0].user.toString()).to.equal(user._id.toString());
    });

});
