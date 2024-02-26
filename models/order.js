
const mongoose = require('mongoose');

// DEFINE SCHEMA FOR EACH ORDER ITEM
const orderItemSchema = new mongoose.Schema({
    name: String,
    unit: String,
    price: Number,
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    cumPrice: {
        type: Number,
    }
});

// DEFINE ENUMS FOR ORDER STATUS
const statusEnum = ['Pending Drop Off',
    'Collected By Rider',
    'In Progress',
    'Processing Complete',
    'Out For Delivery',
    'Ready for Collection',
    'Completed',
    'Order Error'];

// DEFINE SCHEMA FOR ORDER
const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
    },
    user: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        phoneNumber: {
            type: Number,
            required: true,
        }
    },
    locker: {
        lockerSiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Locker',
            required: true,
        },
        compartmentId: {
            type: String,
            required: true,
        },
        compartmentNumber: {
            type: String,
        }
    },
    collectionSite: {
        lockerSiteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Locker',
            required: true,
        },
        compartmentId: {
            type: String,
        },
        compartmentNumber: {
            type: String,
        },
        compartmentSize: {
            type: String,
        }
    },
    service: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
    },
    orderItems: [orderItemSchema],
    estimatedPrice: {
        type: Number,
        default: function () {
            return this.orderItems.reduce((total, item) => total + item.quantity * item.price, 0);
        },
        min: 0,
    },
    orderStage: {
        dropOff: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        collectedByRider: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        inProgress: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        processingComplete: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        outForDelivery: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        readyForCollection: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        completed: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
        orderError: {
            status: {
                type: Boolean,
                default: false,
            },
            dateUpdated: {
                type: Date,
            }
        },
    },
    barcodeID: {
        type: String,
    },
    proofPicUrl: {
        type: String,
    },
    createdAt: {
        type: Date,
    },
    selectedByRider: {
        type: Boolean,
        default: false,
    }
});

// EXPORT ORDER MODEL
const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
