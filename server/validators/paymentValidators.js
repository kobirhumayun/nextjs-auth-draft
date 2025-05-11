const {
    isFloatField,
    isNotEmptyString,
    isInValues,
    isMongoIdField,
    isObjectField,
    isLength,
} = require('./commonValidators');

const paymentValidationRules = () => {
    return [
        isFloatField('amount', { min: 0.01 }),
        isNotEmptyString('currency'),
        isInValues('currency', ['USD', 'EUR', 'BDT']), // Example currencies
        isNotEmptyString('paymentGateway'),
        isNotEmptyString('gatewayTransactionId'),
        isLength('purpose', { min: 1, max: 255 }),
        isMongoIdField('planId').optional(), // Optional: only if present, must be valid MongoId
        isNotEmptyString('paymentMethodDetails').optional(),        
    ];
};

module.exports = {
    paymentValidationRules,
};