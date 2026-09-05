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
    // 2. Fetch user's FCM tokens from Firestore
    const tokenDoc = await db.collection("fcmTokens").doc(toUserId).get();

    if (!tokenDoc.exists) {
      return res.status(200).json({ success: false, message: "No tokens found for user" });
    }

    const docData = tokenDoc.data();
    let tokens = Array.isArray(docData.tokens) ? docData.tokens : [];
    const legacyToken = docData.token;
    if (legacyToken && !tokens.includes(legacyToken)) {
      tokens.push(legacyToken);
    }
    tokens = tokens.filter(t => typeof t === "string" && t.length > 0);

    if (tokens.length === 0) {
      return res.status(200).json({ success: false, message: "Token field is empty" });
    }

    // 3. Construct the message (shared across all devices)
    const message = {
      notification: {
        title: title || "Elite Arrows",
        body: body || "You have a new alert",
      },
      data: {
        ...data,
        notificationId: Date.now().toString(),
      },
      tokens: tokens,
    };

    // 4. Send the message to every device via FCM
    const response = await messaging.sendEachForMulticast(message);

    // 5. Prune invalid tokens automatically
    const notRegisteredIndices = [];
    response.responses.forEach((resp, index) => {
      if (
        resp.error &&
        (resp.error.code === "messaging/registration-token-not-registered" ||
          resp.error.code === "messaging/invalid-registration-token")
      ) {
        notRegisteredIndices.push(index);
      }
    });

    if (notRegisteredIndices.length > 0) {
      const remaining = tokens.filter((_, i) => !notRegisteredIndices.includes(i));
      if (remaining.length > 0) {
        await db.collection("fcmTokens").doc(toUserId).update({ tokens: remaining }).catch(() => {});
      } else {
        await db.collection("fcmTokens").doc(toUserId).delete().catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

  } catch (error) {
    console.error("Error sending notification:", error);

    // Cleanup invalid tokens automatically (legacy single-token path)
    if (error.code === "messaging/registration-token-not-registered") {
      await db.collection("fcmTokens").doc(toUserId).delete().catch(() => {});
    }

    return res.status(500).json({
      error: "Failed to send notification",
      details: error.message,
    });
  }
}