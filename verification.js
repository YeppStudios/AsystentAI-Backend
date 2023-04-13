const mongoose = require('mongoose');
const User = require('./src/models/User'); // Adjust the path to your User model

mongoose.connect('mongodb+srv://App:Asystent*AI2023@mainasystentdb.rbtvr.mongodb.net/?retryWrites=true&w=majority', { // Replace with your database connection string
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

async function updateExistingUsers() {
  try {
    const result = await User.updateMany({}, { emailVerified: true });
    console.log('Updated users:', result);
  } catch (error) {
    console.error('Error updating users:', error);
  } finally {
    mongoose.disconnect();
  }
}

updateExistingUsers();
