const jsonwebtoken = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Workspace = mongoose.model('Workspace');
require('dotenv').config();

module.exports = async (req, res, next) => {
    const { authorization } = req.headers;
    //authorization === 'Bearer fashnjaurneae334fvdsfdas'

    if(!authorization){
        return res.status(401).send({error: 'You must be logged in.'});
    }

    const token = authorization.replace('Bearer ', '');
    jsonwebtoken.verify(token, process.env.JWT_SECRET, async (err, payload) => {
        if(err){
            // JWT is invalid. Check if it's a workspace API key
            const apiKey = authorization.replace('API-KEY ', '');
            const workspace = await Workspace.findOne({ apiKey }).populate('company'); // Populating company

            if (!workspace || !workspace.company || workspace.company.length === 0) {
                // If the API key is not found or the workspace doesn't have a company, return error
                return res.status(401).send({error: 'Invalid Token or API Key.'});
            }

            if (workspace.company[0].tokenBalance <= 0) {
                return res.status(402).send({ error: 'You have reached your token limit, please purchase more tokens.' });
            }

            // If the API key is found and company exists, attach the company to the request as user
            req.user = workspace.company[0]; // Assuming company is an array of IDs
            next();
            return;
        }

        const { userId } = payload;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).send({ error: 'User not found' });
        }

        if (user.isBlocked) {
            return res.status(401).send({ error: 'Your account is blocked, please contact support' });
        }

        if (user.workspace) {
            const workspace = await Workspace.findById(user.workspace);
            const company = await User.findById(workspace.company);
            if (company.tokenBalance <= 0) {
                return res.status(402).send({ error: 'You have reached your token limit, please purchase more tokens.' });
            }
        } else {
            if (user.tokenBalance <= 0) {
                return res.status(402).send({ error: 'You have reached your token limit, please purchase more tokens.' });
            }
        }

        req.user = user;

        await user.save();
        next();
    });
};
