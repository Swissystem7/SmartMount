/*
 * SmartMount — Autonomous TV Anti-Glare Mount
 * ESP32 + 2x BH1750 ALS sensors + stepper motor
 */

#include <Wire.h>
#include <BH1750.h>
#include <AccelStepper.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <math.h>
#include <stdlib.h>

// ── Config ──────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASS     = "YOUR_PASSWORD";
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 10000;

// >>> BEGIN GENERATED control-params
// Generated from config/control-params.json by scripts/sync-control-params.js — do not edit.
// OLED ~178° viewing angle; VA/LED wash out off-axis so they get a tighter tilt cap.
const float PANEL_LIMITS[] = { 40.0, 30.0, 20.0 };  // OLED, QLED, LED
const int   PANEL_COUNT    = 3;
const float GLARE_THRESHOLD = 3.0f;
const float GAIN_DEG_PER_RATIO = 5.0f;
const float MIN_LUX = 1.0f;
const float DEADBAND_DEG = 1.0f;
const float STEPS_PER_REV = 200.0f;
const float GEAR_RATIO = 5.0f;
const float STEPS_PER_DEGREE = (STEPS_PER_REV * GEAR_RATIO) / 360.0f;
// <<< END GENERATED control-params
enum PanelType { OLED = 0, QLED = 1, LED = 2 };
PanelType currentPanel = LED;

// Stepper: STEP=18, DIR=19
AccelStepper stepper(AccelStepper::DRIVER, 18, 19);

// Sensors: top sensor (facing up/out) + bottom sensor (facing screen)
BH1750 sensorTop(0x23);   // ADDR=GND
BH1750 sensorBot(0x5C);   // ADDR=VCC

WebServer server(80);

// ── State ────────────────────────────────────────────────────────────────
// Implicit machine: autoMode + stepper distance-to-go. No UNHOMED, no
// homing, no stall timeout, no explicit FAULT, no task WDT. setup() claims
// angle 0 via setCurrentPosition(0). Host models: src/lib/fsm.js.
float currentAngle = 0.0;
float targetAngle  = 0.0;
bool  autoMode     = true;
unsigned long lastRead = 0;

// ── Helpers ──────────────────────────────────────────────────────────────
bool isValidPanel(int type) {
  return type >= 0 && type < PANEL_COUNT;
}

float panelLimit() {
  int idx = (int)currentPanel;
  if (!isValidPanel(idx)) idx = LED;
  return PANEL_LIMITS[idx];
}

void syncAngleFromStepper() {
  currentAngle = stepper.currentPosition() / STEPS_PER_DEGREE;
}

void sendJson(int code, const String& body) {
  server.send(code, "application/json", body);
}

void sendOk() {
  sendJson(200, "{\"ok\":true}");
}

void sendError(int code, const char* msg) {
  StaticJsonDocument<128> doc;
  doc["ok"]    = false;
  doc["error"] = msg;
  String out;
  serializeJson(doc, out);
  sendJson(code, out);
}

bool parseFloatArg(const String& s, float& out) {
  if (s.length() == 0) return false;
  const char* start = s.c_str();
  char* end = nullptr;
  out = strtof(start, &end);
  if (end == start || *end != '\0') return false;
  if (isnan(out) || isinf(out)) return false;
  return true;
}

