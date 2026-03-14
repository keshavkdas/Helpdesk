const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    summary: { type: String, required: true },
    org: String,
    status: { type: String, default: 'Open' },
    priority: { type: String, default: 'Medium' },
    dueDate: Date, // Added for your plan
    assignees: Array,
    timeline: [{
        action: String,
        by: String,
        date: { type: Date, default: Date.now },
        note: String
    }],
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', TicketSchema);