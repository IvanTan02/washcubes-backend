
const Order = require('../models/order');
const Service = require('../models/service');
const Locker = require('../models/locker');
const { getAvailableCompartment } = require('../controllers/lockerController');
const { createJob, createLockerToLaundrySiteJob, createLaundrySiteToLockerJob } = require('../controllers/jobController');
const { sendNotification } = require('./notificationController');

// DISPLAY ALL ORDERS ASSOCIATED WITH USER
module.exports.displayAllOrders = async (req, res) => {
    const orders = await Order.find({});
    res.status(200).json({ orders });
}

module.exports.displayUserOrders = async (req, res) => {
    const userId = req.query.userId;
    const orders = await Order.find({
        'user.userId': userId,
    });
    res.status(200).json({ orders });
}

module.exports.displayOrdersForOperator = async (req, res) => {
    const orders = await Order.find({
        $or: [
            { 'orderStage.inProgress.status': true },
            { 'orderStage.readyForCollection.status': true },
            { 'orderStage.orderError.status': true },
        ],
        'orderStage.completed.status': false,
    });
    res.status(200).json({ orders });
}

// CHECK AVAILABILITY FOR SELECTED LOCKER SITE
module.exports.getLockerCompartment = async (req, res) => {
    const { selectedLockerSiteId, selectedSize } = req.body;
    const allocatedCompartment
        = await getAvailableCompartment(selectedLockerSiteId, selectedSize);
    if (allocatedCompartment) {
        res.status(200).json({ allocatedCompartment });
    } else {
        res.status(404).json({});
    }
}

// CREATE A NEW ORDER
module.exports.createOrder = async (req, res) => {
    try {
        const orderData = req.body;
        const newOrderNumber = generateOrderNumber();
        const order = await createOrderObject(orderData, newOrderNumber);
        const newOrder = new Order(order);
        res.status(200).json({ newOrder });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).send('Internal Server Error');
    }
}

// GENERATE ORDER NUMBER
const generateOrderNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const orderNumber = `${timestamp}${random}`;
    return orderNumber;
};

// CREATE ORDER OBJECT FROM FORM DATA
const createOrderObject = async (orderData, orderNumber) => {
    const { serviceId, lockerSiteId } = orderData;
    const orderItems = [];
    for (const orderItem of orderData.orderItems) {
        if (orderItem.quantity == 0) continue;
        const item = await findItemById(orderData.serviceId, orderItem.itemId);
        const orderItemDetails = {
            name: item.name,
            unit: item.unit,
            price: item.price,
            quantity: parseInt(orderItem.quantity, 10),
            cumPrice: item.price * orderItem.quantity,
        };
        orderItems.push(orderItemDetails);
    }
    const newOrder = {
        orderNumber,
        locker: {
            lockerSiteId,
        },
        service: serviceId,
        orderItems,
    };
    return newOrder;
}

// GET DETAILS OF A SPECIFIC ITEM WITHIN A SERVICE
const findItemById = async (serviceId, itemId) => {
    try {
        const service = await Service.findById(serviceId);
        if (!service) throw new Error('Service not found');

        const item = service.items.find(item => item._id.toString() === itemId);
        if (!item) throw new Error('Item not found');
        return item;

    } catch (error) {
        console.error('Error finding item by ID:', error);
        throw error;
    }
}

// SAVE ORDER TO DATABASE AFTER USER CONFIRMATION
module.exports.confirmOrder = async (req, res) => {
    try {
        const order = req.body;
        const existingOrder = await Order.findOne({ orderNumber: order.orderNumber });
        if (existingOrder) {
            return res.status(500).json({ message: 'Order with same order number exists.' });
        }
        const newOrder = new Order(order);
        newOrder.createdAt = Date.now();
        await newOrder.save();
        res.status(200).json({ newOrder });
    } catch (error) {
        console.error('Error confirming order:', error);
        res.status(500).send('Internal Server Error');
    }
}

// CANCEL ORDER
module.exports.cancelOrderCreation = async (req, res) => {
    const { lockerSiteId, compartmentId } = req.body;
    const locker = await Locker.findById(lockerSiteId).exec();
    let compartment = locker.compartments.find(compartment => compartment._id.toString() === compartmentId);
    if (!compartment) throw new Error('Compartment not found.');
    compartment.isAvailable = true;
    await locker.save();
    res.status(200).json({ message: 'Order Cancelled' });
}

// USER CONFIRMS ORDER DROP OFF 
module.exports.confirmOrderDropOff = async (req, res) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('CONFIRM ORDER DROP OFF ERROR');

    order.orderStage.dropOff.status = true;
    order.orderStage.dropOff.dateUpdated = Date.now();
    await order.save();

    res.status(200).json({ order });
}