// ── Algorithm ────────────────────────────────────────────────────────────
// Mirrored by src/lib/control.js, which is covered by tests. Keep both in sync.
//
// >>> BEGIN EQUIVALENCE TABLE
// Hand-derived from the constants above (GLARE_THRESHOLD 3.0,
// GAIN_DEG_PER_RATIO 5.0, MIN_LUX 1.0, PANEL_LIMITS 40 / 30 / 20) — not read
// back out of any implementation. Nothing compiles this table; it is the
// written contract between this file and src/lib/control.js.
// test/firmware-mirror.test.js parses the rows out of this file and asserts,
// row by row, that the host law returns exactly these degrees. "hold" means
// calcOptimalAngle() returns currentAngle unchanged — a failed BH1750 read is
// never a reason to slam the panel.
//   lux_top | lux_bot |   OLED |   QLED |    LED
// |     300 |     300 |      0 |      0 |      0 |
// |     100 |     900 |      0 |      0 |      0 |
// |     300 |     100 |      0 |      0 |      0 |
// |     325 |     100 |   1.25 |   1.25 |   1.25 |
// |     350 |     100 |    2.5 |    2.5 |    2.5 |
// |     400 |     100 |      5 |      5 |      5 |
// |     450 |     100 |    7.5 |    7.5 |    7.5 |
// |     600 |     100 |     15 |     15 |     15 |
// |     700 |     100 |     20 |     20 |     20 |
// |     900 |     100 |     30 |     30 |     20 |
// |    1200 |     100 |     40 |     30 |     20 |
// |     500 |       0 |     40 |     30 |     20 |
// |      -1 |     100 |   hold |   hold |   hold |
// |     500 |      -2 |   hold |   hold |   hold |
// |     nan |     100 |   hold |   hold |   hold |
// |     inf |     100 |   hold |   hold |   hold |
// <<< END EQUIVALENCE TABLE
float calcOptimalAngle(float luxTop, float luxBot) {
  // A BH1750 reports a negative value when a read fails. Feeding that through
  // as if it were a lux reading produces a huge glare ratio and slams the panel
  // to its limit, so a failed read must mean "hold position".
  if (isnan(luxTop) || isnan(luxBot) || isinf(luxTop) || isinf(luxBot) ||
      luxTop < 0.0f || luxBot < 0.0f) {
    return currentAngle;
  }

  // If top lux >> bottom → direct sunlight hitting screen → tilt away
  float glareRatio = luxTop / max(luxBot, MIN_LUX);
  float limit      = panelLimit();

  float angle = 0.0;
  if (glareRatio > GLARE_THRESHOLD) {
    // Map glare intensity to tilt (max = panel limit)
    angle = min((glareRatio - GLARE_THRESHOLD) * GAIN_DEG_PER_RATIO, (double)limit);
  }
  return angle;
}

void moveToAngle(float deg) {
  float limit   = panelLimit();
  float clamped = constrain(deg, -limit, limit);
  targetAngle   = clamped;
  // Absolute target from a tracked zero — never relative-move from a
  // currentAngle that was updated before the motor actually arrived.
  long steps = (long)lroundf(clamped * STEPS_PER_DEGREE);
  stepper.moveTo(steps);
}

// ── HTTP API ─────────────────────────────────────────────────────────────
void handleStatus() {
  StaticJsonDocument<256> doc;
  doc["angle"]       = currentAngle;
  doc["target"]      = targetAngle;
  doc["auto"]        = autoMode;
  doc["panel"]       = currentPanel;
  doc["lux_top"]     = sensorTop.readLightLevel();
  doc["lux_bot"]     = sensorBot.readLightLevel();
  String out; serializeJson(doc, out);
  sendJson(200, out);
}

void handleSetAngle() {
  if (!server.hasArg("deg")) {
    sendError(400, "missing deg");
    return;
  }
  float deg;
  if (!parseFloatArg(server.arg("deg"), deg)) {
    sendError(400, "invalid deg");
    return;
  }
  autoMode = false;
  moveToAngle(deg);
  sendOk();
}

void handleSetPanel() {
  if (!server.hasArg("type")) {
    sendError(400, "missing type");
    return;
  }
  int type = server.arg("type").toInt();
  if (!isValidPanel(type)) {
    sendError(400, "invalid panel type");
    return;
  }
  currentPanel = (PanelType)type;
  float limit = panelLimit();
  moveToAngle(constrain(currentAngle, -limit, limit));
  sendOk();
}

void handleSetMode() {
  if (!server.hasArg("auto")) {
    sendError(400, "missing auto");
    return;
  }
  String a = server.arg("auto");
  if (a != "0" && a != "1") {
    sendError(400, "invalid auto");
    return;
  }
  autoMode = (a == "1");
  sendOk();
}

// ── Setup & Loop ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Wire.begin();
  sensorTop.begin();
  sensorBot.begin();

  stepper.setMaxSpeed(500);
  stepper.setAcceleration(200);
  stepper.setCurrentPosition(0);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - wifiStart < WIFI_CONNECT_TIMEOUT_MS) {
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("WiFi timeout — continuing in local auto mode");
  }

  server.on("/status",    HTTP_GET, handleStatus);
  server.on("/set-angle", HTTP_POST, handleSetAngle);
  server.on("/set-panel", HTTP_POST, handleSetPanel);
  server.on("/set-mode",  HTTP_POST, handleSetMode);
  server.begin();
}

void loop() {
  server.handleClient();
  stepper.run();
  syncAngleFromStepper();

  if (autoMode && millis() - lastRead > 2000) {
    lastRead = millis();
    float luxTop = sensorTop.readLightLevel();
    float luxBot = sensorBot.readLightLevel();
    float next   = calcOptimalAngle(luxTop, luxBot);
    if (abs(next - currentAngle) > DEADBAND_DEG) {
      moveToAngle(next);
    } else {
      targetAngle = next;
    }
  }
}
