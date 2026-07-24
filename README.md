<img width="500" height="500" alt="ARGUS GUARD" src="https://github.com/user-attachments/assets/7eceafe9-8a71-4b90-a9d0-6b04f9a52900" />

## Team Members
Monish K S
Kesavasai R R
Revant D
Adwaith D N
Goutham S
Kishore S

## The Problem — India's Emergency Response Crisis

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

## Our Solution — Argus Guard

> *"On March 16, 2024, a boiler explosion at a Rewari factory severely burned 40+ workers. The blast wasn't the only tragedy. Panic meant it took minutes for anyone to call 108. When ambulances were dispatched, they hit gridlock on the industrial corridor. Help took 45 minutes.*
>
> *In January 2025, the Supreme Court called this a constitutional failure. Argus Guard is the technical answer."*

**Argus Guard** is a Palantir-inspired autonomous AI rescue platform. It does not just alert people to emergencies — it **automates the entire emergency response chain** from the moment of incident to the moment help arrives.

---

## The System — Three Operations, One Agent

### ⚡ Operation Vanguard — Smart Helmet (Hardware Node) (In Progress)
A worker-worn safety device (Arduino UNO R4 WiFi + MPU6050 + MQ-2 + DHT11) that autonomously detects crises and triggers the dispatch pipeline.

- **Fall Detection:** If G-force exceeds threshold → instantly fires an alert.
- **Gas Detection:** If toxic gas PPM spikes → fires hazard alert.
- **Heat Detection:** If ambient temperature exceeds danger level → fires thermal alert.
- The onboard **LED Matrix flashes a warning symbol** to nearby workers.

### 🗺️ Operation Overwatch — AI Dispatch Engine *(Dashboard Built)*

<img width="2000" height="1545" alt="SS FINAL" src="https://github.com/user-attachments/assets/73cde45f-5be9-4db1-8935-810fa2f53dc3" />

The core intelligence layer. A Palantir-style tactical command center that receives the crisis signal and orchestrates the rescue response.

- Ingests **unstructured natural language intel** (e.g., "Protest blocking Junction 2. Bad roads on J1").
- Accepts a **crisis trigger** (e.g., "Fire and armed intrusion in Sector 4").
- The AI agent parses both, identifies required response units (Police, Fire, Trauma), eliminates blocked routes from the routing graph, and dispatches the right vehicles along the optimal path.
- **Glowing animated route vectors** show the live dispatch on the tactical map.
- An **AI Reasoning Terminal** types out the agent's decision logic in real-time.

### 🧭 Operation Pathfinder — Evacuation Routing *(In Progress)*
Interactive factory floorplan with distributed virtual sensors. When a hazard is triggered on the map, the AI calculates and draws the optimal evacuation path for workers — routing them around the spreading danger zone in real time.

---

## The Numbers — What Argus Guard Actually Changes

| Phase | Traditional EMS | Argus Guard | Time Saved | Reduction |
|:---|:---|:---|:---:|:---:|
| **Detection & Alert** | 5 – 15 mins | **< 2 seconds** | ~10 mins | **99%** |
| **Transit & Routing** | 15 – 25 mins | **8 – 12 mins** | ~7–13 mins | **40–50%** |
| **Total Lifecycle** | **25 – 40 mins** | **8 – 14 mins** | **~17–26 mins** | **~60%** |

> Getting patients to definitive care 17–26 minutes faster is not an improvement — it is the difference between life and death.

---

## How It Works — Technical Stack

```
[SMART HELMET]  →  [OVERWATCH BACKEND]  →  [NEXUS DASHBOARD]
  Arduino R4           Python FastAPI           HTML/CSS/JS
  MPU6050              WebSocket Server         Leaflet.js Map
  MQ-2 Gas             AI Logic Parser          AI Terminal UI
  DHT11 Temp           Route Optimizer          Real-time Vectors
```

---



What you will see:
- Junction 1 & 2 get flashing red ✕ denial markers instantly.
- Fire Engine and Trauma Ambulance launch simultaneously from their bases.
- Glowing animated routes bend around the blocked junctions in real-time.
- The **AI Reasoning Terminal** types the live decision log.
- Time saved metric updates on screen.

**AI Core Options (built-in):**
| Mode | Model | Use When |
|:---|:---|:---|
| Default | `claude-haiku-4-5` via OpenRouter | Wi-Fi is stable |
| Fallback | Llama 3.3 70B (free tier) | Budget / API issues |
| Offline | Local Heuristic Core (pure regex) | Wi-Fi dies on stage |

> ⚠️ The OpenRouter API key is client-side in `app.js`. Set a low spend cap and rotate the key after the demo at [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Hardware — Operation Vanguard Build
<img width="1280" height="698" alt="image" src="https://github.com/user-attachments/assets/ddf0966b-5a36-4772-97d0-24945dc597b5" />

| Component | Model | Role |
|:---|:---|:---|
| Microcontroller | Arduino UNO R4 WiFi | Brain + Wi-Fi + LED Matrix |
| Motion Sensor | MPU6050 | Fall & impact detection |
| Gas Sensor | MQ-2 | Toxic gas / smoke detection |
| Temp Sensor | DHT11 | Heat & humidity monitoring |
| Power | USB Power Bank | Portable demo power |

---



<p align="center">
  <strong>ARGUS GUARD &nbsp;|&nbsp; Safety in Seconds</strong><br/>
  <em>Built at Hackathon 2026 — Automating the Article 21 Mandate</em>
</p>
