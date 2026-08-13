// SmartMount — motion / safety state machine.
//
// firmware/smart_mount.ino has no explicit states. It is a bool (autoMode)
// plus AccelStepper's implicit "distanceToGo != 0", and setup() lies with
// setCurrentPosition(0). This file models that machine *and* a proposed-safe
// one so a reviewer can see the missing transitions, not just hear about them.
//
// Neither machine has been flashed. The firmware model is a host reading of
// the .ino. The safe model is a design — endstops, stall timeout and a
// watchdog do not exist on the board.
(function (root, factory) {
  const control = (typeof module === 'object' && module.exports)
    ? require('./control')
    : root;
  const api = factory(control);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SM_FSM = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (control) {
  const PANEL_NAMES = Object.freeze(['OLED', 'QLED', 'LED']);
  const RETARGET_DEG = 3;
  const DEFAULT_HOME_TIMEOUT_MS = 15000;
  const DEFAULT_STALL_MARGIN = 1.5;

  const FIRMWARE_STATES = Object.freeze(['BOOT', 'RUN']);
  const SAFE_STATES = Object.freeze([
    'BOOT',
    'UNHOMED',
    'HOMING',
    'IDLE_AUTO',
    'IDLE_MANUAL',
    'MOVING',
    'FAULT_SENSOR',
    'FAULT_HOME',
    'FAULT_STALL',
    'FAULT_LIMIT',
    'DEAD',
  ]);

  const EVENTS = Object.freeze([
    'BOOT_DONE',
    'SAMPLE',
    'SET_ANGLE',
    'SET_MODE',
    'SET_PANEL',
    'TICK',
    'ARRIVE',
    'HOME_START',
    'HOME_FOUND',
    'SENSOR_FAIL',
    'SENSOR_OK',
    'STALL',
    'LIMIT',
    'POWER_LOSS',
    'CLEAR',
  ]);

  function panelName(idx) {
    return PANEL_NAMES[idx] || 'LED';
  }

  function clamp(deg, panelIdx) {
    return control.clampToPanel(deg, panelName(panelIdx));
  }

  function law(luxTop, luxBot, panelIdx, held) {
    return control.calcOptimalAngle(luxTop, luxBot, panelName(panelIdx), held);
  }

  function fresh(kind, extra) {
    return Object.assign({
      kind: kind,
      state: 'BOOT',
      autoMode: true,
      panel: 2,
      currentAngle: 0,
      targetAngle: 0,
      believedAngle: 0,
      mechanicalAngle: 0,
      moving: false,
      homed: false,
      hasEndstop: false,
      sensorFail: false,
      wifiUp: true,
      selfLocking: false,
      dropped: false,
      lastIdle: 'IDLE_AUTO',
      reject: null,
      homeElapsedMs: 0,
      moveElapsedMs: 0,
      moveBudgetMs: 0,
      homeTimeoutMs: DEFAULT_HOME_TIMEOUT_MS,
      stallMargin: DEFAULT_STALL_MARGIN,
      reason: 'setup() טרם הסתיים',
    }, extra || {});
  }

  function copy(s) {
    return Object.assign({}, s, { reject: null });
  }

  function go(s, state, reason) {
    s.state = state;
    s.reason = reason;
    return s;
  }

  function startMove(s, deg, reason) {
    const clamped = clamp(deg, s.panel);
    s.targetAngle = clamped;
    s.moving = Math.abs(clamped - s.believedAngle) > control.DEADBAND_DEG;
    s.moveElapsedMs = 0;
    if (reason) s.reason = reason;
    return s;
  }

  // ── firmware-as-written ────────────────────────────────────────────────
  // Matches loop() + handlers. There is no UNHOMED, no FAULT, no stall.
  // Boot always claims angle 0. A failed read holds. Mid-move SAMPLE may
  // retarget from the lagging currentAngle. Power loss is not a software
  // state — the screen falls if the drivetrain is not self-locking.

  function stepFirmware(prev, event) {
    const s = copy(prev);
    s.kind = 'firmware';
    const t = event && event.type;

    if (s.dropped) {
      s.reason = 'החשמל נפל — אין מצב תוכנה אחרי זה';
      return s;
    }

    if (t === 'POWER_LOSS') {
      s.dropped = !s.selfLocking;
      s.moving = false;
      return go(s, s.state === 'BOOT' ? 'BOOT' : 'RUN',
        s.selfLocking ? 'נעילה עצמית מחזיקה את הזווית האחרונה' : 'נפילה פיזית — הקושחה לא מטפלת');
    }

    if (s.state === 'BOOT') {
      if (t === 'BOOT_DONE') {
        s.wifiUp = event.wifiOk !== false;
        s.believedAngle = 0;
        s.currentAngle = 0;
        // The mechanical angle is whatever the arm was. Firmware does not know.
        s.homed = false;
        s.autoMode = true;
        return go(s, 'RUN',
          'setCurrentPosition(0) — מיקום משוער, לא הומינג. ' +
          (s.wifiUp ? 'WiFi עלה' : 'WiFi timeout, אוטו מקומי ממשיך'));
      }
      s.reason = 'עדיין ב-setup()';
      return s;
    }

    if (t === 'SENSOR_FAIL') {
      s.sensorFail = true;
      s.reason = 'קריאה שלילית — מחזיק זווית (calcOptimalAngle מחזיר currentAngle)';
      return s;
    }
    if (t === 'SENSOR_OK') {
      s.sensorFail = false;
      s.reason = 'חיישן חזר — הלולאה תדגום ב-SAMPLE הבא';
      return s;
    }

    if (t === 'SET_ANGLE') {
      s.autoMode = false;
      startMove(s, event.deg, 'set-angle מכבה אוטו ו-moveTo מוחלט (מוצמד לגבול)');
      return s;
    }
    if (t === 'SET_MODE') {
      s.autoMode = Boolean(event.auto);
      s.reason = s.autoMode ? 'set-mode auto=1' : 'set-mode auto=0';
      return s;
    }
    if (t === 'SET_PANEL') {
      // event.type is the discriminator. The firmware query arg is `type=0..2`;
      // the host event carries that as `panel` so the two fields do not collide.
      const panel = Number(event.panel);
      if (!Number.isInteger(panel) || panel < 0 || panel > 2) {
        s.reject = 'invalid panel type';
        s.reason = 'type מחוץ ל-0..2 — 400, בלי שינוי מצב';
        return s;
      }
      s.panel = panel;
      startMove(s, clamp(s.believedAngle, panel), 'החלפת פאנל מצמידה לגבול החדש');
      return s;
    }

    if (t === 'SAMPLE') {
      if (!s.autoMode) {
        s.reason = 'ידני — SAMPLE מחושב אבל לא מזיז';
        return s;
      }
      const luxTop = s.sensorFail ? -1 : event.luxTop;
      const luxBot = s.sensorFail ? -1 : event.luxBot;
      const next = law(luxTop, luxBot, s.panel, s.believedAngle);
      if (s.sensorFail || (event.luxTop < 0 || event.luxBot < 0)) {
        s.reason = 'HOLD — לא מכה למקסימום';
        return s;
      }
      if (control.shouldMove(s.believedAngle, next)) {
        startMove(s, next, 'SAMPLE באמצע מהלך עלול לשנות יעד (currentAngle מפגר)');
      } else {
        s.targetAngle = next;
        s.reason = 'מתחת לדד-בנד — בלי צעד';
      }
      return s;
    }

    if (t === 'ARRIVE') {
      const commanded = s.targetAngle - s.believedAngle;
      s.mechanicalAngle += commanded;
      s.believedAngle = s.targetAngle;
      s.currentAngle = s.targetAngle;
      s.moving = false;
      s.reason = 'המנוע הגיע — אין מצב IDLE נפרד, נשארים ב-RUN';
      return s;
    }

    if (t === 'TICK') {
      if (s.moving) s.moveElapsedMs += Number(event.dtMs) || 0;
      s.currentAngle = s.believedAngle;
      s.reason = 'loop: handleClient + stepper.run — אין WDT ייעודי, אין סטול';
      return s;
    }

    if (t === 'HOME_START' || t === 'HOME_FOUND' || t === 'STALL' || t === 'LIMIT' || t === 'CLEAR') {
      s.reject = 'no-such-state';
      s.reason = 'הקושחה לא מגדירה הומינג / סטול / FAULT / CLEAR';
      return s;
    }

    return s;
  }

  // ── proposed-safe ──────────────────────────────────────────────────────
  // Still unflashed. Refuses to move from an unknown zero, times out homing
  // and motion, latches faults, ignores small mid-move retargets, and treats
  // power loss as DEAD unless a worm/brake is present.

  function stepSafe(prev, event) {
    const s = copy(prev);
    s.kind = 'safe';
    const t = event && event.type;

    if (s.state === 'DEAD' && t !== 'CLEAR') {
      s.reason = 'DEAD — רק CLEAR (ואז UNHOMED) מחזיר';
      return s;
    }

    if (t === 'POWER_LOSS') {
      s.dropped = !s.selfLocking;
      s.moving = false;
      return go(s, 'DEAD',
        s.selfLocking ? 'נעילה עצמית; אחרי חזרת מתח חובה הומינג' : 'נפילה — מצב DEAD');
    }

    if (t === 'SET_PANEL') {
      const panel = Number(event.panel);
      if (!Number.isInteger(panel) || panel < 0 || panel > 2) {
        s.reject = 'invalid panel type';
        s.reason = 'type מחוץ ל-0..2';
        return s;
      }
      s.panel = panel;
      if (s.state === 'MOVING' || s.state === 'IDLE_AUTO' || s.state === 'IDLE_MANUAL') {
        const limited = clamp(s.believedAngle, panel);
        if (limited !== s.believedAngle) startMove(s, limited, 'גבול פאנל חדש');
        if (s.moving && (s.state === 'IDLE_AUTO' || s.state === 'IDLE_MANUAL')) {
          s.lastIdle = s.state;
          return go(s, 'MOVING', 'מצמצמים לגבול החדש');
        }
      }
      s.reason = 'פאנל עודכן';
      return s;
    }

    if (s.state === 'BOOT') {
      if (t === 'BOOT_DONE') {
        s.wifiUp = event.wifiOk !== false;
        s.homed = false;
        s.autoMode = true;
        return go(s, 'UNHOMED',
          'מיקום לא ידוע. אסור moveTo עד הומינג. ' +
          (s.wifiUp ? 'WiFi עלה' : 'WiFi timeout — אוטו מקומי אחרי הומינג'));
      }
      return s;
    }

    if (s.state === 'UNHOMED') {
      if (t === 'HOME_START') {
        if (!s.hasEndstop) {
          return go(s, 'FAULT_HOME', 'אין מפסק קצה בחומרה — אי אפשר לעשות הומינג בתוכנה');
        }
        s.homeElapsedMs = 0;
        return go(s, 'HOMING', 'מחפשים מפסק קצה');
      }
      if (t === 'SET_ANGLE' || t === 'SAMPLE' || t === 'SET_MODE') {
        s.reject = 'unhomed';
        s.reason = 'נדחה — אפס משוער הוא שקר אחרי אתחול';
        return s;
      }
      if (t === 'CLEAR') {
        s.reason = 'עדיין UNHOMED — CLEAR לא ממציא מפסק';
        return s;
      }
      return s;
    }

    if (s.state === 'HOMING') {
      if (t === 'HOME_FOUND') {
        s.believedAngle = 0;
        s.currentAngle = 0;
        s.mechanicalAngle = 0;
        s.homed = true;
        s.moving = false;
        s.autoMode = true;
        s.lastIdle = 'IDLE_AUTO';
        return go(s, 'IDLE_AUTO', 'מפסק קצה — אפס אמיתי');
      }
      if (t === 'TICK') {
        s.homeElapsedMs += Number(event.dtMs) || 0;
        if (s.homeElapsedMs > s.homeTimeoutMs) {
          return go(s, 'FAULT_HOME', 'timeout הומינג — אין מפסק / תקיעה');
        }
        s.reason = 'HOMING… ' + s.homeElapsedMs + ' ms';
        return s;
      }
      if (t === 'LIMIT' || t === 'STALL') {
        return go(s, 'FAULT_HOME', 'גבול או סטול בזמן הומינג');
      }
      if (t === 'SENSOR_FAIL') {
        s.sensorFail = true;
        s.reason = 'חיישן לא נחוץ להומינג — ממשיכים';
        return s;
      }
      return s;
    }

    if (s.state === 'FAULT_HOME' || s.state === 'FAULT_STALL' || s.state === 'FAULT_LIMIT') {
      if (t === 'CLEAR') {
        s.moving = false;
        s.homed = false;
        return go(s, 'UNHOMED', 'אופרטור אישר — חובה הומינג מחדש');
      }
      if (t === 'HOME_START' && s.state === 'FAULT_HOME' && s.hasEndstop) {
        s.homeElapsedMs = 0;
        return go(s, 'HOMING', 'ניסיון הומינג חוזר');
      }
      s.reason = s.state + ' נעול עד CLEAR';
      return s;
    }

    if (s.state === 'FAULT_SENSOR') {
      if (t === 'SENSOR_OK') {
        s.sensorFail = false;
        const back = s.lastIdle || 'IDLE_AUTO';
        s.autoMode = back === 'IDLE_AUTO';
        return go(s, back, 'חיישן חזר');
      }
      if (t === 'SET_ANGLE') {
        s.autoMode = false;
        s.lastIdle = 'IDLE_MANUAL';
        startMove(s, event.deg, 'שחזור ידני תחת כשל חיישן');
        return go(s, 'MOVING', s.reason);
      }
      if (t === 'CLEAR') {
        s.reason = 'CLEAR לא מחליף SENSOR_OK';
        return s;
      }
      s.reason = 'FAULT_SENSOR — מחכים לחיישן או לפקודה ידנית';
      return s;
    }

    if (s.state === 'DEAD') {
      if (t === 'CLEAR') {
        s.dropped = false;
        s.homed = false;
        s.moving = false;
        return go(s, 'UNHOMED', 'מתח חזר — מיקום לא ידוע');
      }
      return s;
    }

    if (t === 'SENSOR_FAIL') {
      s.sensorFail = true;
      if (s.state === 'MOVING') {
        s.reason = 'כשל באמצע מהלך — מסיימים את היעד הנוכחי, לא מחשבים יחס';
        return s;
      }
      s.lastIdle = s.state;
      return go(s, 'FAULT_SENSOR', 'HOLD + FAULT מפורש (לא רק return currentAngle)');
    }
    if (t === 'SENSOR_OK') {
      s.sensorFail = false;
      s.reason = 'חיישן תקין';
      return s;
    }

    if (t === 'LIMIT') {
      s.moving = false;
      return go(s, 'FAULT_LIMIT', 'מפסק גבול מכני — עוצרים');
    }
    if (t === 'STALL') {
      s.moving = false;
      return go(s, 'FAULT_STALL', 'אין התקדמות בזמן התקציב');
    }

    if (s.state === 'IDLE_AUTO' || s.state === 'IDLE_MANUAL') {
      if (t === 'SET_ANGLE') {
        s.autoMode = false;
        s.lastIdle = 'IDLE_MANUAL';
        startMove(s, event.deg, 'פקודה ידנית');
        return go(s, s.moving ? 'MOVING' : 'IDLE_MANUAL', s.reason);
      }
      if (t === 'SET_MODE') {
        s.autoMode = Boolean(event.auto);
        const next = s.autoMode ? 'IDLE_AUTO' : 'IDLE_MANUAL';
        s.lastIdle = next;
        return go(s, next, 'החלפת מצב');
      }
      if (t === 'SAMPLE' && s.state === 'IDLE_AUTO') {
        if (s.sensorFail) {
          return go(s, 'FAULT_SENSOR', 'SAMPLE עם חיישן מת');
        }
        const next = law(event.luxTop, event.luxBot, s.panel, s.believedAngle);
        if (event.luxTop < 0 || event.luxBot < 0) {
          s.sensorFail = true;
          return go(s, 'FAULT_SENSOR', 'קריאה שלילית');
        }
        if (control.shouldMove(s.believedAngle, next)) {
          s.lastIdle = 'IDLE_AUTO';
          startMove(s, next, 'יעד חדש מהחוק');
          return go(s, 'MOVING', s.reason);
        }
        s.targetAngle = next;
        s.reason = 'שקט — דד-בנד';
        return s;
      }
      if (t === 'HOME_START') {
        s.reject = 'already-homed';
        s.reason = 'כבר ב-idle אחרי הומינג';
        return s;
      }
      return s;
    }

    if (s.state === 'MOVING') {
      if (t === 'ARRIVE') {
        s.believedAngle = s.targetAngle;
        s.currentAngle = s.targetAngle;
        s.mechanicalAngle = s.targetAngle;
        s.moving = false;
        const back = s.lastIdle || (s.autoMode ? 'IDLE_AUTO' : 'IDLE_MANUAL');
        return go(s, back, 'הגיע ליעד');
      }
      if (t === 'SET_ANGLE') {
        s.autoMode = false;
        s.lastIdle = 'IDLE_MANUAL';
        startMove(s, event.deg, 'יעד חדש באמצע מהלך (מפורש)');
        return s;
      }
      if (t === 'SAMPLE' && s.autoMode && !s.sensorFail) {
        const next = law(event.luxTop, event.luxBot, s.panel, s.believedAngle);
        if (Math.abs(next - s.targetAngle) > RETARGET_DEG) {
          startMove(s, next, 'ריטרגט רק מעל ' + RETARGET_DEG + '° (לא כל דגימה)');
        } else {
          s.reason = 'SAMPLE באמצע מהלך — מתעלמים (Δ יעד קטן)';
        }
        return s;
      }
      if (t === 'TICK') {
        s.moveElapsedMs += Number(event.dtMs) || 0;
        if (s.moveBudgetMs > 0 && s.moveElapsedMs > s.moveBudgetMs * s.stallMargin) {
          s.moving = false;
          return go(s, 'FAULT_STALL',
            'חריגת תקציב תנועה (' + s.moveElapsedMs + ' ms > ' +
            Math.round(s.moveBudgetMs * s.stallMargin) + ' ms)');
        }
        s.reason = 'בתנועה… ' + s.moveElapsedMs + ' ms';
        return s;
      }
      if (t === 'SET_MODE') {
        s.autoMode = Boolean(event.auto);
        s.lastIdle = s.autoMode ? 'IDLE_AUTO' : 'IDLE_MANUAL';
        s.reason = 'מצב אחרי ההגעה ישתנה ל-' + s.lastIdle;
        return s;
      }
      return s;
    }

    return s;
  }

  function step(snapshot, event) {
    if (!event || !event.type) throw new Error('event.type required');
    if (EVENTS.indexOf(event.type) < 0) throw new Error('unknown event: ' + event.type);
    if (snapshot.kind === 'safe') return stepSafe(snapshot, event);
    return stepFirmware(snapshot, event);
  }

  function applyAll(snapshot, events) {
    return events.reduce(function (s, e) { return step(s, e); }, snapshot);
  }

  function firmwareBoot(wifiOk) {
    return step(fresh('firmware'), { type: 'BOOT_DONE', wifiOk: wifiOk !== false });
  }

  function safeBoot(wifiOk, hasEndstop) {
    const s = fresh('safe', { hasEndstop: Boolean(hasEndstop) });
    return step(s, { type: 'BOOT_DONE', wifiOk: wifiOk !== false });
  }

  return {
    FIRMWARE_STATES,
    SAFE_STATES,
    EVENTS,
    PANEL_NAMES,
    RETARGET_DEG,
    DEFAULT_HOME_TIMEOUT_MS,
    fresh,
    step,
    applyAll,
    firmwareBoot,
    safeBoot,
  };
});
