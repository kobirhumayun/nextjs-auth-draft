const { Schema, model } = require('mongoose');

const OrderCounterSchema = new Schema({
    _id: { type: String, required: true },
    sequence_value: { type: Number, default: 0 },
});

const OrderCounter = model('OrderCounter', OrderCounterSchema);

module.exports = OrderCounter;