import admin from "firebase-admin";

// Initialize Firebase Admin once
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

const db = admin.firestore();
const messaging = admin.messaging();

export default async function handler(req, res) {
  // 1. Basic Security: Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { toUserId, title, body, data } = req.body;

  if (!toUserId) {
    return res.status(400).json({ error: "Missing toUserId" });
  }

  try {
    // 2. Fetch user's FCM token from Firestore
    const tokenDoc = await db.collection("fcmTokens").doc(toUserId).get();

    if (!tokenDoc.exists) {
      return res.status(200).json({ success: false, message: "No tokens found for user" });
    }

    const { token } = tokenDoc.data();
    if (!token) {
      return res.status(200).json({ success: false, message: "Token field is empty" });
    }

    // 3. Construct the message
    const message = {
      notification: {
        title: title || "Elite Arrows",
        body: body || "You have a new alert",
      },
      data: {
        ...data,
        notificationId: Date.now().toString(),
      },
      token: token,
    };

    // 4. Send the message via FCM
    const response = await messaging.send(message);

    return res.status(200).json({
      success: true,
      messageId: response,
    });

  } catch (error) {
    console.error("Error sending notification:", error);

    // Cleanup invalid tokens automatically
    if (error.code === 'messaging/registration-token-not-registered') {
        await db.collection("fcmTokens").doc(toUserId).delete().catch(() => {});
    }

    return res.status(500).json({
      error: "Failed to send notification",
      details: error.message,
    });
  }
}
