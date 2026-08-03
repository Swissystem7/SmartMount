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

// ── Config ──────────────────────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASS     = "YOUR_PASSWORD";

// Panel type limits (viewing angle in degrees from center)
const float PANEL_LIMITS[] = { 20.0, 40.0, 30.0 };  // OLED, QLED, LED
enum PanelType { OLED = 0, QLED = 1, LED = 2 };
PanelType currentPanel = LED;

// Stepper: STEP=18, DIR=19, 200 steps/rev, 1:5 gear ratio
AccelStepper stepper(AccelStepper::DRIVER, 18, 19);
const float STEPS_PER_DEGREE = (200.0 * 5.0) / 360.0;  // 2.78 steps/°

// Sensors: top sensor (facing up/out) + bottom sensor (facing screen)
BH1750 sensorTop(0x23);   // ADDR=GND
BH1750 sensorBot(0x5C);   // ADDR=VCC

WebServer server(80);

// ── State ────────────────────────────────────────────────────────────────
float currentAngle = 0.0;
float targetAngle  = 0.0;
bool  autoMode     = true;
unsigned long lastRead = 0;

// ── Algorithm ────────────────────────────────────────────────────────────
// Mirrored by src/lib/control.js, which is covered by tests. Keep both in sync.
float calcOptimalAngle(float luxTop, float luxBot) {
  // A BH1750 reports a negative value when a read fails. Feeding that through
  // as if it were a lux reading produces a huge glare ratio and slams the panel
  // to its limit, so a failed read must mean "hold position".
  if (isnan(luxTop) || isnan(luxBot) || luxTop < 0.0f || luxBot < 0.0f) {
    return currentAngle;
  }

  // If top lux >> bottom → direct sunlight hitting screen → tilt away
  float glareRatio = luxTop / max(luxBot, 1.0f);
  float panelLimit = PANEL_LIMITS[currentPanel];

  float angle = 0.0;
  if (glareRatio > 3.0) {
    // Map glare intensity to tilt (max = panel limit)
    angle = min((glareRatio - 3.0) * 5.0, (double)panelLimit);
  }
  return angle;
}

void moveToAngle(float deg) {
  float clamped = constrain(deg, -PANEL_LIMITS[currentPanel], PANEL_LIMITS[currentPanel]);
  long steps = (long)((clamped - currentAngle) * STEPS_PER_DEGREE);
  stepper.move(steps);
  currentAngle = clamped;
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
  server.send(200, "application/json", out);
}

void handleSetAngle() {
  if (server.hasArg("deg")) {
    autoMode    = false;
    targetAngle = server.arg("deg").toFloat();
    moveToAngle(targetAngle);
  }
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleSetPanel() {
  if (server.hasArg("type")) {
    currentPanel = (PanelType)server.arg("type").toInt();
    moveToAngle(constrain(currentAngle, -PANEL_LIMITS[currentPanel], PANEL_LIMITS[currentPanel]));
  }
  server.send(200, "application/json", "{\"ok\":true}");
}

void handleSetMode() {
  autoMode = server.arg("auto") == "1";
  server.send(200, "application/json", "{\"ok\":true}");
}

// ── Setup & Loop ─────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Wire.begin();
  sensorTop.begin();
  sensorBot.begin();

  stepper.setMaxSpeed(500);
  stepper.setAcceleration(200);

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("IP: " + WiFi.localIP().toString());

  server.on("/status",    HTTP_GET, handleStatus);
  server.on("/set-angle", HTTP_POST, handleSetAngle);
  server.on("/set-panel", HTTP_POST, handleSetPanel);
  server.on("/set-mode",  HTTP_POST, handleSetMode);
  server.begin();
}

void loop() {
  server.handleClient();
  stepper.run();

  if (autoMode && millis() - lastRead > 2000) {
    lastRead = millis();
    float luxTop = sensorTop.readLightLevel();
    float luxBot = sensorBot.readLightLevel();
    targetAngle  = calcOptimalAngle(luxTop, luxBot);
    if (abs(targetAngle - currentAngle) > 1.0) {
      moveToAngle(targetAngle);
    }
  }
}
