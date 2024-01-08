const mongoose = require('mongoose');

// ENUMS FOR LOCKER COMPARTMENT SIZE
const sizeEnums = ['Small', 'Medium', 'Large', 'Extra Large'];

// LOCKER COMPARTMENT SCHEMA
const lockerCompartmentSchema = new mongoose.Schema({
    compartmentNumber: {
        type: String,
        required: true,
    },
    size: {
        type: String,
        enum: sizeEnums,
        required: true,
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
});

// LOCKER TERMINAL SCHEMA
const lockerSiteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number], // [Longitude, Latitude]
            required: true,
        },
    },
    compartments: [lockerCompartmentSchema],
});

lockerSiteSchema.index({ location: '2dsphere' }); // Create a 2dsphere index for geospatial queries

// Check for duplicate compartment numbers within the same locker site
lockerSiteSchema.pre('save', async function (next) {
    const existingCompartmentNumbers = new Set();
    const compartments = this.compartments;

    for (const compartment of compartments) {
        if (existingCompartmentNumbers.has(compartment.compartmentNumber)) {
            const error = new Error(`Duplicate compartment number '${compartment.compartmentNumber}' within the same locker site`);
            return next(error);
        }
        existingCompartmentNumbers.add(compartment.compartmentNumber);
    }
    next();
});


const Locker = mongoose.model('Locker', lockerSiteSchema);
module.exports = Locker;