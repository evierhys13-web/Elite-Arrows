import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  db,
  auth,
  usersCollection,
  adminDataCollection,
  fcmTokensCollection,
  liveGamesCollection,
  gameInvitesCollection,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  query,
  where,
  collection,
  orderBy,
  onSnapshot,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  updateDoc,
  deleteDoc,
  runTransaction,
  writeBatch,
  FieldValue,
  getMessagingInstance,
  getToken,
  onMessage,
  isSupported,
  limit,
} from "../firebase";
import { ADMIN_EMAILS } from "../config";
import SeasonOneWelcomeModal from "../components/SeasonOneWelcomeModal";
import {
  getResultIdentityKey,
  getResultOverrideKeys,
} from "../utils/resultIdentity";
import { logSubscriptionActivated, logUserLogin, startTrace } from "../utils/analytics";
import { useToast } from "./ToastContext";

const AuthContext = createContext(null);

const SEASON_ONE_WELCOME_START = new Date(
  "2026-05-01T00:00:00+01:00",
).getTime();

export const DIVISIONS = [
  "Elite",
  "Diamond",
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
];

const RESULT_CACHE_KEY = "eliteArrowsResults";
const RESULT_PROOF_FIELDS = [
  "proofImage",
  "proof",
  "proofUrl",
  "proofImageUrl",
  "proofFile",
];
const MINIMAL_RESULT_CACHE_FIELDS = [
  "id",
  "firestoreId",
  "fixtureId",
  "cupId",
  "matchId",
  "player1",
  "player1Id",
  "player2",
  "player2Id",
  "score1",
  "score2",
  "division",
  "gameType",
  "season",
  "date",
  "submittedAt",
  "approvedAt",
  "updatedAt",
  "status",
  "submittedBy",
  "bestOf",
  "firstTo",
  "player1Stats",
  "player2Stats",
];

const stripResultProofForCache = (result) => {
  const cached = { ...result };
  let hasProofImage = Boolean(cached.hasProofImage);
  RESULT_PROOF_FIELDS.forEach((field) => {
    if (cached[field]) hasProofImage = true;
    delete cached[field];
  });
  if (hasProofImage) cached.hasProofImage = true;
  return cached;
};

const minimizeResultForCache = (result) => {
  const cached = {};
  MINIMAL_RESULT_CACHE_FIELDS.forEach((field) => {
    if (result[field] !== undefined) cached[field] = result[field];
  });
  if (RESULT_PROOF_FIELDS.some((field) => result[field]))
    cached.hasProofImage = true;
  return cached;
};

// Only cache the fields actually needed from allUsers to prevent localStorage quota errors.
// Large per-user arrays (tokenHistory, matchHistory, stats sub-docs, etc.) are intentionally
// excluded. The current user is already stored in full under eliteArrowsCurrentUser.
const USER_CACHE_FIELDS = [
  "id",
  "username",
  "name",
  "displayName",
  "email",
  "profilePicture",
  "division",
  "superLeagueDivision",
  "isAdmin",
  "isTournamentAdmin",
  "isSubscribed",
  "isBanned",
  "subscribedSeasons",
  "manualStats",
  "friends",
  "tokens",
  "isBot",
];

const stripUserForCache = (u) => {
  const stripped = {};
  USER_CACHE_FIELDS.forEach((field) => {
    if (u[field] !== undefined) stripped[field] = u[field];
  });
  return stripped;
};

const saveUsersCache = (users) => {
  try {
    localStorage.setItem(
      "eliteArrowsUsers",
      JSON.stringify((users || []).map(stripUserForCache)),
    );
  } catch (error) {
    console.warn("Could not cache users locally (quota exceeded):", error);
    // Clear rather than leave a partial / stale blob
    localStorage.removeItem("eliteArrowsUsers");
  }
};

const getCachedResults = () => {
  try {
    return JSON.parse(localStorage.getItem(RESULT_CACHE_KEY) || "[]");
  } catch (error) {
    console.warn("Could not read cached results:", error);
    localStorage.removeItem(RESULT_CACHE_KEY);
    return [];
  }
};

const saveResultsCache = (results) => {
  const resultList = Array.isArray(results) ? results : [];
  // Cache up to 1000 results to ensure standings accuracy across refreshes
  const limitedResults = resultList
    .sort(
      (a, b) =>
        new Date(b.date || b.submittedAt || 0) -
        new Date(a.date || a.submittedAt || 0),
    )
    .slice(0, 1000);

  try {
    localStorage.setItem(
      RESULT_CACHE_KEY,
      JSON.stringify(limitedResults.map(stripResultProofForCache)),
    );
  } catch (error) {
    console.warn("Could not cache results locally (quota exceeded):", error);
    localStorage.removeItem(RESULT_CACHE_KEY);
  }
};

