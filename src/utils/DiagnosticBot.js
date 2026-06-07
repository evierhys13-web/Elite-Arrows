import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { App } from '@capacitor/app';
import { db, doc, deleteDoc, runTransaction } from '../firebase';
import { isLeagueResult } from './leagueResults';

export const DiagnosticBot = {
  async runFullCheck() {
    const results = {
      network: await this.checkNetwork(),
      camera: await this.checkCamera(),
      device: await this.getDeviceInfo(),
      app: await this.getAppInfo(),
    };
    return results;
  },

  async checkNetwork() {
    try {
      const status = await Network.getStatus();
      return {
        connected: status.connected,
        connectionType: status.connectionType,
        action: status.connected ? null : "Please check your internet connection and try again."
      };
    } catch (e) {
      return { connected: true, connectionType: 'unknown', action: null };
    }
  },

  async checkCamera() {
    if (!Capacitor.isNativePlatform()) {
      return { status: 'web', action: "You are on the web version. Camera diagnostics are for mobile app only." };
    }
    try {
      const permission = await Camera.checkPermissions();
      if (permission.camera === 'granted') {
        return { status: 'granted', action: null };
      } else {
        return {
          status: permission.camera,
          action: "Camera access is required for dart detection. Click here to request permission.",
          fix: async () => await Camera.requestPermissions()
        };
      }
    } catch (e) {
      return { status: 'error', action: "Unable to check camera status. Make sure @capacitor/camera is installed." };
    }
  },

  async getDeviceInfo() {
    try {
      const info = await Device.getInfo();
      const battery = await Device.getBatteryInfo();
      return {
        platform: info.platform,
        model: info.model,
        osVersion: info.osVersion,
        batteryLevel: battery.batteryLevel,
        isCharging: battery.isCharging
      };
    } catch (e) {
      return { platform: 'web', model: 'browser' };
    }
  },

  async getAppInfo() {
    try {
      const info = await App.getInfo();
      return {
        name: info.name,
        id: info.id,
        version: info.version,
        build: info.build
      };
    } catch (e) {
      return { name: 'Elite Arrows', version: 'Web' };
    }
  },

  // --- Advanced Admin Fixes ---

  async fixDuplicatedLeagueResults(results) {
    if (!results || results.length === 0) return { fixed: 0, message: "No results to check." };

    const leagueResults = results.filter(r => isLeagueResult(r) && r.status === 'approved');
    const seen = new Map();
    const toDelete = [];

    leagueResults.forEach(r => {
      // Key: player1Id + player2Id + scores + approx date
      // We use a key that identifies "the same match"
      const ids = [r.player1Id, r.player2Id].sort().join('_');
      const scores = [r.score1, r.score2].sort().join(':');
      const key = `${ids}_${scores}_${r.date}`;

      if (seen.has(key)) {
        const original = seen.get(key);
        // Keep the one with the earlier ID or specific flags if necessary
        // Usually, the second one found is the duplicate
        toDelete.push(r.id);
      } else {
        seen.set(key, r);
      }
    });

    let count = 0;
    for (const id of toDelete) {
      try {
        await deleteDoc(doc(db, 'results', String(id)));
        count++;
      } catch (e) {
        console.error(`Failed to delete duplicate result ${id}:`, e);
      }
    }

    return {
      fixed: count,
      message: count > 0 ? `Successfully removed ${count} duplicated league results.` : "No duplicated league results found."
    };
  },

  async fixCupBrackets(cups, results, advanceCupBracket) {
    if (!cups || !results) return { fixed: 0, message: "Missing data to fix brackets." };

    let totalFixed = 0;
    const approvedResults = results.filter(r => r.status === 'approved' && r.cupId);

    for (const result of approvedResults) {
      try {
        // We attempt to re-run the advancement logic for every approved cup result
        // The advanceCupBracket function should be idempotent or handle existing states
        await advanceCupBracket(result);
        totalFixed++;
      } catch (e) {
        console.error(`Failed to advance bracket for result ${result.id}:`, e);
      }
    }

    return {
      fixed: totalFixed,
      message: `Processed advancement for ${totalFixed} cup results. Brackets should now be synchronized.`
    };
  },

  getResponseFor(input, canFix = false) {
    const query = input.toLowerCase();

    if (query.includes('duplicate') || query.includes('double') && query.includes('result')) {
      if (!canFix) return "Duplicate results can be fixed by an admin or subscriber. If you have a subscription, I can run a cleanup for you.";
      return "I can scan for and remove duplicated league results. Should I start the cleanup?";
    }

    if (query.includes('bracket') || query.includes('cup') && (query.includes('fix') || query.includes('issue'))) {
      if (!canFix) return "Bracket issues can be synchronized by an admin or subscriber. If you have a subscription, I can try to fix it for you.";
      return "I can re-sync the cup brackets with approved results to fix any progression issues. Want me to try?";
    }

    if (query.includes('camera') || query.includes('video')) {
      return "I can help with the camera! If you can't see anything, make sure you've granted camera permissions. You can use the 'Run Quick Fix' button to check.";
    }

    if (query.includes('slow') || query.includes('lag')) {
      return "If the app is slow, try closing other background apps. Also, check your battery level; some devices throttle performance when low.";
    }

    if (query.includes('login') || query.includes('account') || query.includes('sign in')) {
      return "For account issues, ensure your email is verified. If you're having trouble logging in, you can try resetting your password from the login screen.";
    }

    if (query.includes('payment') || query.includes('pro') || query.includes('billing')) {
      return "Payment issues are usually handled by Google Play. Make sure your payment method is up to date in the Play Store settings.";
    }

    if (query.includes('dart') || query.includes('detection')) {
      return "For the best dart detection, ensure your board is well-lit and the camera is stable. Avoid having people or objects moving in the background.";
    }

    if (query.includes('help') || query.includes('support') || query.includes('problem')) {
      return "I'm here! I can check your system status or answer questions about darts detection, payments, and account issues. Try asking 'Can you check my camera?'";
    }

    return "I'm here to help! I can check your system status or answer common questions. If you have a specific technical issue, try the 'Run Quick Fix' button.";
  }
};