// USER CONFIRMS ORDER COLLECTION
module.exports.confirmOrderCollection = async (req, res) => {
    const { orderId, lockerSiteId, compartmentId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('CONFIRM ORDER COLLECTION ERROR');

    order.orderStage.completed.status = true;
    order.orderStage.completed.dateUpdated = Date.now();
    await order.save();

    // FREE UP COMPARTMENT
    const locker = await Locker.findById(lockerSiteId).exec();
    let compartment = locker.compartments.find(compartment => compartment._id.toString() === compartmentId);
    if (compartment) {
        compartment.isAvailable = true;
        await locker.save();
    }

    res.status(200).json({ order });
}

module.exports.getNumberOfOrdersReadyForPickup = async (req, res) => {
    const lockers = await Locker.find({});
    const map = new Map();

    for (const locker of lockers) {
        const orders = await Order.find({
            'orderStage.dropOff.status': true,
            'orderStage.collectedByRider.status': false,
            'selectedByRider': false,
            'locker.lockerSiteId': locker._id,
        })
        if (!orders) throw new Error('ERROR GETTING NUMBER OF ORDERS READY FOR PICK UP');
        map.set(locker._id.toString(), orders.length);
    }
    const mapArray = Array.from(map.entries());
    res.status(200).json({ mapArray });
}

module.exports.getNumberOfOrdersReadyForDropoff = async (req, res) => {
    const lockers = await Locker.find({});
    const map = new Map();

    for (const locker of lockers) {
        const orders = await Order.find({
            'orderStage.processingComplete.status': true,
            'orderStage.outForDelivery.status': false,
            'selectedByRider': false,
            'collectionSite.lockerSiteId': locker._id,
        })
        if (!orders) throw new Error('ERROR GETTING NUMBER OF ORDERS READY FOR PICK UP');
        map.set(locker._id.toString(), orders.length);
    }
    const mapArray = Array.from(map.entries());
    res.status(200).json({ mapArray });
}

module.exports.getOrdersReadyForPickup = async (req, res) => {
    const { lockerSiteId } = req.query;
    const orders = await Order.find({
        'orderStage.dropOff.status': true,
        'orderStage.collectedByRider.status': false,
        'selectedByRider': false,
        'locker.lockerSiteId': lockerSiteId,
    })
    if (!orders) throw new Error('ERROR GETTING ORDERS READY FOR PICK UP');
    res.status(200).json({ orders });
}

module.exports.confirmSelectedPickupOrders = async (req, res) => {
    const { jobType, lockerSiteId, riderId, selectedOrderIds } = req.body;
    const newJobNumber
        = await createLockerToLaundrySiteJob(selectedOrderIds, jobType, lockerSiteId, riderId);
    res.status(200).json({ newJobNumber });
}

module.exports.getLaundrySiteOrdersReadyForPickup = async (req, res) => {
    const { lockerSiteId } = req.query;
    const orders = await Order.find({
        'orderStage.processingComplete.status': true,
        'orderStage.outForDelivery.status': false,
        'collectionSite.lockerSiteId': lockerSiteId,
        'selectedByRider': false,
    })
    if (!orders) throw new Error('ERROR GETTING LAUNDRY SITE ORDERS READY FOR PICK UP');
    res.status(200).json({ orders });
}

module.exports.confirmSelectedLaundrySitePickupOrders = async (req, res) => {
    const { lockerSiteId, riderId, selectedOrderIds } = req.body;
    const { jobNumber, unavailableOrders }
        = await createLaundrySiteToLockerJob(selectedOrderIds, lockerSiteId, riderId);
    res.status(200).json({ jobNumber, unavailableOrders });
}

module.exports.operatorApproveOrderDetails = async (req, res) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('OPERATOR APPROVE ORDER DETAILS ERROR');

    order.finalPrice = order.estimatedPrice;

    order.orderStage.inProgress.verified = true;
    order.orderStage.inProgress.processing = true;
    order.orderStage.dateUpdated = Date.now();
    await order.save();

    res.status(200).json({});
}

module.exports.operatorEditOrderDetails = async (req, res) => {
    const { orderId, orderItems, proofPicUrl, finalPrice } = req.body;
    proofPicUrlArray = JSON.parse(proofPicUrl);
    const order = await Order.findById(orderId);
    if (!order) throw new Error('OPERATOR EDIT ORDER DETAILS ERROR');

    order.oldOrderItems = order.orderItems;

    order.orderItems = orderItems;
    order.finalPrice = parseFloat(finalPrice);

    order.orderStage.inProgress.verified = true;
    order.orderStage.inProgress.dateUpdated = Date.now();

    order.orderStage.orderError.status = true;
    order.orderStage.orderError.dateUpdated = Date.now();

    for (let i = 0; i < proofPicUrlArray.length; i++) {
        order.orderStage.orderError.proofPicUrl.push(proofPicUrlArray[i]);
    }

    // Send push notification to users about their order status update
    const userId = (order.user.userId).toString();
    const orderNumber = (order.orderNumber).toString();
    req.body = {
        userId,
        orderStatus: "orderError",
        orderId: orderNumber
    };
    sendNotification(req);

    await order.save();
    res.status(200).json({});
}

module.exports.operatorConfirmProcessingComplete = async (req, res) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('OPERATOR CONFIRM PROCESSING COMPLETE ERROR');

    // Send push notification to users about their order status update
    const userId = (order.user.userId).toString();
    const orderNumber = (order.orderNumber).toString();
    req.body = {
        userId,
        orderStatus: "processingComplete",
        orderId: orderNumber
    };
    sendNotification(req);

    order.orderStage.processingComplete.status = true;
    order.orderStage.processingComplete.dateUpdated = Date.now();
    await order.save();

    res.status(200).json({});
}

module.exports.operatorApproveOrderReturn = async (req, res) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('OPERATOR APPROVE ORDER RETURN ERROR');

    order.orderStage.orderError.returnProcessed = true;
    order.orderStage.processingComplete.status = true;
    order.orderStage.processingComplete.dateUpdated = Date.now();
    await order.save();

    res.status(200).json({});
}

module.exports.userResolveOrderError = async (req, res) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('USER RESOLVE ORDER ERROR ERROR');

    order.orderStage.orderError.status = false;
    order.orderStage.orderError.userAccepted = true;
    order.orderStage.orderError.dateUpdated = Date.now();
    order.orderStage.inProgress.processing = true;
    order.orderStage.inProgress.dateUpdated = Date.now();
    await order.save();

    res.status(200).json({});
}

module.exports.userRejectOrderError = async (req, res) => {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) throw new Error('USER REJECT ORDER ERROR ERROR');

    order.orderStage.orderError.userRejected = true;
    order.orderStage.orderError.dateUpdated = Date.now();
    await order.save();

    res.status(200).json({});
}