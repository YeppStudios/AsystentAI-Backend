const request = require('supertest');
const expect = require('chai').expect;
const app = require('../src/index');
const mongoose = require('mongoose');
const User = mongoose.model('User');

describe('Token routes', function() {

    this.timeout(10000);

    let user1, token;

    beforeEach(async () => {
        await User.deleteMany({});
        user1 = new User({ email: 'user1@example.com', password: 'password', accountType: "individual"});
        await user1.save();
        const loginResponse = await request(app)
            .post('/login')
            .send({ email: 'user1@example.com', password: 'password' });
        token = loginResponse.body.token;
    });
    afterEach(async () => {
        await User.deleteMany();
    });

    it('should decrease token balance and update token history', async () => {
        const res = await request(app)
            .post('/askAI')
            .set('Authorization', `Bearer ${token}`)
            .send({ prompt: 'What is the meaning of life?', title: 'Philosophy' });
        expect(res.statusCode).to.equal(201);
        const updatedUser = await User.findById(user1._id);
        expect(updatedUser.tokenHistory.transactions.length).to.be.equal(1)
        expect(updatedUser.tokenHistory.balanceHistory.length).to.be.equal(1)
    });
});