export function AuthProvider({ children }) {
  const { showToast } = useToast();
  // Initialize state from local cache to prevent data flickering on refresh
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsCurrentUser");
      return saved && saved !== "undefined" ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsUsers");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsNotifications");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [results, setResults] = useState(() => {
    try {
      const saved = localStorage.getItem(RESULT_CACHE_KEY);
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [fixtures, setFixtures] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsFixtures");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [cups, setCups] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsCups");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [bets, setBets] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsBets");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [supportRequests, setSupportRequests] = useState([]);
  const [seasons, setSeasons] = useState(() => {
    try {
      const saved = localStorage.getItem("eliteArrowsSeasons");
      return saved && saved !== "undefined" ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [dataRefreshTrigger, setDataRefreshTrigger] = useState(0);
  const [cupsRefreshTrigger, setCupsRefreshTrigger] = useState(0);
  const [adminData, setAdminData] = useState({
    subscriptionPot: 0,
    subscriptionPot10: 0,
    moneyHistory: [],
    leagueTableResetAt: null,
    isMaintenanceMode: false,
    maintenanceMessage: "",
    registrationsEnabled: true,
    currentSeason: "Season 1",
  });
  const [notificationPermission, setNotificationPermission] =
    useState("default");
  const [fcmToken, setFcmToken] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [news, setNews] = useState([]);
  const [showSeasonOneWelcome, setShowSeasonOneWelcome] = useState(false);
  const [pendingGameInvite, setPendingGameInvite] = useState(null);
  const unsubscribeRef = useRef(null);
  const seenNotificationIdsRef = useRef(new Set());
  const resultRowsRef = useRef([]);
  const publishDebounceRef = useRef(null);
  const saveResultsCacheThrottleRef = useRef(null);
  const resultStatusOverridesRef = useRef(
    (() => {
      try {
        return JSON.parse(
          localStorage.getItem("eliteArrowsResultStatusOverrides") || "{}",
        );
      } catch (e) {
        return {};
      }
    })(),
  );

  const SENSITIVE_FIELDS = [
    "password",
    "passwordString",
    "passwordHash",
    "passwordKey",
    "passwordStringValue",
    "password",
    "firebaseId",
    "pwd",
    "pass",
    "passwd",
  ];

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      console.log("This browser does not support notifications");
      return false;
    }

    if (Notification.permission === "granted") {
      setNotificationPermission("granted");
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted") {
        await registerFCMToken();
        return true;
      }
      return false;
    }

    setNotificationPermission("denied");
    return false;
  }, [user?.id]);

  const registerFCMToken = useCallback(async () => {
    if (!user?.id) return null;

    try {
      const supported = await isSupported();
      if (!supported) {
        return null;
      }

      const messaging = await getMessagingInstance();
      if (!messaging) return null;

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
        );
      }

      const token = await getToken(messaging, {
        vapidKey:
          "BCeZoSxuL3tWAkXFIGr1x8-Ns4YwOm2iffUVL2yUDK02QhEfMPpJ61CH349hX7cXjBAjSF92_EsZKzmyJXynnxg",
        serviceWorkerRegistration:
          await navigator.serviceWorker.getRegistration(),
      });

      if (token) {
        setFcmToken(token);
        localStorage.setItem("eliteArrowsFcmToken", token);

        await setDoc(
          doc(db, "fcmTokens", user.id),
          {
            userId: user.id,
            username: user.username,
            token: token,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );

        console.log("FCM Token registered:", token.substring(0, 20) + "...");
        return token;
      }
    } catch (error) {
      console.error("Error registering FCM token:", error);
    }
    return null;
  }, [user?.id, user?.username]);

  const showLocalNotification = useCallback((title, options = {}) => {
    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        icon: "/elite arrows.jpg",
        badge: "/elite arrows.jpg",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.data?.url) {
          window.location.href = options.data.url;
        }
      };
    }
  }, []);

  const updateBadgeCount = useCallback((count) => {
    setUnreadCount(count);
    localStorage.setItem("eliteArrowsUnreadCount", String(count));

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: "SET_BADGE",
          count: count,
        });
      });
    }

    if (count > 0 && navigator.setAppBadge) {
      navigator.setAppBadge(count).catch(() => {});
    } else if (count === 0 && navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {});
    }
  }, []);

  const sendNotification = useCallback(
    async (toUserId, notification) => {
      const newNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...notification,
        toUserId,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      try {
        await setDoc(
          doc(db, "notifications", newNotification.id),
          newNotification,
        );
      } catch (e) {
        console.log("Error saving notification to Firebase:", e);
      }

      if (user?.id === toUserId) {
        setNotifications((prev) => [newNotification, ...prev]);
        setUnreadCount((prev) => prev + 1);
        updateBadgeCount(unreadCount + 1);
        const existingNotifications = JSON.parse(
          localStorage.getItem("eliteArrowsNotifications") || "[]",
        );
        existingNotifications.unshift(newNotification);
        localStorage.setItem(
          "eliteArrowsNotifications",
          JSON.stringify(existingNotifications),
        );
        showLocalNotification(notification.title || "Elite Arrows", {
          body: notification.message || "New notification",
          data: notification.data,
        });
      }

      return newNotification;
    },
    [user?.id, unreadCount, updateBadgeCount, showLocalNotification],
  );

  const notifyAllSubscribers = useCallback(
    async (title, body, data = {}) => {
      const subscribers = allUsers.filter((u) => u.isSubscribed || u.isAdmin);

      for (const subscriber of subscribers) {
        await sendNotification(subscriber.id, {
          type: data.type || "table_updated",
          title,
          message: body,
          data,
        });
      }

      if (subscribers.some((s) => s.id === user?.id)) {
        setUnreadCount((prev) => prev + subscribers.length);
        updateBadgeCount(unreadCount + subscribers.length);
      }
    },
    [allUsers, user?.id, unreadCount, updateBadgeCount, sendNotification],
  );

  const notifyAdmins = useCallback(
    async (title, body, data = {}) => {
      const admins = allUsers.filter(
        (u) =>
          u.isAdmin ||
          u.isTournamentAdmin ||
          u.isCupAdmin ||
          ADMIN_EMAILS.includes(u.email?.toLowerCase()),
      );

      for (const admin of admins) {
        await sendNotification(admin.id, {
          type: data.type || "admin_alert",
          title,
          message: body,
          data,
        });
      }
    },
    [allUsers, sendNotification],
  );

  const notifyUser = useCallback(
    async (toUserId, title, body, type, data = {}) => {
      await sendNotification(toUserId, {
        type,
        title,
        message: body,
        data,
      });
    },
    [sendNotification],
  );

  const triggerDataRefresh = useCallback((dataType = "all") => {
    setDataRefreshTrigger((prev) => prev + 1);
    if (dataType === "all" || dataType === "cups") {
      setCupsRefreshTrigger((prev) => prev + 1);
    }
  }, []);

  const triggerCupsRefresh = useCallback(() => {
    setCupsRefreshTrigger((prev) => prev + 1);
  }, []);

  const publishResults = useCallback(
    (options = {}) => {
      const { announce = true } = options;

      // Debounce: collapse rapid successive calls (e.g. 4 listeners firing on login) into one
      if (publishDebounceRef.current) clearTimeout(publishDebounceRef.current);
      publishDebounceRef.current = setTimeout(() => {
        publishDebounceRef.current = null;
        const { announce: _announce = true } = options;
        const statusRank = { approved: 3, rejected: 3, pending: 2 };
        let storedOverrides = {};
        try {
          storedOverrides = JSON.parse(
            localStorage.getItem("eliteArrowsResultStatusOverrides") || "{}",
          );
        } catch (error) {
          storedOverrides = {};
        }
        const overrides = {
          ...(resultStatusOverridesRef.current || {}),
          ...storedOverrides,
        };
        resultStatusOverridesRef.current = overrides;

        // 1. Apply status overrides
        const resultRows = (resultRowsRef.current || [])
          .map((row) => {
            if (!row) return null;
            const override = getResultOverrideKeys(row)
              .map((key) => overrides[key])
              .find(Boolean);
            return override ? { ...row, status: override.status } : row;
          })
          .filter(Boolean);

        // 2. Merge duplicates based on Logical ID (Fixture > signature > ID)
        const byLogicalId = new Map();
        resultRows.forEach((row) => {
          const logicalId = getResultIdentityKey(row);
          if (!logicalId) return;

          const existing = byLogicalId.get(logicalId);
          if (!existing) {
            byLogicalId.set(logicalId, row);
            return;
          }

          // Merge logic: prefer version with players, then prefer higher status rank
          const existingHasPlayers = existing.player1 || existing.player2;
          const rowHasPlayers = row.player1 || row.player2;

          // Determine which one is the "better" base
          const useRowAsBase = rowHasPlayers && !existingHasPlayers;
          const base = useRowAsBase ? row : existing;
          const overlay = useRowAsBase ? existing : row;

          const preferredStatus =
            (statusRank[overlay.status] || 0) > (statusRank[base.status] || 0)
              ? overlay.status
              : base.status;

          byLogicalId.set(logicalId, {
            ...overlay,
            ...base,
            id: base.id || overlay.id,
            status: preferredStatus,
            firestoreId: base.firestoreId || overlay.firestoreId,
          });
        });

        const resultsData = Array.from(byLogicalId.values());
        setResults(resultsData);

        // Throttle localStorage write: at most once every 2.5 seconds
        if (!saveResultsCacheThrottleRef.current) {
          saveResultsCache(resultsData);
          saveResultsCacheThrottleRef.current = setTimeout(() => {
            saveResultsCacheThrottleRef.current = null;
          }, 2500);
        }

        if (_announce) {
          triggerDataRefresh("results");
        }
      }, 150);
    },
    [triggerDataRefresh],
  );

  useEffect(() => {
    // Admin data and News should be available even if not logged in
    const unsubscribeAdmin = onSnapshot(
      doc(db, "adminData", "main"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAdminData({
            subscriptionPot: data.subscriptionPot || 0,
            subscriptionPot10: data.subscriptionPot10 || 0,
            moneyHistory: data.moneyHistory || [],
            resultStatusOverrides: data.resultStatusOverrides || {},
            leagueTableResetAt: data.leagueTableResetAt || null,
            isMaintenanceMode: data.isMaintenanceMode || false,
            maintenanceMessage: data.maintenanceMessage || "",
            registrationsEnabled:
              data.registrationsEnabled !== undefined
                ? data.registrationsEnabled
                : true,
            currentSeason: data.currentSeason || "Season 1",
          });
          resultStatusOverridesRef.current = data.resultStatusOverrides || {};

          try {
            localStorage.setItem(
              "eliteArrowsResultStatusOverrides",
              JSON.stringify(data.resultStatusOverrides || {}),
            );
            localStorage.setItem(
              "eliteArrowsSubscriptionPot",
              String(data.subscriptionPot || 0),
            );
            localStorage.setItem(
              "eliteArrowsSubscriptionPot10",
              String(data.subscriptionPot10 || 0),
            );
            localStorage.setItem(
              "eliteArrowsMoneyHistory",
              JSON.stringify(data.moneyHistory || []),
            );
          } catch (e) {
            console.warn("Admin cache failed", e);
          }

          publishResults({ announce: false });
        }
      },
      (error) => {
        // console.log('Admin data listener error:', error)
      },
    );

    const unsubscribeNews = onSnapshot(
      query(collection(db, "news"), orderBy("createdAt", "desc"), limit(20)),
      (snapshot) => {
        const newsData = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item) => !item._deleted);
        setNews(newsData);
        try {
          localStorage.setItem("eliteArrowsNews", JSON.stringify(newsData));
        } catch (e) {}
      },
      (error) => {
        // console.log('News listener error:', error)
        setNews([]);
      },
    );

    let unsubscribeInvites = null;
    if (user?.id) {
      // Listen for Game Invites
      const invitesQuery = query(
        collection(db, "gameInvites"),
        where("toUserId", "==", user.id),
        where("status", "==", "pending"),
      );
      unsubscribeInvites = onSnapshot(invitesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const invite = change.doc.data();
            setPendingGameInvite(invite);
          }
        });
      });
    }

    if (!user?.id) return;

    const hydratedCollections = new Set();
    const announceAfterHydration = (collectionName) => {
      if (!hydratedCollections.has(collectionName)) {
        hydratedCollections.add(collectionName);
        return false;
      }
      triggerDataRefresh(collectionName);
      return true;
    };

    const unsubscribeUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const allFetchedUsers = snapshot.docs.map((doc) => {
          const data = doc.data();
          SENSITIVE_FIELDS.forEach((field) => delete data[field]);
          return { id: doc.id, ...data };
        });

        setAllUsers(allFetchedUsers);
        saveUsersCache(allFetchedUsers);

        const currentUserData = allFetchedUsers.find(
          (item) => String(item.id) === String(user.id),
        );

        // Sync the current user state if changed on another device
        if (currentUserData) {
          setUser(prev => {
             if (JSON.stringify(prev) === JSON.stringify(currentUserData)) return prev;
             return currentUserData;
          });
          localStorage.setItem("eliteArrowsCurrentUser", JSON.stringify(currentUserData));

          if (currentUserData.isBanned) {
            firebaseSignOut(auth);
            setUser(null);
            localStorage.removeItem("eliteArrowsCurrentUser");
            window.location.href = "/auth";
            return;
          }
        }
        announceAfterHydration("users");
      },
      (error) => {
        // console.log('Users listener error:', error)
      },
    );

    // Instead of listening to ALL results, we only listen to PENDING results for admins
    // or RECENT results for everyone.
    const resultsQuery = user?.isAdmin
      ? query(
          collection(db, "results"),
          orderBy("submittedAt", "desc"),
          limit(200),
        )
      : query(
          collection(db, "results"),
          where("status", "==", "approved"),
          orderBy("submittedAt", "desc"),
          limit(500),
        );

    // Targeted listener for user's own results to ensure Home page accuracy.
    // orderBy("submittedAt", "desc") ensures we get the MOST RECENT 50, not the oldest.
    const userResultsQuery1 = !user?.isAdmin
      ? query(
          collection(db, "results"),
          where("player1Id", "==", user.id),
          orderBy("submittedAt", "desc"),
          limit(50),
        )
      : null;
    const userResultsQuery2 = !user?.isAdmin
      ? query(
          collection(db, "results"),
          where("player2Id", "==", user.id),
          orderBy("submittedAt", "desc"),
          limit(50),
        )
      : null;

    const unsubscribeResults = onSnapshot(
      resultsQuery,
      (snapshot) => {
        const newRows = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            ...data,
            id: data.id || docSnap.id,
            firestoreId: docSnap.id,
          };
        });

        const removedIds = snapshot
          .docChanges()
          .filter((c) => c.type === "removed")
          .map((c) => c.doc.data()?.id || c.doc.id);

        const existing = resultRowsRef.current || [];
        const merged = [...existing].filter(
          (r) =>
            r &&
            !removedIds.includes(r.id) &&
            !removedIds.includes(r.firestoreId),
        );
        newRows.forEach((row) => {
          if (!row) return;
          const idx = merged.findIndex((r) => r && r.id === row.id);
          if (idx !== -1) merged[idx] = row;
          else merged.push(row);
        });
        resultRowsRef.current = merged;

        const shouldAnnounce = hydratedCollections.has("results");
        hydratedCollections.add("results");
        publishResults({ announce: shouldAnnounce });
      },
      (error) => {
        // console.log('Results listener error:', error)
      },
    );

    let unsubscribeUserResults1 = null;
    let unsubscribeUserResults2 = null;

    if (userResultsQuery1) {
      unsubscribeUserResults1 = onSnapshot(userResultsQuery1, (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return { ...d, id: d.id || docSnap.id, firestoreId: docSnap.id };
        });
        const removedIds = snapshot
          .docChanges()
          .filter((c) => c.type === "removed")
          .map((c) => c.doc.data()?.id || c.doc.id);
        const existing = resultRowsRef.current || [];
        const merged = [...existing].filter(
          (r) =>
            r &&
            !removedIds.includes(r.id) &&
            !removedIds.includes(r.firestoreId),
        );
        data.forEach((row) => {
          if (!row) return;
          const idx = merged.findIndex((r) => r && r.id === row.id);
          if (idx !== -1) merged[idx] = row;
          else merged.push(row);
        });
        resultRowsRef.current = merged;
        publishResults({ announce: true });
      });
    }
    if (userResultsQuery2) {
      unsubscribeUserResults2 = onSnapshot(userResultsQuery2, (snapshot) => {
        const data = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return { ...d, id: d.id || docSnap.id, firestoreId: docSnap.id };
        });
        const removedIds = snapshot
          .docChanges()
          .filter((c) => c.type === "removed")
          .map((c) => c.doc.data()?.id || c.doc.id);
        const existing = resultRowsRef.current || [];
        const merged = [...existing].filter(
          (r) =>
            r &&
            !removedIds.includes(r.id) &&
            !removedIds.includes(r.firestoreId),
        );
        data.forEach((row) => {
          if (!row) return;
          const idx = merged.findIndex((r) => r && r.id === row.id);
          if (idx !== -1) merged[idx] = row;
          else merged.push(row);
        });
        resultRowsRef.current = merged;
        publishResults({ announce: true });
      });
    }

    let unsubscribeSeasonResults = null;

    // Instead of listening to ALL fixtures, we only listen to user's fixtures or recent ones
    const fixturesQuery = user?.isAdmin
      ? query(
          collection(db, "fixtures"),
          orderBy("createdAt", "desc"),
          limit(100),
        )
      : query(
          collection(db, "fixtures"),
          where("player1Id", "==", user.id),
          limit(50),
        );

    // Fallback query for user as player2
    const fixturesQuery2 = !user?.isAdmin
      ? query(
          collection(db, "fixtures"),
          where("player2Id", "==", user.id),
          limit(50),
        )
      : null;

    const unsubscribeFixtures = onSnapshot(
      fixturesQuery,
      (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item) => !item._deleted);

        setFixtures((prev) => {
          const existing = Array.isArray(prev) ? prev : [];
          const merged = [...existing];
          data.forEach((item) => {
            const idx = merged.findIndex((f) => f.id === item.id);
            if (idx !== -1) merged[idx] = item;
            else merged.push(item);
          });
          return merged;
        });
        announceAfterHydration("fixtures");
      },
      (error) => {
        // console.log('Fixtures listener error:', error)
      },
    );

    let unsubscribeFixtures2 = null;
    if (fixturesQuery2) {
      unsubscribeFixtures2 = onSnapshot(fixturesQuery2, (snapshot) => {
        const data = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item) => !item._deleted);

        setFixtures((prev) => {
          const existing = Array.isArray(prev) ? prev : [];
          const merged = [...existing];
          data.forEach((item) => {
            const idx = merged.findIndex((f) => f.id === item.id);
            if (idx !== -1) merged[idx] = item;
            else merged.push(item);
          });
          return merged;
        });
      });
    }

    // We fetch cups, supportRequests and seasons on-demand now instead of full listeners
    // but we can keep a small one for seasons as it's small and controls logic
    const unsubscribeSeasons = onSnapshot(
      collection(db, "seasons"),
      (snapshot) => {
        const seasonsData = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((item) => !item._deleted);
        setSeasons(seasonsData);
        try {
          localStorage.setItem(
            "eliteArrowsSeasons",
            JSON.stringify(seasonsData),
          );
        } catch (e) {}

        if (seasonsData.length > 0) {
          const activeSeason = seasonsData.find((s) => s.isActive);
          if (activeSeason) {
            localStorage.setItem("eliteArrowsCurrentSeason", activeSeason.name);
          }
        }
        announceAfterHydration("seasons");
      },
      (error) => {
        // console.log('Seasons listener error:', error)
      },
    );

    const unsubscribeBets = onSnapshot(
      query(collection(db, "bets"), where("userId", "==", user.id)),
      (snapshot) => {
        const betsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBets(betsData);
        try {
          localStorage.setItem("eliteArrowsBets", JSON.stringify(betsData));
        } catch (e) {}
        announceAfterHydration("bets");
      },
      (error) => {
        // console.log('Bets listener error:', error)
      },
    );

    return () => {
      unsubscribeUsers();
      unsubscribeResults();
      if (unsubscribeUserResults1) unsubscribeUserResults1();
      if (unsubscribeUserResults2) unsubscribeUserResults2();
      if (unsubscribeSeasonResults) unsubscribeSeasonResults();
      unsubscribeFixtures();
      if (unsubscribeFixtures2) unsubscribeFixtures2();
      unsubscribeSeasons();
      unsubscribeBets();
      unsubscribeNews();
      unsubscribeAdmin();
      if (unsubscribeInvites) unsubscribeInvites();
    };
  }, [user?.id, triggerDataRefresh, publishResults]);

  // Re-fetch cups from Firestore when dataRefreshTrigger changes
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchCups = async () => {
      try {
        const snap = await getDocs(collection(db, "cups"));
        if (cancelled) return;
        const cupsData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCups(cupsData);
        localStorage.setItem("eliteArrowsCups", JSON.stringify(cupsData));
      } catch (e) {}
    };
    fetchCups();
    return () => {
      cancelled = true;
    };
  }, [cupsRefreshTrigger, user]);

  // Auto-launch scheduled seasons
  useEffect(() => {
    if (!user?.isAdmin) return;

    const checkAutoLaunch = async () => {
      const now = new Date();
      const nowTime = now.getTime();

      // Hardcoded Season 2 Auto-Launch Trigger
      const s1End = new Date("2026-06-01T00:00:00").getTime();
      if (nowTime >= s1End && adminData.currentSeason === "Season 1") {
        console.log("Season 1 finished. Triggering Season 2 launch...");

        // Find if Season 2 doc exists, otherwise create basic shell
        const s2Doc = seasons.find((s) => s.name === "Season 2");
        const s2Id = s2Doc?.id || "season2_legacy";

        try {
          // 1. Set Active Season globally
          await updateAdminData({ currentSeason: "Season 2" });

          // 2. Mark as launched in seasons collection
          if (s2Doc) {
            await updateDoc(doc(db, "seasons", s2Id), {
              isLaunched: true,
              status: "active",
              startDate: new Date("2026-06-01T00:00:00").toISOString(),
              endDate: new Date("2026-07-01T00:00:00").toISOString(),
            });
          } else {
            await setDoc(doc(db, "seasons", s2Id), {
              id: s2Id,
              name: "Season 2",
              isLaunched: true,
              status: "active",
              startDate: new Date("2026-06-01T00:00:00").toISOString(),
              endDate: new Date("2026-07-01T00:00:00").toISOString(),
              createdAt: new Date().toISOString(),
            });
          }

          // 3. Process all users: Reset stats and Sync Season 2 subs
          const batch = writeBatch(db);
          const stagedDivisions = s2Doc?.stagedDivisions || {};
          const hasStagedData = Object.keys(stagedDivisions).length > 0;

          allUsers.forEach((u) => {
            const updates = {};
            const isSubscribedForS2 = (u.subscribedSeasons || []).includes(
              "Season 2",
            );
            if (u.isSubscribed !== isSubscribedForS2)
              updates.isSubscribed = isSubscribedForS2;

            // Apply staged divisions - ONLY if we actually have some staged data
            // This prevents accidental wipes if the auto-launch triggers unexpectedly
            if (hasStagedData) {
              const nextDiv = stagedDivisions[u.id] || "Unassigned";
              if (u.division !== nextDiv) updates.division = nextDiv;
            }

            // Clear manual overrides
            if (u.manualStats) updates.manualStats = null;

            if (Object.keys(updates).length > 0) {
              batch.update(doc(db, "users", u.id), updates);
            }
          });
          await batch.commit();
          console.log("Season 2 auto-transition complete.");
          return;
        } catch (e) {
          console.error("Season 2 auto-launch failed:", e);
        }
      }

      // Existing dynamic logic for other seasons
      if (!seasons.length) return;
      const upcomingSeasons = seasons
        .filter(
          (s) =>
            !s.isArchived &&
            s.startDate &&
            new Date(s.startDate) <= now &&
            s.name !== adminData.currentSeason &&
            !s.isLaunched,
        )
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

      if (upcomingSeasons.length > 0) {
        const nextSeason = upcomingSeasons[0];
        console.log("Auto-launching season:", nextSeason.name);

        try {
          // 1. Update active season label
          await updateAdminData({ currentSeason: nextSeason.name });

          // 2. Mark season as launched
          await updateDoc(doc(db, "seasons", nextSeason.id), {
            isLaunched: true,
            status: "active",
          });

          // 3. Update all users' subscription status and apply staged divisions
          const batch = writeBatch(db);
          const stagedDivisions = nextSeason.stagedDivisions || {};

          allUsers.forEach((u) => {
            const updates = {};

            // Sync Subscriptions
            const isSubscribedForNext = (u.subscribedSeasons || []).includes(
              nextSeason.name,
            );
            const shouldBeSubscribed =
              isSubscribedForNext ||
              (nextSeason.name === "Season 1" &&
                (u.isSubscribed || u.subscribedSeasons?.length > 0));
            if (u.isSubscribed !== shouldBeSubscribed)
              updates.isSubscribed = shouldBeSubscribed;

            // Apply Staged Divisions - If not in staged list, they start as Unassigned for the new season
            const nextDiv = stagedDivisions[u.id] || "Unassigned";
            if (u.division !== nextDiv) updates.division = nextDiv;

            // Clear manual stats for the fresh season start
            if (u.manualStats) updates.manualStats = null;

            if (Object.keys(updates).length > 0) {
              batch.update(doc(db, "users", u.id), updates);
            }
          });
          await batch.commit();
          console.log(
            `Auto-launched ${nextSeason.name}, synced subscriptions and applied divisions.`,
          );
          console.log(
            `Auto-launched ${nextSeason.name} and synced subscriptions.`,
          );
        } catch (err) {
          console.error("Error during auto-launch:", err);
        }
      }
    };

    checkAutoLaunch();
    const timer = setInterval(checkAutoLaunch, 60000); // Check every minute
    return () => clearInterval(timer);
  }, [user?.isAdmin, seasons, adminData.currentSeason, allUsers]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            let userData = userDoc.data();
            SENSITIVE_FIELDS.forEach((field) => delete userData[field]);
            const fullUser = { id: userDoc.id, ...userData };
            setUser(fullUser);

            localStorage.setItem(
              "eliteArrowsCurrentUser",
              JSON.stringify(fullUser),
            );
          } else {
            const newUserData = {
              username: firebaseUser.email?.split("@")[0] || "User",
              email: firebaseUser.email,
              threeDartAverage: 0,
              division: null,
              isAdmin: false,
              isTournamentAdmin: false,
              isSubscribed: false,
              freeAdminSubscription: false,
              adminRequestPending: false,
              friends: [],
              isOnline: true,
              showOnlineStatus: true,
              doNotDisturb: false,
              dndEndTime: null,
              eliteTokens: 0,
              lastSeen: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            };
            await setDoc(doc(db, "users", firebaseUser.uid), newUserData);
            const fullUser = { id: firebaseUser.uid, ...newUserData };
            setUser(fullUser);
            localStorage.setItem(
              "eliteArrowsCurrentUser",
              JSON.stringify(fullUser),
            );
          }
        } catch (e) {
          const stored = localStorage.getItem("eliteArrowsCurrentUser");
          if (stored) setUser(JSON.parse(stored));
        }
      } else {
        setUser(null);
        localStorage.removeItem("eliteArrowsCurrentUser");
      }
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Cleanup of any legacy field removal logic
  }, []);

  const signUp = async (userData, rememberMe = false) => {
    const emailLower = userData.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);

    try {
      const { user: firebaseUser } = await createUserWithEmailAndPassword(
        auth,
        userData.email,
        userData.password,
      );

      const { password, threeDartAverage, ...userDataWithoutPassword } =
        userData;

      const newUser = {
        ...userDataWithoutPassword,
        threeDartAverage: threeDartAverage || 0,
        division: isAdmin ? "Admin" : null,
        isAdmin: isAdmin,
        isTournamentAdmin: false,
        isSubscribed: isAdmin || userData.isSubscribed || false,
        freeAdminSubscription: isAdmin || false,
        adminRequestPending: false,
        friends: [],
        isOnline: true,
        showOnlineStatus: true,
        doNotDisturb: false,
        dndEndTime: null,
        eliteTokens: isAdmin ? 500 : 0,
        lastSeen: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);

      const cleanedUser = { ...newUser };
      const fullUser = { id: firebaseUser.uid, ...cleanedUser };
      setUser(fullUser);
      localStorage.setItem("eliteArrowsCurrentUser", JSON.stringify(fullUser));

      const updatedUsers = [...allUsers, fullUser];
      const cleanedUpdated = updatedUsers.map((u) => {
        const { password, ...rest } = u;
        return rest;
      });
      setAllUsers(cleanedUpdated);
      saveUsersCache(cleanedUpdated);

      return newUser;
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const signIn = async (email, password, rememberMe = false) => {
    const stopTrace = startTrace('user_sign_in');
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      );
      const result = await signInWithEmailAndPassword(auth, email, password);
      stopTrace({ success: 'true' });
      logUserLogin(result.user.uid);
      return;
    } catch (error) {
      stopTrace({ success: 'false', error: error.code || 'unknown' });
      throw new Error(error.message);
    }
  };

  const handleSignOut = async () => {
    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.id),
          { isOnline: false, lastSeen: new Date().toISOString() },
          { merge: true },
        );
      } catch (e) {}
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  const updateUser = async (updates, showAlert = true) => {
    if (!user?.id) return;

    const cleanUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && updates[key] !== null) {
        cleanUpdates[key] = updates[key];
      }
    });

    if (Object.keys(cleanUpdates).length === 0) return;

    try {
      const userRef = doc(db, "users", user.id);
      await setDoc(userRef, cleanUpdates, { merge: true });

      const updatedUser = { ...user, ...cleanUpdates };
      setUser(updatedUser);
      localStorage.setItem(
        "eliteArrowsCurrentUser",
        JSON.stringify(updatedUser),
      );

      setAllUsers((prev) => {
        const currentUsers = Array.isArray(prev) ? prev : [];
        const updated = currentUsers.map((u) =>
          u.id === user.id ? { ...u, ...cleanUpdates } : u,
        );
        saveUsersCache(updated);
        return updated;
      });

      if (cleanUpdates.isSubscribed) {
        logSubscriptionActivated(
          user.id,
          cleanUpdates.subscriptionTier || "standard",
        );
      }

      if (showAlert) alert("Profile updated!");
    } catch (error) {
      if (showAlert) alert("Error updating profile: " + error.message);
      console.error("updateUser error:", error);
    }
  };

  const updateOtherUser = async (userId, updates) => {
    const cleanUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        cleanUpdates[key] = updates[key];
      }
    });

    if (Object.keys(cleanUpdates).length === 0) return;

    try {
      const userRef = doc(db, "users", userId);
      await setDoc(userRef, cleanUpdates, { merge: true });

      if (userId === user?.id) {
        const updatedUser = { ...user, ...cleanUpdates };
        setUser(updatedUser);
        localStorage.setItem(
          "eliteArrowsCurrentUser",
          JSON.stringify(updatedUser),
        );
      }

      setAllUsers((prev) => {
        const sourceUsers =
          prev.length > 0
            ? prev
            : JSON.parse(localStorage.getItem("eliteArrowsUsers") || "[]");
        const updated = sourceUsers.map((u) =>
          u.id === userId ? { ...u, ...cleanUpdates } : u,
        );
        saveUsersCache(updated);
        return updated;
      });
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  };

  const addUserManually = async (userData) => {
    const emailLower = userData.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);

    const newUser = {
      ...userData,
      threeDartAverage: userData.threeDartAverage || 0,
      division: null,
      isAdmin: isAdmin,
      isTournamentAdmin: false,
      isSubscribed: isAdmin || userData.isSubscribed || false,
      adminRequestPending: false,
      friends: [],
      isOnline: false,
      showOnlineStatus: true,
      doNotDisturb: false,
      dndEndTime: null,
      eliteTokens: userData.eliteTokens || 0,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const tempId = Date.now().toString();
    await setDoc(doc(db, "tempUsers", tempId), newUser);
    return { id: tempId, ...newUser };
  };

  const addFriend = async (friendId) => {
    if (!user) return;
    if ((user.friends || []).includes(friendId)) {
      return;
    }

    const allUsersData = getAllUsers();
    const friendUser = allUsersData.find((u) => u.id === friendId);
    if (!friendUser) {
      return;
    }

    const userFriends = Array.from(
      new Set([...(user.friends || []), friendId]),
    );
    const friendFriends = Array.from(
      new Set([...(friendUser.friends || []), user.id]),
    );

    await updateUser(
      {
        friends: userFriends,
        sentFriendRequests: (user.sentFriendRequests || []).filter(
          (id) => id !== friendId,
        ),
        receivedFriendRequests: (user.receivedFriendRequests || []).filter(
          (id) => id !== friendId,
        ),
      },
      false,
    );
    try {
      await updateOtherUser(friendId, {
        friends: friendFriends,
        sentFriendRequests: (friendUser.sentFriendRequests || []).filter(
          (id) => id !== user.id,
        ),
        receivedFriendRequests: (
          friendUser.receivedFriendRequests || []
        ).filter((id) => id !== user.id),
      });
    } catch (error) {
      console.warn("Could not update friend record immediately:", error);
    }

    const notification = {
      id: `friend_added_${Date.now()}`,
      type: "friend_accepted",
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: friendId,
      toUsername: friendUser?.username || "Unknown",
      message: `${user.username} added you as a friend`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    const existingNotifications = JSON.parse(
      localStorage.getItem("eliteArrowsNotifications") || "[]",
    );
    localStorage.setItem(
      "eliteArrowsNotifications",
      JSON.stringify([...existingNotifications, notification]),
    );

    try {
      await setDoc(doc(db, "notifications", notification.id), notification);
    } catch (e) {
      // console.log('Error saving to Firebase:', e)
    }
  };

  const acceptFriendRequest = async (userId) => {
    if (!user) return;
    const allUsersData = getAllUsers();
    const requestUser = allUsersData.find((u) => u.id === userId);
    if (!requestUser) return;

    const currentFriends = user.friends || [];
    const currentRequests = user.receivedFriendRequests || [];
    const newFriends = Array.from(new Set([...currentFriends, userId]));
    const newRequests = currentRequests.filter((id) => id !== userId);
    await updateUser(
      { friends: newFriends, receivedFriendRequests: newRequests },
      false,
    );
    await updateOtherUser(userId, {
      friends: Array.from(new Set([...(requestUser.friends || []), user.id])),
      sentFriendRequests: (requestUser.sentFriendRequests || []).filter(
        (id) => id !== user.id,
      ),
    });

    const notification = {
      id: `friend_accepted_${Date.now()}`,
      type: "friend_accepted",
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId: userId,
      toUsername: requestUser?.username || "Unknown",
      message: `${user.username} accepted your friend request`,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    const existingNotifications = JSON.parse(
      localStorage.getItem("eliteArrowsNotifications") || "[]",
    );
    localStorage.setItem(
      "eliteArrowsNotifications",
      JSON.stringify([...existingNotifications, notification]),
    );

    try {
      await setDoc(doc(db, "notifications", notification.id), notification);
    } catch (e) {
      // console.log('Error saving to Firebase:', e)
    }
  };

  const declineFriendRequest = async (userId) => {
    if (!user) return;
    const requestUser = getAllUsers().find((u) => u.id === userId);
    const currentRequests = user.receivedFriendRequests || [];
    await updateUser(
      { receivedFriendRequests: currentRequests.filter((id) => id !== userId) },
      false,
    );
    if (requestUser) {
      await updateOtherUser(userId, {
        sentFriendRequests: (requestUser.sentFriendRequests || []).filter(
          (id) => id !== user.id,
        ),
      });
    }
  };

  const cancelFriendRequest = async (userId) => {
    if (!user) return;
    const requestUser = getAllUsers().find((u) => u.id === userId);
    const currentSent = user.sentFriendRequests || [];
    await updateUser(
      { sentFriendRequests: currentSent.filter((id) => id !== userId) },
      false,
    );
    if (requestUser) {
      await updateOtherUser(userId, {
        receivedFriendRequests: (
          requestUser.receivedFriendRequests || []
        ).filter((id) => id !== user.id),
      });
    }
  };

  const removeFriend = async (friendId) => {
    if (!user) return;
    const friendUser = getAllUsers().find((u) => u.id === friendId);
    const newFriends = (user.friends || []).filter((id) => id !== friendId);
    await updateUser({ friends: newFriends }, false);
    if (friendUser) {
      await updateOtherUser(friendId, {
        friends: (friendUser.friends || []).filter((id) => id !== user.id),
      });
    }
  };

  const subscribe = () => {
    updateUser({ isSubscribed: true, paymentDate: new Date().toISOString() });
  };

  const requestAdminRole = () => {
    updateUser({ adminRequestPending: true });
  };

  const getAllUsers = useCallback(() => {
    if (Array.isArray(allUsers) && allUsers.length > 0) return allUsers;
    try {
      const localUsers = JSON.parse(
        localStorage.getItem("eliteArrowsUsers") || "[]",
      );
      return Array.isArray(localUsers) ? localUsers : [];
    } catch (e) {
      return [];
    }
  }, [allUsers]);

  const getFriends = useCallback(() => {
    return allUsers.filter((u) => (user?.friends || []).includes(u.id));
  }, [allUsers, user?.friends]);

  const getResults = useCallback(() => {
    if (Array.isArray(results) && results.length > 0) return results;
    const cached = getCachedResults();
    return Array.isArray(cached) ? cached : [];
  }, [results]);

  const updateResults = useCallback((updatedResults, purgeScope = null) => {
    const nextResults = Array.isArray(updatedResults) ? updatedResults : []

    // If purgeScope is provided, remove any results that match the scope criteria
    // but are NOT in the fresh nextResults set.
    let existing = resultRowsRef.current || []

    if (purgeScope) {
      existing = existing.filter(r => {
        if (!r) return false

        // Scope logic: e.g., { season: 'Season 2', status: 'approved' }
        const matchesScope = Object.keys(purgeScope).every(key => {
          if (key === 'season') {
            const pSeason = String(purgeScope[key] || '')
            if (pSeason === 'Season 1') {
              // Season 1 has legacy results with missing/varied season fields — use broad match
              const rSeason = String(r.season || '').replace(/\s+/g, '').toLowerCase()
              return rSeason === 'season1' || rSeason === '' || rSeason === '2026' || rSeason === 'legacy'
            }
            // All other seasons: exact match only — must align with what the Firestore
            // query returns (case-sensitive). Avoid purging results that differ only in
            // case/whitespace since the query would not have returned them.
            return r.season === pSeason
          }
          return String(r[key]) === String(purgeScope[key])
        })

        if (matchesScope) {
          // Keep only if it's in the nextResults (fresh from server)
          // or if it's the user's own result (to preserve local pending/un-synced stuff)
          const isFresh = nextResults.some(nr => (nr.id === r.id || nr.firestoreId === r.firestoreId))
          const isMine = r.player1Id === user?.id || r.player2Id === user?.id || r.submittedBy === user?.id
          return isFresh || isMine
        }
        return true
      })
    }

    const merged = [...existing].filter(Boolean)
    nextResults.forEach(row => {
      if (!row) return
      const idx = merged.findIndex(r => r && (r.id === row.id))
      if (idx !== -1) merged[idx] = row
      else merged.push(row)
    })

    resultRowsRef.current = merged
    publishResults({ announce: true })
    saveResultsCache(merged)
  }, [publishResults, user?.id])

  const removeResult = useCallback((resultId) => {
    const existing = resultRowsRef.current || []
    const updated = existing.filter(r =>
      String(r.id) !== String(resultId) &&
      String(r.firestoreId) !== String(resultId)
    )
    resultRowsRef.current = updated
    publishResults({ announce: true })
    saveResultsCache(updated)
  }, [publishResults])

  const fetchMoreResults = useCallback(
    async (lastResult = null, limitCount = 50) => {
      try {
        let q = query(
          collection(db, "results"),
          where("status", "==", "approved"),
          orderBy("submittedAt", "desc"),
          limit(limitCount),
        );

        const snapshot = await getDocsFromServer(q);
        const data = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return { ...d, id: d.id || docSnap.id, firestoreId: docSnap.id };
        });

        const existing = resultRowsRef.current || [];
        const merged = [...existing];
        data.forEach((item) => {
          const idx = merged.findIndex((r) => r.id === item.id);
          if (idx === -1) merged.push(item);
        });
        resultRowsRef.current = merged;
        publishResults({ announce: true });

        return data;
      } catch (e) {
        console.error("fetchMoreResults error:", e);
        return [];
      }
    },
    [publishResults],
  );

  const fetchResultsBySeason = useCallback(
    async (seasonName) => {
      const stopTrace = startTrace('fetch_results_by_season');
      try {
        // For Season 1, we fetch more broadly to catch legacy results that might not have the 'season' field set
        const q =
          seasonName === "Season 1"
            ? query(
                collection(db, "results"),
                where("status", "==", "approved"),
              )
            : query(
                collection(db, "results"),
                where("season", "==", seasonName),
                where("status", "==", "approved"),
              );

        const snapshot = await getDocsFromServer(q);
        const seasonResults = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            ...data,
            id: data.id || docSnap.id,
            firestoreId: docSnap.id,
          };
        });

      // Only run the purge if we actually got results back. An empty response likely
      // means a data/index issue — purging on empty would wipe everything from memory.
      if (seasonResults.length > 0) {
        updateResults(seasonResults, { season: seasonName, status: "approved" });
      } else {
        updateResults(seasonResults); // merge without purge
      }
      stopTrace({ season: seasonName, result_count: String(seasonResults.length) });

      return seasonResults;
    } catch (e) {
      console.error("fetchResultsBySeason error:", e);
      stopTrace({ season: seasonName, error: 'true' });
      return [];
    }
  }, [updateResults]);

  const fetchFixturesBySeason = useCallback(async (seasonName) => {
    try {
      // For now, season logic in fixtures might be via division or cupId
      // If there's no season field in fixtures, we might just fetch all recent public ones
      const q = query(
        collection(db, "fixtures"),
        orderBy("createdAt", "desc"),
        limit(200),
      );
      const snapshot = await getDocsFromServer(q);
      const data = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter((item) => !item._deleted);

      setFixtures((prev) => {
        const merged = [...prev];
        data.forEach((item) => {
          const idx = merged.findIndex((f) => f.id === item.id);
          if (idx !== -1) merged[idx] = item;
          else merged.push(item);
        });
        return merged;
      });
      return data;
    } catch (e) {
      console.error("fetchFixturesBySeason error:", e);
      return [];
    }
  }, []);

  const fetchUsersByDivision = useCallback(async (division) => {
    try {
      const isSuperDivision = ['Premier', 'Pro', 'Amateur'].includes(division);
      const q =
        division === "Overall"
          ? query(collection(db, "users"), limit(500))
          : isSuperDivision
            ? query(collection(db, "users"), where("superLeagueDivision", "==", division))
            : query(collection(db, "users"), where("division", "==", division));

      const snapshot = await getDocsFromServer(q);
      const users = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        SENSITIVE_FIELDS.forEach((f) => delete data[f]);
        return { id: docSnap.id, ...data };
      });

      setAllUsers((prev) => {
        const merged = [...prev];
        users.forEach((u) => {
          const idx = merged.findIndex((ex) => ex.id === u.id);
          if (idx === -1) merged.push(u);
          else merged[idx] = u;
        });
        return merged;
      });
      return users;
    } catch (e) {
      console.error("fetchUsersByDivision error:", e);
      return [];
    }
  }, []);

  const searchUsers = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) return [];
    try {
      const q = query(
        collection(db, "users"),
        where("username", ">=", searchTerm),
        where("username", "<=", searchTerm + "\uf8ff"),
        limit(20),
      );
      const snapshot = await getDocsFromServer(q);
      const users = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        SENSITIVE_FIELDS.forEach((f) => delete data[f]);
        return { id: docSnap.id, ...data };
      });

      // Merge into allUsers state to keep profile data available
      setAllUsers((prev) => {
        const merged = [...prev];
        users.forEach((u) => {
          const idx = merged.findIndex((ex) => ex.id === u.id);
          if (idx === -1) merged.push(u);
        });
        return merged;
      });
      return users;
    } catch (e) {
      console.error("searchUsers error:", e);
      return [];
    }
  }, []);

  const sendGameInvite = async (toUserId, gameConfig) => {
    if (!user) return;
    const inviteId = `invite_${Date.now()}`;
    const invite = {
      id: inviteId,
      fromUserId: user.id,
      fromUsername: user.username,
      toUserId,
      status: "pending",
      config: gameConfig,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, "gameInvites", inviteId), invite);

    await notifyUser(
      toUserId,
      "New Game Request",
      `${user.username} has invited you to a live match!`,
      "game_invite",
      { inviteId },
    );
    return inviteId;
  };

  const acceptGameInvite = async (invite) => {
    const gameId = `game_${Date.now()}`;
    const gameState = {
      id: gameId,
      players: [invite.fromUserId, invite.toUserId],
      playerNames: {
        [invite.fromUserId]: invite.fromUsername,
        [invite.toUserId]: user.username,
      },
      scores: {
        [invite.fromUserId]: invite.config.startScore || 501,
        [invite.toUserId]: invite.config.startScore || 501,
      },
      turn: invite.fromUserId,
      history: [],
      status: "active",
      config: invite.config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, "liveGames", gameId), gameState);
    await updateDoc(doc(db, "gameInvites", invite.id), {
      status: "accepted",
      gameId,
    });

    await notifyUser(
      invite.fromUserId,
      "Match Accepted",
      `${user.username} accepted your invite!`,
      "game_accepted",
      { gameId },
    );
    return gameId;
  };

  const forceFetchResults = useCallback(async () => {
    try {
      showToast?.("Performing deep sync with server...", "info");

      // 1. Fetch Results - Get approved results for current season
      const currentSeason = adminData?.currentSeason || "Season 1";

      // IMPORTANT: Using getDocsFromServer to bypass local cache entirely
      let resultsSnap;
      try {
        const q = (currentSeason === "Season 1" || !currentSeason)
          ? query(collection(db, "results"), where("status", "==", "approved"))
          : query(collection(db, "results"), where("season", "==", currentSeason), where("status", "==", "approved"));

        resultsSnap = await getDocsFromServer(q);
      } catch (queryErr) {
        console.warn("Season-specific query failed, falling back to broad fetch:", queryErr);
        const fallbackQ = query(collection(db, "results"), where("status", "==", "approved"));
        resultsSnap = await getDocsFromServer(fallbackQ);
      }

      const freshResults = resultsSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        return { ...data, id: data.id || docSnap.id, firestoreId: docSnap.id };
      });

      // 2. Fetch Users
      const usersSnap = await getDocsFromServer(query(collection(db, "users"), limit(1000)));
      const freshUsers = usersSnap.docs.map((docSnap) => {
        const data = docSnap.data();
        SENSITIVE_FIELDS.forEach((f) => delete data[f]);
        return { id: docSnap.id, ...data };
      });

      // 3. Update state and REPLACE local cache
      setAllUsers(freshUsers);
      saveUsersCache(freshUsers);

      // Replace resultRowsRef with fresh data only
      resultRowsRef.current = freshResults;

      publishResults({ announce: true });
      saveResultsCache(freshResults);

      const current = freshUsers.find((u) => u.id === user?.id);
      if (current) {
        setUser(current);
        localStorage.setItem("eliteArrowsCurrentUser", JSON.stringify(current));
      }

      triggerDataRefresh("all");
      return true;
    } catch (e) {
      console.error("forceFetchResults failed:", e);
      showToast?.("Sync failed: " + (e.message || "Network Error"), "error");
      return false;
    }
  }, [publishResults, user, triggerDataRefresh, showToast, adminData?.currentSeason]);

  const getFixtures = useCallback(() => {
    if (Array.isArray(fixtures) && fixtures.length > 0) return fixtures;
    try {
      const local = JSON.parse(
        localStorage.getItem("eliteArrowsFixtures") || "[]",
      );
      return Array.isArray(local) ? local : [];
    } catch (e) {
      return [];
    }
  }, [fixtures]);

  useEffect(() => {
    if (!user?.id) {
      setShowSeasonOneWelcome(false);
      return;
    }

    const updateSeasonOneWelcome = () => {
      const isSubscriberOrAdmin =
        user.isSubscribed || user.isAdmin || user.isTournamentAdmin;
      const seasonHasStarted = Date.now() >= SEASON_ONE_WELCOME_START;
      const localAcknowledged =
        localStorage.getItem(`eliteArrowsSeasonOneWelcome_${user.id}`) ===
        "acknowledged";
      setShowSeasonOneWelcome(
        Boolean(
          isSubscriberOrAdmin &&
          seasonHasStarted &&
          !user.seasonOneWelcomeAcknowledged &&
          !localAcknowledged,
        ),
      );
    };

    updateSeasonOneWelcome();

    const delayUntilSeasonStarts = SEASON_ONE_WELCOME_START - Date.now();
    if (delayUntilSeasonStarts <= 0) return;

    const timer = setTimeout(
      updateSeasonOneWelcome,
      Math.min(delayUntilSeasonStarts, 2147483647),
    );
    return () => clearTimeout(timer);
  }, [
    user?.id,
    user?.isSubscribed,
    user?.isAdmin,
    user?.isTournamentAdmin,
    user?.seasonOneWelcomeAcknowledged,
  ]);

  const acknowledgeSeasonOneWelcome = async () => {
    if (!user?.id) return;
    const acknowledgedAt = new Date().toISOString();
    localStorage.setItem(
      `eliteArrowsSeasonOneWelcome_${user.id}`,
      "acknowledged",
    );
    setShowSeasonOneWelcome(false);
    await updateUser(
      {
        seasonOneWelcomeAcknowledged: true,
        seasonOneWelcomeAcknowledgedAt: acknowledgedAt,
        refundPolicyAcknowledged: true,
        refundPolicyAcknowledgedAt: acknowledgedAt,
      },
      false,
    );
    window.location.reload();
  };

  const updateFixtures = (updatedFixtures) => {
    setFixtures(updatedFixtures);
    localStorage.setItem(
      "eliteArrowsFixtures",
      JSON.stringify(updatedFixtures),
    );
    triggerDataRefresh("fixtures");
  };

  const advanceCupBracket = async (result) => {
    if (!result.cupId || !result.matchId) {
      console.warn(
        "advanceCupBracket: result missing cupId or matchId",
        result.id,
      );
      return;
    }
    if (String(result.status).toLowerCase() !== "approved") {
      console.warn(
        "advanceCupBracket: result not approved yet",
        result.id,
        result.status,
      );
      return;
    }

    const cupId = String(result.cupId);
    const matchId = String(result.matchId);
    const winnerId =
      result.score1 > result.score2 ? result.player1Id : result.player2Id;

    if (!winnerId) {
      console.warn(
        "advanceCupBracket: could not determine winner",
        result.id,
        result.score1,
        result.score2,
        result.player1Id,
        result.player2Id,
      );
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const cupRef = doc(db, "cups", cupId);
        const cupSnap = await transaction.get(cupRef);
        if (!cupSnap.exists()) return;

        const cupData = cupSnap.data();
        if (!cupData.matches) return;

        const updatedMatches = [...cupData.matches];
        const matchIdx = updatedMatches.findIndex(
          (m) => String(m.id) === matchId,
        );
        if (matchIdx === -1) return;

        const match = updatedMatches[matchIdx];

        // 1. Validation: Ensure both players are present before advancing.
        // This prevents "ghost" wins where a player advances without an opponent.
        if (!match.player1 || !match.player2) {
           console.warn(`advanceCupBracket: Aborted advancement for match ${matchId}. Missing opponent: p1=${match.player1}, p2=${match.player2}`);
           return;
        }

        // Correct score mapping based on who is player1 in the bracket
        const isPlayer1Submitter =
          String(result.player1Id) === String(match.player1);
        const s1 = isPlayer1Submitter ? result.score1 : result.score2;
        const s2 = isPlayer1Submitter ? result.score2 : result.score1;

        // Check if anything changed to avoid unnecessary writes
        const matchUpdated =
          match.winner !== winnerId ||
          match.score1 !== s1 ||
          match.score2 !== s2 ||
          match.resultId !== result.id;

        if (matchUpdated) {
          updatedMatches[matchIdx] = {
            ...match,
            winner: winnerId,
            score1: s1,
            score2: s2,
            resultId: result.id,
          };
        }

        let needsCupUpdate = matchUpdated;

        if (match.nextMatchId) {
          const nextMatchIdx = updatedMatches.findIndex(
            (m) => String(m.id) === String(match.nextMatchId),
          );
          if (nextMatchIdx !== -1) {
            const siblings = updatedMatches
              .filter(
                (m) =>
                  Number(m.round) === Number(match.round) &&
                  String(m.nextMatchId) === String(match.nextMatchId),
              )
              .sort(
                (a, b) => {
                  const diff = (Number(a.matchNum) || 0) - (Number(b.matchNum) || 0);
                  if (diff !== 0) return diff;
                  return String(a.id).localeCompare(String(b.id));
                }
              );

            const siblingPos = siblings.findIndex(
              (m) => String(m.id) === matchId,
            );
            if (siblingPos !== -1) {
              const targetPlayer = siblingPos === 0 ? "player1" : "player2";
              if (updatedMatches[nextMatchIdx][targetPlayer] !== winnerId) {
                updatedMatches[nextMatchIdx] = {
                  ...updatedMatches[nextMatchIdx],
                  [targetPlayer]: winnerId,
                };
                needsCupUpdate = true;
              }

              // Create fixture inside transaction if next match is now ready
              const nextMatch = updatedMatches[nextMatchIdx];
              if (nextMatch.player1 && nextMatch.player2 && !nextMatch.winner) {
                const fixtureId = `cup_${cupId}_match_${nextMatch.id}`;
                const existingFixtures = getFixtures();
                const existsLocally = existingFixtures.some(
                  (f) => String(f.id) === fixtureId,
                );

                if (!existsLocally) {
                  const fixtureRef = doc(db, "fixtures", fixtureId);
                  const fixtureSnap = await transaction.get(fixtureRef);

                  if (!fixtureSnap.exists()) {
                    const format = cupData.roundFormats?.[nextMatch.round] || {
                      startScore: 501,
                      bestOf: 3,
                    };
                    transaction.set(fixtureRef, {
                      id: fixtureId,
                      cupId: isNaN(parseInt(cupId)) ? cupId : parseInt(cupId),
                      cupName: cupData.name,
                      startScore: format.startScore,
                      bestOf: format.bestOf,
                      firstTo: Math.ceil(format.bestOf / 2),
                      player1: nextMatch.player1,
                      player1Id: nextMatch.player1,
                      player2: nextMatch.player2,
                      player2Id: nextMatch.player2,
                      matchId: nextMatch.id,
                      round: nextMatch.round,
                      status: "accepted",
                      proposalStatus: "accepted",
                      createdAt: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        }

        const allComplete = updatedMatches.every((m) => {
          if (!m.player1 || !m.player2) return true;
          return m.winner !== null;
        });

        let currentRound = cupData.currentRound || 1;
        const roundMatches = updatedMatches.filter(
          (m) => Number(m.round) === Number(currentRound),
        );
        const roundComplete = roundMatches.every((m) => m.winner);
        if (roundComplete) {
          const maxRound = Math.max(...updatedMatches.map((m) => m.round));
          if (currentRound < maxRound) {
            currentRound++;
            needsCupUpdate = true;
          }
        }

        if (cupData.status === "active" && allComplete) needsCupUpdate = true;

        if (needsCupUpdate) {
          transaction.update(cupRef, {
            matches: updatedMatches,
            status: allComplete ? "completed" : "active",
            currentRound,
          });
          // Trigger local state refresh
          triggerCupsRefresh();
        }
      });
    } catch (err) {
      if (err.code === "resource-exhausted") {
        console.error("Firestore Quota Exceeded. Reached free tier limit.");
      } else {
        console.error("Error advancing cup bracket", err);
      }
      throw err;
    }
  };

  const getCups = useCallback(() => {
    if (Array.isArray(cups) && cups.length > 0) return cups;
    try {
      const local = JSON.parse(localStorage.getItem("eliteArrowsCups") || "[]");
      return Array.isArray(local) ? local : [];
    } catch (e) {
      return [];
    }
  }, [cups]);

  const getSupportRequests = useCallback(() => {
    if (supportRequests.length > 0) return supportRequests;
    const local = JSON.parse(
      localStorage.getItem("eliteArrowsSupportRequests") || "[]",
    );
    return local;
  }, [supportRequests]);

  const getSeasons = useCallback(() => {
    const allSeasons =
      seasons.length > 0
        ? seasons
        : JSON.parse(localStorage.getItem("eliteArrowsSeasons") || "[]");

    // Admins see all seasons (including upcoming ones)
    if (user?.isAdmin || user?.isTournamentAdmin) return allSeasons;

    // Regular users only see seasons that have already started OR upcoming ones that are marked active/upcoming
    const now = new Date();
    return allSeasons.filter((s) => {
      if (s.isArchived) return true; // Keep archived seasons visible in history
      if (!s.startDate) return true; // Legacy seasons without start date

      const isUpcoming =
        s.status === "upcoming" || (s.startDate && new Date(s.startDate) > now);
      const isStarted = new Date(s.startDate) <= now;

      return isStarted || isUpcoming;
    });
  }, [seasons, user?.isAdmin, user?.isTournamentAdmin]);

  const getNews = useCallback(() => {
    if (news.length > 0) return news;
    const local = JSON.parse(localStorage.getItem("eliteArrowsNews") || "[]");
    return local;
  }, [news]);

  const postNews = async (title, message, pinned = false) => {
    if (!user) return;
    const newPost = {
      id: `news_${Date.now()}`,
      title,
      message,
      authorId: user.id,
      authorName: user.username,
      createdAt: new Date().toISOString(),
      pinned,
    };
    try {
      await setDoc(doc(db, "news", newPost.id), newPost, { merge: true });
    } catch (e) {
      // console.log('Error posting news to Firebase:', e)
    }
    const local = JSON.parse(localStorage.getItem("eliteArrowsNews") || "[]");
    local.unshift(newPost);
    localStorage.setItem("eliteArrowsNews", JSON.stringify(local));
    setNews(local);
  };

  const deleteNews = async (newsId) => {
    try {
      await deleteDoc(doc(db, "news", newsId));
    } catch (e) {
      // console.log('Error deleting news from Firebase:', e)
    }
    const local = JSON.parse(localStorage.getItem("eliteArrowsNews") || "[]");
    const updated = local.filter((n) => n.id !== newsId);
    localStorage.setItem("eliteArrowsNews", JSON.stringify(updated));
    setNews(updated);
  };

  const togglePinNews = async (newsId, currentPinned) => {
    try {
      await setDoc(
        doc(db, "news", newsId),
        { pinned: !currentPinned },
        { merge: true },
      );
    } catch (e) {
      // console.log('Error pinning news:', e)
    }
    const local = JSON.parse(localStorage.getItem("eliteArrowsNews") || "[]");
    const updated = local.map((n) =>
      n.id === newsId ? { ...n, pinned: !currentPinned } : n,
    );
    localStorage.setItem("eliteArrowsNews", JSON.stringify(updated));
    setNews(updated);
  };

  const addTokens = async (amount) => {
    if (!user) return;
    const newTokens = (user.eliteTokens || 0) + amount;
    await updateUser({ eliteTokens: newTokens }, false);
  };

  const useTokens = async (amount) => {
    if (!user) return false;
    if ((user.eliteTokens || 0) < amount) return false;
    const newTokens = (user.eliteTokens || 0) - amount;
    await updateUser({ eliteTokens: newTokens });
    return true;
  };

  const updateAdminData = async (newData) => {
    try {
      await setDoc(doc(db, "adminData", "main"), newData, { merge: true });
      setAdminData((prev) => {
        const next = { ...prev, ...newData };
        try {
          if (
            Object.prototype.hasOwnProperty.call(
              newData,
              "resultStatusOverrides",
            )
          ) {
            resultStatusOverridesRef.current =
              newData.resultStatusOverrides || {};
            localStorage.setItem(
              "eliteArrowsResultStatusOverrides",
              JSON.stringify(newData.resultStatusOverrides || {}),
            );
          }
          if (
            Object.prototype.hasOwnProperty.call(newData, "subscriptionPot")
          ) {
            localStorage.setItem(
              "eliteArrowsSubscriptionPot",
              String(newData.subscriptionPot || 0),
            );
          }
          if (
            Object.prototype.hasOwnProperty.call(newData, "subscriptionPot10")
          ) {
            localStorage.setItem(
              "eliteArrowsSubscriptionPot10",
              String(newData.subscriptionPot10 || 0),
            );
          }
          if (Object.prototype.hasOwnProperty.call(newData, "moneyHistory")) {
            localStorage.setItem(
              "eliteArrowsMoneyHistory",
              JSON.stringify(newData.moneyHistory || []),
            );
          }
        } catch (e) {
          if (e.name === "QuotaExceededError" || e.code === 22) {
            localStorage.removeItem("eliteArrowsResultStatusOverrides");
            localStorage.removeItem("eliteArrowsMoneyHistory");
          }
        }
        return next;
      });
    } catch (e) {
      console.error("Error updating admin data:", e);
    }
  };

  const addToMoneyHistory = async (type, amount, description) => {
    try {
      const docRef = doc(db, "adminData", "main");
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};
      const currentHistory = currentData.moneyHistory || [];
      const newEntry = {
        id: Date.now(),
        type,
        amount,
        description,
        date: new Date().toISOString(),
      };
      await setDoc(
        docRef,
        { moneyHistory: [...currentHistory, newEntry] },
        { merge: true },
      );
    } catch (e) {
      console.error("Error adding to money history:", e);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      updateBadgeCount(0);
      seenNotificationIdsRef.current = new Set();
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("toUserId", "==", user.id),
    );
    const unsubscribeNotifications = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const userNotifs = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data();
            return {
              ...data,
              id: data.id || docSnap.id,
              notificationDocId: docSnap.id,
            };
          })
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const previousIds = seenNotificationIdsRef.current;
        const nextIds = new Set(
          userNotifs.map((notification) => notification.id),
        );
        const shouldAnnounceNewNotifications = previousIds.size > 0;

        userNotifs.forEach((notification) => {
          if (
            shouldAnnounceNewNotifications &&
            !previousIds.has(notification.id) &&
            !notification.isRead
          ) {
            showLocalNotification(notification.title || "Elite Arrows", {
              body: notification.message || "New notification",
              data: notification.data,
            });
            showToast(
              notification.message || notification.title || "New notification",
              "info",
            );
          }
        });

        seenNotificationIdsRef.current = nextIds;
        setNotifications(userNotifs);
        localStorage.setItem(
          "eliteArrowsNotifications",
          JSON.stringify(userNotifs),
        );
        const unread = userNotifs.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
        updateBadgeCount(unread);
      },
      (error) => {
        console.log("Notifications listener error:", error);
        const storedNotifs = JSON.parse(
          localStorage.getItem("eliteArrowsNotifications") || "[]",
        );
        const userNotifs = storedNotifs.filter((n) => n.toUserId === user.id);
        setNotifications(userNotifs);
        const unread = userNotifs.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
        updateBadgeCount(unread);
      },
    );

    return () => unsubscribeNotifications();
  }, [user?.id, showLocalNotification, updateBadgeCount]);

  useEffect(() => {
    const setupForegroundMessages = async () => {
      try {
        const messaging = await getMessagingInstance();
        if (!messaging) return;

        onMessage(messaging, (payload) => {
          console.log("Foreground message received:", payload);

          const { title, body, data } = payload;

          if (Notification.permission === "granted") {
            new Notification(title || "Elite Arrows", {
              body: body || "New notification",
              icon: "/elite arrows.jpg",
              badge: "/elite arrows.jpg",
              data: data,
            });
          }
        });
      } catch (error) {
        console.log("FCM onMessage setup error:", error);
      }
    };

    if (user?.id) {
      setupForegroundMessages();
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    const storedToken = localStorage.getItem("eliteArrowsFcmToken");
    if (storedToken) {
      setFcmToken(storedToken);
    }

    const storedUnread = localStorage.getItem("eliteArrowsUnreadCount");
    if (storedUnread) {
      setUnreadCount(parseInt(storedUnread) || 0);
    }
  }, []);

  const dismissGameInvite = useCallback(() => setPendingGameInvite(null), []);

  const handleAcceptGameInvite = useCallback(async () => {
    if (!pendingGameInvite) return;
    const gameId = await acceptGameInvite(pendingGameInvite);
    setPendingGameInvite(null);
    if (gameId && typeof window !== "undefined") {
      window.location.href = `/live-match?gameId=${gameId}`;
    }
  }, [pendingGameInvite, acceptGameInvite]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        allUsers,
        notifications,
        results,
        fixtures,
        cups,
        supportRequests,
        seasons,
        dataRefreshTrigger,
        adminData,
        notificationPermission,
        fcmToken,
        unreadCount,
        news,
        triggerDataRefresh,
        triggerCupsRefresh,
        requestNotificationPermission,
        registerFCMToken,
        showLocalNotification,
        updateBadgeCount,
        sendNotification,
        notifyAllSubscribers,
        notifyAdmins,
        notifyUser,
        signUp,
        signIn,
        signOut: handleSignOut,
        updateUser,
        updateOtherUser,
        addUserManually,
        addFriend,
        acceptFriendRequest,
        declineFriendRequest,
        cancelFriendRequest,
        removeFriend,
        subscribe,
        requestAdminRole,
        getAllUsers,
        getFriends,
        getResults,
        fetchResultsBySeason,
        fetchUsersByDivision,
        fetchMoreResults,
        fetchFixturesBySeason,
        searchUsers,
        forceFetchResults,
        updateResults,
        removeResult,
        getFixtures,
        updateFixtures,
        getCups,
        bets,
        getSupportRequests,
        advanceCupBracket,
        getSeasons,
        sendGameInvite,
        acceptGameInvite,
        getNews,
        postNews,
        deleteNews,
        togglePinNews,
        addTokens,
        useTokens,
        adminData,
        updateAdminData,
        addToMoneyHistory,
        isAuthenticated: !!user,
      }}
    >
      {showSeasonOneWelcome && user && (
        <SeasonOneWelcomeModal
          isOpen={showSeasonOneWelcome}
          userName={user.username}
          onAcknowledge={acknowledgeSeasonOneWelcome}
        />
      )}
      {pendingGameInvite && (
        <div
          className="modal-overlay"
          onClick={dismissGameInvite}
          style={{ zIndex: 20000 }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "360px", textAlign: "center" }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>🎯</div>
            <h3 style={{ color: "var(--accent-cyan)", marginBottom: "12px" }}>
              Game Challenge!
            </h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
              <strong>{pendingGameInvite.fromUsername}</strong> has challenged
              you to a <strong>{pendingGameInvite.config?.startScore}</strong>{" "}
              match!
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button className="btn btn-primary" onClick={handleAcceptGameInvite}>
                Accept
              </button>
              <button className="btn btn-secondary" onClick={dismissGameInvite}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
