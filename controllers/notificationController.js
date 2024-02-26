var admin = require("firebase-admin");
var fcm = require("fcm-notification");

var serviceAccount = require("../config/notificationKey.json");
const NotificationServices = require("../services/notificationServices");
const NotificationModel = require("../models/notification");
const UserModel = require("../models/user");
const certPath = admin.credential.cert(serviceAccount);
var FCM = new fcm(certPath);

// Generate Notification ID
const generateNotificationId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    const NotificationId = `${timestamp}${random}`;
    return NotificationId;
};

exports.sendNotification = async (req, res, next) => {
    try {
        const { userId, orderStatus, orderId } = req.body;
        const user = await UserModel.findOne({ "_id": userId });
        const notificationId = generateNotificationId();
        const message = {
            notification: {
                title: "Your Laundry is Ready for " + orderStatus + "!",
                body: "Order #" + orderId + " is now ready for " + orderStatus + "!"
            },
            data: {
                title: "Your Laundry is Ready for " + orderStatus + "!",
                message: "Order #" + orderId + " is now ready for " + orderStatus + "!"
            }
        };
        await NotificationServices.saveNotification(notificationId, userId, message.data.title, message.data.message);
        const notificationsPromises = user.fcmTokens.map(async (fcmToken) => {
            message.token = fcmToken;
            return new Promise((resolve, reject) => {
                FCM.send(message, function(err, resp) {
                    if (err) {
                        if (err.code === 'messaging/registration-token-not-registered') {
                            console.warn(`FCM Token ${fcmToken} is not registered. Removing from the user's tokens.`);
                            resolve();
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve();
                    }
                });
            });
        });
        await Promise.all(notificationsPromises);
        return res.status(200).send({
            message: "Notification Sent and Saved"
        });
    } catch (err) {
        throw err;
    }
}

exports.retrieveNotifications = async (req, res, next) => {
    try {
        const userId = req.query.userId;
        const notifications = await NotificationModel.find({'user.userId': userId });
        for (const notification of notifications) {
            await NotificationModel.findOneAndUpdate(
                { notificationId: notification.notificationId },
                { $set: { isRead: true } },
                { new: false }
            );
        }
        res.json({ notifications });
    } catch (error) {
        console.log (error);
    }
}

exports.deleteAllNotifications = async (req, res, next) => {
    try {
        const userId = req.query.userId;
        await NotificationModel.deleteMany({ 'user.userId': userId });
        res.status(200).json({ message: 'Notifications deleted successfully.' });
      } catch (error) {
        console.error('Error deleting notifications:', error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
}