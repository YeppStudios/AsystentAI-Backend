const request = require('supertest');
const expect = require('chai').expect;
const app = require('../src/index');
const mongoose = require('mongoose');
const User = mongoose.model('User');

describe('Auth routes', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password' });
      expect(res.statusCode).to.equal(201);
      expect(res.body).to.have.property('token');
      expect(res.body).to.have.property('newUser');
    });

    it('should not allow registering a new user with the same email', async () => {
      await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password' });
      const res = await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password' });
      expect(res.statusCode).to.equal(400);
      expect(res.body).to.have.property('message', 'User already exists');
    });
  });

  describe('POST /login', () => {
    it('should login a registered user', async () => {
      await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password' });
      const res = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });
      expect(res.statusCode).to.equal(200);
      expect(res.body).to.have.property('token');
      expect(res.body).to.have.property('user');
    });

    it('should not allow login for an unregistered user', async () => {
      const res = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password' });
      expect(res.statusCode).to.equal(400);
      expect(res.body).to.have.property('message', 'User not found');
    });

    it('should not allow login with invalid credentials', async () => {
      await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password' });
      const res = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'invalid' });
      expect(res.statusCode).to.equal(500);
    });
  });
});
