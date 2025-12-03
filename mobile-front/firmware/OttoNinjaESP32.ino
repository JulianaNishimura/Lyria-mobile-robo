#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <SPI.h>
#include <Wire.h>

// ---------- Control State (Replaces RemoteXY) ----------
struct ControlState {
  int8_t x = 0;       // -100 to 100
  int8_t y = 0;       // -100 to 100
  // Arms removed
  // Mode is handled by global ModeCounter
};

ControlState controls;

// Web Server
WebServer server(80);

// ---------- Configurações de calibração ----------
int LFFWRS= 20;
int RFFWRS= 15;
int LFBWRS= 20;
int RFBWRS= 15;
int LA0= 60;
int RA0= 135;
int LATL= 100;
int RATL= 175;
int LATR= 5;
int RATR= 80;
// Arms calibration removed

// Pins
const uint8_t ServoLeftFootPin   = 14;
const uint8_t ServoLeftLegPin    = 12;
const uint8_t ServoRightFootPin  = 13;
const uint8_t ServoRightLegPin   = 27;
// Arm Pins Removed
// const uint8_t ServoLeftArmPin    = 16;
// const uint8_t ServoRightArmPin   = 3;
const uint8_t ServoHeadPin       = 1;

// Servos
Servo myservoLeftFoot, myservoLeftLeg, myservoRightFoot, myservoRightLeg;
// Arm Servos Removed
Servo myservoHead;

// Arrays para organização
Servo* servos[5]; // Reduced to 5 (4 Legs + 1 Head)
uint8_t servoPins[5];

// Estado / smoothing
int currentPos[5];
int targetPos[5];
// índice mapping: 0 LF,1 LL,2 RF,3 RL, 4 H (Arms Removed)
enum {IDX_LF=0, IDX_LL, IDX_RF, IDX_RL, IDX_H};

// tempo e estado para caminhada
unsigned long phaseStart = 0;
unsigned long lastSerial = 0;
int ModeCounter = 0; // 0 = walk, 1 = roll
const unsigned long SERIAL_PRINT_INTERVAL = 200; // ms

// smoothing params
const int MAX_STEP_PER_CYCLE = 6; // quanto o servo pode mudar por ciclo
const unsigned long SMOOTH_INTERVAL = 20; // ms entre updates de smoothing

unsigned long lastSmooth = 0;

void attachAll() {
  myservoLeftFoot.attach(ServoLeftFootPin, 544, 2400);
  myservoRightFoot.attach(ServoRightFootPin, 544, 2400);
  myservoLeftLeg.attach(ServoLeftLegPin, 544, 2400);
  myservoRightLeg.attach(ServoRightLegPin, 544, 2400);
  // Arms Attach Removed
  myservoHead.attach(ServoHeadPin, 544, 2400);

  servos[IDX_LF] = &myservoLeftFoot;
  servos[IDX_LL] = &myservoLeftLeg;
  servos[IDX_RF] = &myservoRightFoot;
  servos[IDX_RL] = &myservoRightLeg;
  servos[IDX_H]  = &myservoHead;
}

void writeImmediateAllTargets() {
  for (int i=0;i<5;i++) {
    if (servos[i]) servos[i]->write(targetPos[i]);
    currentPos[i]=targetPos[i];
  }
}

// ---------------- HTTP Handlers ----------------

void handleRoot() {
  server.send(200, "text/plain", "OTTO NINJA ONLINE");
}

// ex: /cmd?x=0&y=0
void handleCmd() {
  if (server.hasArg("x")) {
    int val = server.arg("x").toInt();
    if (val < -100) val = -100;
    if (val > 100) val = 100;
    controls.x = (int8_t)val;
  }
  if (server.hasArg("y")) {
    int val = server.arg("y").toInt();
    if (val < -100) val = -100;
    if (val > 100) val = 100;
    controls.y = (int8_t)val;
  }
  server.send(200, "text/plain", "OK");
}

// ex: /setMode?mode=1 (1=Roll, 0=Walk)
void handleSetMode() {
  if (server.hasArg("mode")) {
    int m = server.arg("mode").toInt();
    if (m == 1) {
      // Switch to ROLL
      ModeCounter = 1;
      // Arms logic removed
    } else {
      // Switch to WALK
      ModeCounter = 0;
      targetPos[IDX_LL] = LA0;
      targetPos[IDX_RL] = RA0;
      // Arms logic removed
    }
  }
  server.send(200, "text/plain", "OK");
}

// /action Removed as it was for arms

