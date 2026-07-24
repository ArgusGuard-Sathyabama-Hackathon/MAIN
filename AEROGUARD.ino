#include <WiFiS3.h>
#include <Wire.h>
#include "Arduino_LED_Matrix.h"
#include "Adafruit_MQTT.h"
#include "Adafruit_MQTT_Client.h"

// ==========================================
// 1. YOUR CREDENTIALS
// ==========================================
#define WIFI_SSID       "SIST-Hackathon-2026"
#define WIFI_PASS       "sbu123!@#"

#define AIO_SERVER      "io.adafruit.com"
#define AIO_SERVERPORT  1883
#define AIO_USERNAME    "Spidey_008"
#define AIO_KEY         "aio_jyEG60njrrnwLlGxxrIkPtGtNk7F"

// ==========================================
// 2. HARDWARE PINS & THRESHOLDS
// ==========================================
const int MQ2_PIN = A0;       
const int BUZZER_PIN = 5;     
const int GAS_DANGER = 400;   
const int FALL_DANGER = 35;   // INCREASED: Now requires a massive 3.5G impact spike

// ==========================================
// 3. OBJECT SETUP
// ==========================================
ArduinoLEDMatrix matrix;
WiFiClient client;
Adafruit_MQTT_Client mqtt(&client, AIO_SERVER, AIO_SERVERPORT, AIO_USERNAME, AIO_KEY);

Adafruit_MQTT_Publish gasFeed = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/gas-level");
Adafruit_MQTT_Publish statusFeed = Adafruit_MQTT_Publish(&mqtt, AIO_USERNAME "/feeds/worker-status");

const uint32_t icon_safe[] = { 0x3184a444, 0x42081100, 0x0 };
const uint32_t icon_danger[] = { 0x80440a21, 0x1121110a, 0x40480400 };

unsigned long lastCloudUpdate = 0;
const int CLOUD_DELAY = 5000; 

void setup() {
  Serial.begin(115200);
  matrix.begin();
  
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); 

  // --- RAW MPU6050 SETUP ---
  Serial.println("Waking up MPU6050 manually...");
  Wire.begin();
  
  // 1. Wake up the sensor
  Wire.beginTransmission(0x68);
  Wire.write(0x6B); // Power management register
  Wire.write(0);    // Write 0 to wake it up
  Wire.endTransmission(true);

  // 2. Configure sensor for +/- 8g range (Hard impact detection)
  Wire.beginTransmission(0x68);
  Wire.write(0x1C); // Accelerometer Configuration Register
  Wire.write(0x10); // Set to +/- 8g (0x10 in Hex)
  Wire.endTransmission(true);
  
  Serial.println("MPU6050 Awake and configured for Heavy Impacts!");

  // Connect to Wi-Fi
  Serial.print("Connecting to Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected!");
}

void loop() {
  connectToCloud();

  // 1. Read Gas Sensor
  int32_t currentGasLevel = analogRead(MQ2_PIN);

  // 2. Read MPU6050 Manually
  Wire.beginTransmission(0x68);
  Wire.write(0x3B); // Start at accelerometer data register
  Wire.endTransmission(false);
  Wire.requestFrom(0x68, 6, true); // Request 6 bytes (X, Y, Z)

  int16_t AcX = Wire.read() << 8 | Wire.read();
  int16_t AcY = Wire.read() << 8 | Wire.read();
  int16_t AcZ = Wire.read() << 8 | Wire.read();

  // Convert raw data to standard m/s^2 
  // UPDATED: Divided by 4096.0 because we changed the sensor scale to +/- 8g
  float ax = (AcX / 4096.0) * 9.81;
  float ay = (AcY / 4096.0) * 9.81;
  float az = (AcZ / 4096.0) * 9.81;

  float totalAccel = sqrt(pow(ax, 2) + pow(ay, 2) + pow(az, 2));

  // 3. Evaluate Danger
  bool isGasLeak = (currentGasLevel > GAS_DANGER);
  bool isFallDetected = (totalAccel > FALL_DANGER);

  if (isGasLeak || isFallDetected) {
    digitalWrite(BUZZER_PIN, HIGH);       
    matrix.loadFrame(icon_danger);        
    
    Serial.println("!!! EMERGENCY DETECTED !!!");
    
    gasFeed.publish(currentGasLevel);
    if (isGasLeak) statusFeed.publish("GAS_LEAK");
    if (isFallDetected) statusFeed.publish("MAN_DOWN");
    
    delay(2000); 
  } 
  else {
    digitalWrite(BUZZER_PIN, LOW);        
    matrix.loadFrame(icon_safe);          
    
    if (millis() - lastCloudUpdate > CLOUD_DELAY) {
      Serial.print("Status: SAFE | Gas: ");
      Serial.print(currentGasLevel);
      Serial.print(" | Accel (Impact): ");
      Serial.println(totalAccel);
      
      gasFeed.publish(currentGasLevel);
      statusFeed.publish("SAFE");
      lastCloudUpdate = millis();
    }
  }
}

void connectToCloud() {
  if (mqtt.connected()) return;
  
  Serial.print("Connecting to Adafruit IO... ");
  int8_t ret;
  while ((ret = mqtt.connect()) != 0) {
       Serial.println(mqtt.connectErrorString(ret));
       Serial.println("Retrying connection in 5 seconds...");
       mqtt.disconnect();
       delay(5000);
  }
  Serial.println("Connected!");
}
