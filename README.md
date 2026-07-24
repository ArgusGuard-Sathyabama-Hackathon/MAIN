<img width="500" height="500" alt="ARGUS GUARD" src="https://github.com/user-attachments/assets/7eceafe9-8a71-4b90-a9d0-6b04f9a52900" />


# ARGUS GUARD

### Safety in Seconds

## Team Details

**Team Name:** ARGUS GUARD

**Domain:** Artificial Intelligence (AI), Internet of Things (IoT), Emergency Response Systems

### Team Members
- Monish K S
- Kesavasai R R
- Revant D
- Adwaith D N
- Goutham S
- Kishore S

---

# Problem Statement

India faces a critical emergency response challenge where thousands of accident victims fail to receive timely care during the Golden Hour. Despite advances in healthcare, delayed emergency detection and inefficient dispatch systems continue to cost lives.

According to national accident statistics, India accounts for approximately 11% of global road fatalities, with over 4.6 lakh accidents reported annually. Most emergency response systems rely on manual reporting and static dispatch mechanisms, resulting in delayed intervention when every minute matters.

The two primary bottlenecks are:

- Delayed emergency detection due to dependence on bystanders.
- Inefficient routing of emergency services through traffic congestion, roadblocks, and damaged infrastructure.

These delays significantly reduce the chances of survival and effective treatment.
Every year India loses **1.68 lakh lives** in road and industrial accidents — the majority preventable, not because medicine failed, but because **help arrived too late**.

| Stat | Reality |
|:---|:---|
| India's share of global road deaths | **~11%** |
| Accidents in India (2022) | **4.6 lakh** |
| Victims receiving care within the Golden Hour | **< 20%** |
| Average ambulance response time (national) | **25–30 minutes** |
| Delhi metro response time (2024) | **17+ minutes (and worsening)** |
| Supreme Court ruling (Jan 2025) | **Golden Hour care is a Fundamental Right under Article 21** |

**The law says every person has a right to emergency care within the Golden Hour. The system is physically incapable of delivering it.**

The two bottlenecks are simple but catastrophic:
1. **Detection Delay (5–15 min):** We rely on bystanders to notice and call for help. Victims bleed out while people panic.
2. **Routing Delay (10–20 min):** Ambulances are dispatched to the closest unit by straight-line distance — getting trapped in protests, strikes, damaged roads, and traffic gridlock.

---

# Solution

ARGUS GUARD is an AI-powered emergency response ecosystem designed to automate the complete rescue workflow from incident detection to emergency response coordination.

The platform combines:

- Smart wearable safety hardware
- AI-driven emergency dispatch intelligence
- Dynamic route optimization
- Real-time emergency monitoring
- Intelligent evacuation guidance

ARGUS GUARD reduces response delays by automatically detecting emergencies, analyzing incident conditions, dispatching appropriate response units, and guiding both rescuers and affected individuals through optimized routes.

---

# Features

## Operation Vanguard — Smart Helmet

- Automatic fall detection using motion sensing
- Toxic gas and smoke detection
- High-temperature hazard detection
- Instant emergency alert generation
- LED matrix visual warning system
- Worker safety monitoring

## Operation Overwatch — AI Dispatch Engine

- AI-powered emergency analysis
- Natural language intelligence processing
- Multi-agency response coordination
- Dynamic route optimization
- Roadblock and obstacle avoidance
- Real-time tactical command dashboard
- Live dispatch visualization
- AI reasoning terminal

## Operation Pathfinder — Evacuation Routing

- Interactive facility floor mapping
- Hazard-zone identification
- Dynamic evacuation route generation
- Safe path visualization
- Real-time worker guidance

---

# Complete Tech Stack

## Hardware

- Arduino UNO R4 WiFi
- MPU6050 Accelerometer & Gyroscope
- MQ-2 Gas Sensor
- DHT11 Temperature Sensor
- LED Matrix Display
- Portable Power Bank

## Software

- HTML
- CSS
- JavaScript
- WebSocket Communication

## AI Systems

- Claude Haiku 4.5 (OpenRouter)
## SYSTEM ARCHITECTURE
<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/538e48b0-2db7-411c-89cf-c40b6152da7e" />

# Detailed Workflow

## Scenario 1: Worker Accident

```text
Worker Fall Detected
          ↓
Impact Threshold Crossed
          ↓
Emergency Alert Triggered
          ↓
Alert Sent To Backend
          ↓
AI Incident Analysis
          ↓
Nearest Emergency Units Selected
          ↓
Optimal Route Generated
          ↓
Live Dispatch Initiated
```

## Scenario 2: Industrial Hazard

```text
Gas Leak / Fire / Heat Hazard
              ↓
Sensor Threshold Exceeded
              ↓
Hazard Alert Generated
              ↓
AI Risk Assessment
              ↓
Affected Area Identified
              ↓
Emergency Units Dispatched
              ↓
Evacuation Route Generated
              ↓
Workers Guided To Safety
```

---
---

# Hardware Components

| Component | Purpose |
|------------|------------|
| Arduino UNO R4 WiFi | Main controller and connectivity |
| MPU6050 | Fall and impact detection |
| MQ-2 Sensor | Gas and smoke detection |
| DHT11 | Temperature monitoring |
| LED Matrix | Local visual warnings |
| Power Bank | Portable power source |

---

# Hardware Workflow

```text
Fall / Impact Event
          ↓
MPU6050 Detection
          ↓
Emergency Alert
          ↓
Backend Processing
          ↓
AI Dispatch Decision
          ↓
Response Unit Deployment

Gas / Heat Hazard
          ↓
Sensor Detection
          ↓
Risk Analysis
          ↓
Evacuation Routing
          ↓
Worker Guidance
```

### Circuit / Wiring Diagram

<img width="1280" height="698" alt="image" src="https://github.com/user-attachments/assets/4fb6ce3d-6fa5-40f2-a99a-8613e1c76c43" />

# Testing & Performance

## Tested Functions

- Fall detection workflow
- Gas leak detection
- Temperature hazard detection
- AI incident parsing
- Route optimization engine
- Emergency dispatch simulation
- Dashboard visualization
- Evacuation routing logic

## Performance Results

| Phase | Traditional EMS | ARGUS GUARD |
|---------|---------|---------|
| Detection & Alert | 5–15 min | < 2 sec |
| Transit & Routing | 15–25 min | 8–12 min |
| Total Response Time | 25–40 min | 8–14 min |

**Estimated overall response-time reduction: ~60%**

---

# Challenges Faced

- Designing reliable incident detection thresholds
- Integrating hardware and AI systems
- Building dynamic route optimization logic
- Processing unstructured emergency intelligence
- Real-time visualization of emergency operations
- Ensuring resilience during connectivity failures

---

# Future Scope

- Integration with public emergency services
- AI-assisted medical triage
- Smart city emergency response integration
- Advanced predictive hazard detection
- Real-time GPS-enabled responder tracking
- Large-scale industrial deployment
- Multi-site emergency coordination

---

# Demo Screenshots 

## Prototype

<img width="591" height="1280" alt="image" src="https://github.com/user-attachments/assets/ffabeb42-52eb-4988-8616-9a9843e49a4d" />


## Overwatch Dashboard

<img width="2000" height="1545" alt="SS FINAL" src="https://github.com/user-attachments/assets/73cde45f-5be9-4db1-8935-810fa2f53dc3" />

## Operation PathFinder

<img width="2000" height="1545" alt="FIRE FIRE jpg" src="https://github.com/user-attachments/assets/f363ee1c-de4e-43d4-b763-514012cd6f4e" />


---