void setup() {
  Serial.begin(115200);

  attachAll();

  // Initial poses
  targetPos[IDX_H]  = 90;
  // Arms Removed
  targetPos[IDX_LF] = 90;
  targetPos[IDX_RF] = 90;
  targetPos[IDX_LL] = LA0;
  targetPos[IDX_RL] = RA0;

  for (int i=0;i<5;i++) currentPos[i]=targetPos[i];
  writeImmediateAllTargets();

  // Setup WiFi AP
  WiFi.softAP("OTTO_API", "12345678");
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);

  // Setup Server
  server.on("/", handleRoot);
  server.on("/cmd", handleCmd);
  server.on("/setMode", handleSetMode);
  // server.on("/action", handleAction); // Removed
  server.begin();

  phaseStart = millis();
  lastSmooth = millis();
  lastSerial = millis();
}

/////////////////////
// Helpers
/////////////////////

void smoothStep() {
  unsigned long now = millis();
  if (now - lastSmooth < SMOOTH_INTERVAL) return;
  lastSmooth = now;

  for (int i=0;i<5;i++) {
    int cur = currentPos[i];
    int tgt = targetPos[i];
    if (cur == tgt) continue;
    int diff = tgt - cur;
    int step = diff;
    if (abs(step) > MAX_STEP_PER_CYCLE) {
      step = (step > 0) ? MAX_STEP_PER_CYCLE : -MAX_STEP_PER_CYCLE;
    }
    cur += step;
    currentPos[i] = cur;
    servos[i]->write(cur);
  }
}

inline int map_constrain(int x,int inMin,int inMax,int outMin,int outMax){
  long v = (long)(x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
  if (outMin < outMax) {
    if (v < outMin) v = outMin;
    if (v > outMax) v = outMax;
  } else {
    if (v < outMax) v = outMax;
    if (v > outMin) v = outMin;
  }
  return (int)v;
}

/////////////////////////
// Physics Logic
/////////////////////////

void handleMode0_walk() {
  // Logic uses controls.x/y instead of RemoteXY
  if ((controls.x >= -10) && (controls.x <= 10) && (controls.y >= -10) && (controls.y <= 10)) {
    targetPos[IDX_LF] = 90;
    targetPos[IDX_RF] = 90;
    targetPos[IDX_LL] = LA0;
    targetPos[IDX_RL] = RA0;
    return;
  }

  bool forward = controls.y > 0;
  int lt = map_constrain(controls.x, 100, -100, 200, 700);
  int rt = map_constrain(controls.x, 100, -100, 700, 200);

  unsigned long Interval1 = 250;
  unsigned long Interval2 = 250 + rt;
  unsigned long Interval3 = 250 + rt + 250;
  unsigned long Interval4 = 250 + rt + 250 + lt;
  unsigned long Interval5 = 250 + rt + 250 + lt + 50;
  unsigned long cycleLen = Interval5;

  unsigned long now = millis();
  if (now - phaseStart > cycleLen) phaseStart = now;
  unsigned long t = now - phaseStart;

  if (t <= Interval1) {
    targetPos[IDX_LL] = LATR;
    targetPos[IDX_RL] = RATR;
  } else if (t <= Interval2) {
    if (forward) {
      targetPos[IDX_RF] = 90 - RFFWRS;
    } else {
      targetPos[IDX_RF] = 90 + RFBWRS;
    }
  } else if (t <= Interval3) {
    targetPos[IDX_RF] = 90;
    targetPos[IDX_LL] = LATL;
    targetPos[IDX_RL] = RATL;
  } else if (t <= Interval4) {
    if (forward) {
      targetPos[IDX_LF] = 90 + LFFWRS;
    } else {
      targetPos[IDX_LF] = 90 - LFBWRS;
    }
  } else {
    targetPos[IDX_LF] = 90;
  }
}

void handleMode1_roll() {
  if ((controls.x >= -10) && (controls.x <= 10) && (controls.y >= -10) && (controls.y <= 10)) {
    targetPos[IDX_LF] = 90;
    targetPos[IDX_RF] = 90;
    return;
  }
  int LWS = map_constrain(controls.y, 100, -100, 135, 45);
  int RWS = map_constrain(controls.y, 100, -100, 45, 135);
  int LWD = map_constrain(controls.x, 100, -100, 45, 0);
  int RWD = map_constrain(controls.x, 100, -100, 0, -45);
  targetPos[IDX_LF] = LWS + LWD;
  targetPos[IDX_RF] = RWS + RWD;
}

void loop() {
  server.handleClient();

  // No arm updates needed

  if (ModeCounter == 0) {
    handleMode0_walk();
  } else {
    handleMode1_roll();
  }

  smoothStep();
}
