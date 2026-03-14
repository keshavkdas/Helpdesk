const mongoose = require('mongoose');
const TicketSchema = new mongoose.Schema({
    id: String,
    summary: String,
    org: String,
    status: { type: String, default: 'Open' },
    priority: String,
    category: String,
    assignees: Array,
    customAttrs: Object,
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Ticket', TicketSchema);