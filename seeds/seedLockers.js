const mongoose = require('mongoose');
require('dotenv').config();
const Locker = require('../models/locker');

// DATABASE CONNECTION
mongoose.connect(process.env.DB_CONNECT);
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB Atlas connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB Atlas.');
});

// DEFINE SEED LOCKERS
const lockers = [
    {
        name: 'Taylor\'s University',
        location: {
            type: 'Point',
            coordinates: [101.61687447279495, 3.064830532141036],
        },
        compartments: [
            {
                compartmentNumber: 'L01',
                size: 'Small',
            },
            {
                compartmentNumber: 'L02',
                size: 'Medium',
            },
            {
                compartmentNumber: 'L03',
                size: 'Large',
            },
            {
                compartmentNumber: 'L04',
                size: 'Extra Large',
            }
        ]
    },
    {
        name: 'Sunway Geo Residence',
        location: {
            type: 'Point',
            coordinates: [101.60980581528996, 3.063661692311628],
        },
        compartments: [
            {
                compartmentNumber: 'L01',
                size: 'Small',
            },
            {
                compartmentNumber: 'L02',
                size: 'Medium',
            },
            {
                compartmentNumber: 'L03',
                size: 'Large',
            },
            {
                compartmentNumber: 'L04',
                size: 'Extra Large',
            }
        ]
    }
];

// SEED SERVICES FUNCTION
const seedLockers = async () => {
    try {
        // UPDATE SERVICE COLLECTION
        for (const locker of lockers) {

            // Check if seed locker already exists
            const existingLocker = await Locker.findOne({ name: locker.name });

            if (existingLocker) {
                console.log(`Locker with name '${locker.name}' already exists.`);
            } else {
                // Insert seed lockers into the database
                const newLocker = new Locker(locker);
                await newLocker.save();
                console.log(`Locker with name '${locker.name}' added successfully`);
            }
        }

        console.log('Locker seeding complete.');

    } catch (error) {
        console.error(error);
    } finally {
        mongoose.connection.close();
    }
};

// RUN SEED
seedLockers();