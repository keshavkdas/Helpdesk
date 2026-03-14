const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
    id: String,
    name: String,
    email: { type: String, unique: true },
    role: { type: String, enum: ['Admin', 'Agent', 'User'] },
    password: { type: String, required: true },
    status: { type: String, default: 'Active' },
    active: Boolean,
    confirmed: Boolean
});
module.exports = mongoose.model('User', UserSchema);