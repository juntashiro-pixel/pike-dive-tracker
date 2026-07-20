import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import {
  isFirebaseConfigured,
  addPracticeSession,
  deletePracticeSession,
  onPracticeUpdates,
  onMeetUpdates,
  saveDiverProfile,
} from "./firebase.js";

const FIREBASE_READY = isFirebaseConfigured();

// ─── APP VERSION (bump on each deploy so you can confirm the live build) ─
const APP_VERSION = "v1.4.0";
const APP_UPDATED = "Jun 15, 2026";

// ─── DD TABLE (FINA) ──────────────────────────────────────────
const DD_TABLE = {
  "001A":{name:"Forward Entry Straight","1M":1.0,"3M":1.0},
  "001B":{name:"Forward Entry Pike","1M":1.0,"3M":1.0},
  "002A":{name:"Back Entry Straight","1M":1.0,"3M":1.0},
  "100A":{name:"Forward Jump Straight","1M":1.0,"3M":1.0},
  "100C":{name:"Forward Jump Tuck","1M":1.0,"3M":1.0},
  "101A":{name:"Forward Dive Straight","1M":1.4,"3M":1.6},
  "101B":{name:"Forward Dive Pike","1M":1.3,"3M":1.5},
  "101C":{name:"Forward Dive Tuck","1M":1.2,"3M":1.4},
  "102A":{name:"Forward Somersault Straight","1M":1.6,"3M":1.7},
  "102B":{name:"Forward Somersault Pike","1M":1.5,"3M":1.6},
  "102C":{name:"Forward Somersault Tuck","1M":1.4,"3M":1.6},
  "103A":{name:"Forward 1½ Somersault Straight","1M":2.0,"3M":2.0},
  "103B":{name:"Forward 1½ Somersault Pike","1M":1.7,"3M":1.7},
  "103C":{name:"Forward 1½ Somersault Tuck","1M":1.6,"3M":1.7},
  "104B":{name:"Forward Double Somersault Pike","1M":2.3,"3M":2.3},
  "104C":{name:"Forward Double Somersault Tuck","1M":2.2,"3M":2.2},
  "105B":{name:"Forward 2½ Somersault Pike","1M":2.4,"3M":2.6},
  "105C":{name:"Forward 2½ Somersault Tuck","1M":2.2,"3M":2.4},
  "200A":{name:"Back Jump Straight","1M":1.0,"3M":1.0},
  "200C":{name:"Back Jump Tuck","1M":1.0,"3M":1.0},
  "201A":{name:"Back Dive Straight","1M":1.7,"3M":1.9},
  "201B":{name:"Back Dive Pike","1M":1.6,"3M":1.8},
  "201C":{name:"Back Dive Tuck","1M":1.5,"3M":1.7},
  "202A":{name:"Back Somersault Straight","1M":1.7,"3M":1.8},
  "202B":{name:"Back Somersault Pike","1M":1.6,"3M":1.7},
  "202C":{name:"Back Somersault Tuck","1M":1.5,"3M":1.6},
  "203A":{name:"Back 1½ Somersault Straight","1M":2.5,"3M":2.4},
  "203B":{name:"Back 1½ Somersault Pike","1M":2.3,"3M":2.2},
  "203C":{name:"Back 1½ Somersault Tuck","1M":2.0,"3M":1.9},
  "204C":{name:"Back Double Somersault Tuck","1M":2.0,"3M":2.0},
  "300A":{name:"Reverse Jump Straight","1M":1.0,"3M":1.0},
  "300C":{name:"Reverse Jump Tuck","1M":1.0,"3M":1.0},
  "301A":{name:"Reverse Dive Straight","1M":1.8,"3M":2.0},
  "301B":{name:"Reverse Dive Pike","1M":1.7,"3M":1.9},
  "301C":{name:"Reverse Dive Tuck","1M":1.6,"3M":1.8},
  "302A":{name:"Reverse Somersault Straight","1M":1.8,"3M":1.9},
  "302B":{name:"Reverse Somersault Pike","1M":1.7,"3M":1.8},
  "302C":{name:"Reverse Somersault Tuck","1M":1.6,"3M":1.7},
  "303C":{name:"Reverse 1½ Somersault Tuck","1M":2.1,"3M":2.0},
  "401A":{name:"Inward Dive Straight","1M":1.8,"3M":2.0},
  "401B":{name:"Inward Dive Pike","1M":1.5,"3M":1.7},
  "401C":{name:"Inward Dive Tuck","1M":1.4,"3M":1.6},
  "402C":{name:"Inward Somersault Tuck","1M":1.5,"3M":1.6},
  "403C":{name:"Inward 1½ Somersault Tuck","1M":2.1,"3M":2.2},
  "5101A":{name:"Forward Jump ½ Twist Straight","1M":1.0,"3M":1.0},
  "5121B":{name:"Forward Somersault ½ Twist Pike","1M":1.7,"3M":1.9},
  "5121D":{name:"Forward Somersault ½ Twist Free","1M":1.7,"3M":1.9},
  "5122D":{name:"Forward Somersault 1 Twist Free","1M":1.9,"3M":2.0},
  "5131D":{name:"Forward 1½ Somersault ½ Twist Free","1M":2.0,"3M":2.0},
  "5201A":{name:"Back Jump ½ Twist Straight","1M":1.0,"3M":1.0},
  "5211A":{name:"Back Dive ½ Twist Straight","1M":1.8,"3M":2.0},
  "5221D":{name:"Back Somersault ½ Twist Free","1M":1.7,"3M":1.8},
  "5231D":{name:"Back 1½ Somersault ½ Twist Free","1M":2.1,"3M":2.0},
  "5311A":{name:"Reverse Dive ½ Twist Straight","1M":1.9,"3M":2.1},
  "5331D":{name:"Reverse 1½ Somersault ½ Twist Free","1M":2.2,"3M":2.1},
};

// ─── DIVE GROUP HELPERS ──────────────────────────────────────
const getDiveGroup = (code) => {
  if (code.startsWith("5")) return 5; // Twisting
  return parseInt(code[0]);
};
const GROUP_NAMES = {1:"Forward",2:"Back",3:"Reverse",4:"Inward",5:"Twisting"};
const GROUP_COLORS = {1:"#2563eb",2:"#dc2626",3:"#059669",4:"#d97706",5:"#7c3aed"};

// ─── AAU QUALIFYING SCORES (2025 Summer Nationals) ───────────
const AAU_QUALIFYING = {
  E: { label: "Group E (9 & Under)", boys: { "1M": null, "3M": null }, girls: { "1M": null, "3M": null }, note: "No minimum score (coaches please use discretion). No Group E Platform—must enter Group D event." },
  D: { label: "Group D (10-11)", boys: { "1M": { score: 140, dives: 5 }, "3M": { score: 150, dives: 5 }, "Platform": { score: 140, dives: 5 } }, girls: { "1M": { score: 155, dives: 5 }, "3M": { score: 160, dives: 5 }, "Platform": { score: 140, dives: 5 } } },
  C: { label: "Group C (12-13)", boys: { "1M": { score: 210, dives: 8 }, "3M": { score: 225, dives: 8 }, "Platform": { score: 190, dives: 7 } }, girls: { "1M": { score: 225, dives: 7 }, "3M": { score: 235, dives: 7 }, "Platform": { score: 175, dives: 6 } } },
  B: { label: "Group B (14-15)", boys: { "1M": { score: 255, dives: 9 }, "3M": { score: 275, dives: 9 }, "Platform": { score: 275, dives: 8 } }, girls: { "1M": { score: 284, dives: 8 }, "3M": { score: 294, dives: 8 }, "Platform": { score: 248, dives: 7 } } },
  A: { label: "Group A (16-18)", boys: { "1M": { score: 365, dives: 10 }, "3M": { score: 390, dives: 10 }, "Platform": { score: 310, dives: 9 } }, girls: { "1M": { score: 340, dives: 9 }, "3M": { score: 350, dives: 9 }, "Platform": { score: 295, dives: 8 } } },
};

// ─── UPCOMING MEETS ──────────────────────────────────────────
const UPCOMING_MEETS = [];

// ─── TODAY'S MEET DIVE LIST (edit this each meet day) ────────
// Pre-loads the Live Scoring calculator so you only enter judge scores.
const TODAY_DIVE_LIST = null; // no meet loaded — Live Scoring opens blank

// ─── DIVELIVE IMPORT (AAU Nationals + CMD meets) ──────────────
const DIVELIVE_RESULTS = [
  {diverId:"gale",meet:"2024 AAU Nationals",date:"2024-07-15",event:"Boys 9 & Under 1M",height:"1M",round:"final",place:10,score:117.6,source:"divelive",dives:[{code:"101A",dd:1.4,net:10.5,award:14.7,role:"vol"},{code:"201A",dd:1.7,net:11.0,award:18.7,role:"vol"},{code:"5211A",dd:1.8,net:10.0,award:18.0,role:"vol"},{code:"202C",dd:1.5,net:7.5,award:11.25,role:"opt"}]},
  {diverId:"gale",meet:"2024 AAU Nationals",date:"2024-07-15",event:"Boys 9 & Under 1M",height:"1M",round:"prelim",place:11,score:69.95,source:"divelive",dives:[{code:"101A",dd:1.4,net:12.5,award:17.5,role:"vol"},{code:"201A",dd:1.7,net:12.5,award:21.25,role:"vol"},{code:"5211A",dd:1.8,net:9.0,award:16.2,role:"vol"},{code:"202C",dd:1.5,net:10.0,award:15.0,role:"opt"}]},
  {diverId:"gale",meet:"2024 CMD Fall",date:"2024-11-24",event:"Novice 9 and under Boys 1M",height:"1M",round:"single",place:1,score:96.5,source:"divelive",dives:[{code:"101A",dd:1.4,net:17.0,award:23.8,role:"opt"},{code:"201A",dd:1.7,net:17.0,award:28.9,role:"opt"},{code:"102C",dd:1.4,net:17.0,award:23.8,role:"opt"},{code:"002A",dd:1.0,net:20.0,award:20.0,role:"opt"}]},
  {diverId:"gale",meet:"2025 CMD Spring",date:"2025-04-05",event:"9 and under Boys 1M",height:"1M",round:"single",place:2,score:84.4,source:"divelive",dives:[{code:"101A",dd:1.4,net:14.0,award:19.6,role:"vol"},{code:"201A",dd:1.7,net:13.0,award:22.1,role:"vol"},{code:"401C",dd:1.4,net:16.5,award:23.1,role:"vol"},{code:"102C",dd:1.4,net:14.0,award:19.6,role:"opt"}]},
  {diverId:"gale",meet:"2025 AAU Nationals",date:"2025-07-15",event:"Boys 9 & Under 1M",height:"1M",round:"final",place:8,score:68.2,source:"divelive",dives:[{code:"101A",dd:1.4,net:13.0,award:18.2,role:"vol"},{code:"201A",dd:1.7,net:13.0,award:22.1,role:"vol"},{code:"5211A",dd:1.8,net:5.5,award:9.9,role:"vol"},{code:"202C",dd:1.5,net:12.0,award:18.0,role:"opt"}]},
  {diverId:"gale",meet:"2025 AAU Nationals",date:"2025-07-15",event:"Boys 9 & Under 1M",height:"1M",round:"prelim",place:10,score:68.7,source:"divelive",dives:[{code:"101A",dd:1.4,net:11.0,award:15.4,role:"vol"},{code:"201A",dd:1.7,net:10.0,award:17.0,role:"vol"},{code:"5211A",dd:1.8,net:11.0,award:19.8,role:"vol"},{code:"202C",dd:1.5,net:11.0,award:16.5,role:"opt"}]},
  {diverId:"gale",meet:"2025 AAU Nationals",date:"2025-07-16",event:"Boys 9 & Under 3M",height:"3M",round:"final",place:9,score:71.45,source:"divelive",dives:[{code:"101A",dd:1.6,net:11.0,award:17.6,role:"vol"},{code:"201A",dd:1.9,net:12.0,award:22.8,role:"vol"},{code:"401C",dd:1.3,net:13.5,award:17.55,role:"vol"},{code:"102C",dd:1.5,net:9.0,award:13.5,role:"opt"}]},
  {diverId:"gale",meet:"2025 AAU Nationals",date:"2025-07-16",event:"Boys 9 & Under 3M",height:"3M",round:"prelim",place:8,score:72.6,source:"divelive",dives:[{code:"101A",dd:1.6,net:11.5,award:18.4,role:"vol"},{code:"201A",dd:1.9,net:14.0,award:26.6,role:"vol"},{code:"401C",dd:1.3,net:12.0,award:15.6,role:"vol"},{code:"5211A",dd:2.0,net:6.0,award:12.0,role:"opt"}]},
  {diverId:"gale",meet:"2026 CMD Spring",date:"2026-04-11",event:"9 and under Boys 1M",height:"1M",round:"single",place:2,score:83.8,source:"divelive",dives:[{code:"101A",dd:1.4,net:17.5,award:24.5,role:"vol"},{code:"201A",dd:1.7,net:17.0,award:28.9,role:"vol"},{code:"5211A",dd:1.8,net:0.0,award:0.0,role:"vol"},{code:"5122D",dd:1.9,net:16.0,award:30.4,role:"opt"}]},
  {diverId:"gale",meet:"2026 CMD Spring",date:"2026-04-11",event:"9 and under Boys 3M",height:"3M",round:"single",place:1,score:78.0,source:"divelive",dives:[{code:"101A",dd:1.6,net:14.0,award:22.4,role:"vol"},{code:"201A",dd:1.9,net:14.0,award:26.6,role:"vol"},{code:"401C",dd:1.3,net:0.0,award:0.0,role:"vol"},{code:"5211A",dd:2.0,net:14.5,award:29.0,role:"opt"}]},
  {diverId:"hayden",meet:"2024 AAU Nationals",date:"2024-07-15",event:"Boys 10 1M",height:"1M",round:"final",place:6,score:92.0,source:"divelive",dives:[{code:"101C",dd:1.2,net:12.5,award:15.0,role:"vol"},{code:"201A",dd:1.7,net:12.5,award:21.25,role:"vol"},{code:"401C",dd:1.4,net:15.0,award:21.0,role:"vol"},{code:"102C",dd:1.4,net:12.5,award:17.5,role:"opt"},{code:"202C",dd:1.5,net:11.5,award:17.25,role:"opt"}]},
  {diverId:"hayden",meet:"2024 AAU Nationals",date:"2024-07-15",event:"Boys 10 1M",height:"1M",round:"prelim",place:3,score:94.85,source:"divelive",dives:[{code:"101C",dd:1.2,net:12.5,award:15.0,role:"vol"},{code:"201A",dd:1.7,net:12.5,award:21.25,role:"vol"},{code:"401C",dd:1.4,net:15.0,award:21.0,role:"vol"},{code:"102C",dd:1.4,net:14.0,award:19.6,role:"opt"},{code:"202C",dd:1.5,net:12.0,award:18.0,role:"opt"}]},
  {diverId:"hayden",meet:"2024 CMD Fall",date:"2024-11-24",event:"10-11 Boys 1M",height:"1M",round:"single",place:2,score:136.2,source:"divelive",dives:[{code:"101C",dd:1.2,net:17.5,award:21.0,role:"vol"},{code:"201A",dd:1.7,net:17.0,award:28.9,role:"vol"},{code:"401C",dd:1.4,net:20.0,award:28.0,role:"vol"},{code:"102C",dd:1.4,net:18.5,award:25.9,role:"opt"},{code:"5211A",dd:1.8,net:18.0,award:32.4,role:"opt"}]},
  {diverId:"hayden",meet:"2025 CMD Spring",date:"2025-04-05",event:"10-11 Boys 1M",height:"1M",round:"single",place:2,score:120.4,source:"divelive",dives:[{code:"102C",dd:1.4,net:18.0,award:25.2,role:"vol"},{code:"201A",dd:1.7,net:18.0,award:30.6,role:"vol"},{code:"401C",dd:1.4,net:14.0,award:19.6,role:"vol"},{code:"5211A",dd:1.8,net:12.5,award:22.5,role:"opt"},{code:"202C",dd:1.5,net:15.0,award:22.5,role:"opt"}]},
  {diverId:"hayden",meet:"2025 CMD Spring",date:"2025-04-05",event:"10-11 Boys 3M",height:"3M",round:"single",place:2,score:109.55,source:"divelive",dives:[{code:"101A",dd:1.6,net:17.0,award:27.2,role:"vol"},{code:"5211A",dd:2.0,net:15.0,award:30.0,role:"vol"},{code:"401C",dd:1.3,net:7.5,award:9.75,role:"vol"},{code:"102C",dd:1.5,net:14.0,award:21.0,role:"opt"},{code:"202C",dd:1.6,net:13.5,award:21.6,role:"opt"}]},
  {diverId:"hayden",meet:"2025 AAU Nationals",date:"2025-07-15",event:"Boys 11 3M",height:"3M",round:"prelim",place:14,score:84.15,source:"divelive",dives:[{code:"101A",dd:1.6,net:12.5,award:20.0,role:"vol"},{code:"201A",dd:1.9,net:10.0,award:19.0,role:"vol"},{code:"401C",dd:1.3,net:11.5,award:14.95,role:"vol"},{code:"5211A",dd:2.0,net:7.5,award:15.0,role:"opt"},{code:"202C",dd:1.6,net:9.5,award:15.2,role:"opt"}]},
  {diverId:"hayden",meet:"2025 AAU Nationals",date:"2025-07-16",event:"Boys 11 1M",height:"1M",round:"prelim",place:15,score:87.55,source:"divelive",dives:[{code:"101A",dd:1.4,net:11.5,award:16.1,role:"vol"},{code:"201A",dd:1.7,net:11.5,award:19.55,role:"vol"},{code:"401C",dd:1.4,net:11.0,award:15.4,role:"vol"},{code:"103C",dd:1.6,net:11.0,award:17.6,role:"opt"},{code:"5211A",dd:1.8,net:10.5,award:18.9,role:"opt"}]},
  {diverId:"hayden",meet:"2026 CMD Spring",date:"2026-04-11",event:"12-13 Boys 1M",height:"1M",round:"single",place:3,score:179.35,source:"divelive",dives:[{code:"101A",dd:1.4,net:15.5,award:21.7,role:"vol"},{code:"201A",dd:1.7,net:13.0,award:22.1,role:"vol"},{code:"301C",dd:1.6,net:10.0,award:16.0,role:"vol"},{code:"401C",dd:1.4,net:14.5,award:20.3,role:"vol"},{code:"5211A",dd:1.8,net:14.0,award:25.2,role:"vol"},{code:"102C",dd:1.4,net:15.0,award:21.0,role:"opt"},{code:"202C",dd:1.5,net:17.0,award:25.5,role:"opt"},{code:"5122D",dd:1.9,net:14.5,award:27.55,role:"opt"}]},
  {diverId:"hayden",meet:"JDA Summer Invite 2026",date:"2026-06-13",event:"Group C Boys 1m (12-13)",height:"1M",round:"single",place:3,score:243.20,source:"divelive",dives:[{code:"103C",dd:1.6,net:18.00,award:28.80,role:"vol"},{code:"201A",dd:1.7,net:20.50,award:34.85,role:"vol"},{code:"401C",dd:1.4,net:21.00,award:29.40,role:"vol"},{code:"301C",dd:1.6,net:17.50,award:28.00,role:"vol"},{code:"5211A",dd:1.8,net:19.00,award:34.20,role:"vol"},{code:"102A",dd:1.6,net:18.50,award:29.60,role:"opt"},{code:"202C",dd:1.5,net:18.00,award:27.00,role:"opt"},{code:"5122D",dd:1.9,net:16.50,award:31.35,role:"opt"}]},
  {diverId:"gale",meet:"2026 AAU Nationals",date:"2026-07-16",event:"Boys 9 & Under 1M",height:"1M",round:"prelim",place:10,score:64.10,source:"divelive",dives:[{code:"103C",dd:1.6,net:11.00,award:17.60,role:"vol"},{code:"5211A",dd:1.8,net:4.00,award:7.20,role:"vol"},{code:"201A",dd:1.7,net:12.50,award:21.25,role:"vol"},{code:"5122D",dd:1.9,net:9.50,award:18.05,role:"opt"}]},
  {diverId:"gale",meet:"2026 AAU Nationals",date:"2026-07-16",event:"Boys 9 & Under 1M",height:"1M",round:"final",place:5,score:86.70,source:"divelive",dives:[{code:"103C",dd:1.6,net:14.50,award:23.20,role:"vol"},{code:"5211A",dd:1.8,net:12.50,award:22.50,role:"vol"},{code:"201A",dd:1.7,net:13.50,award:22.95,role:"vol"},{code:"5122D",dd:1.9,net:9.50,award:18.05,role:"opt"}]},
  {diverId:"gale",meet:"2026 AAU Nationals",date:"2026-07-17",event:"Boys 9 & Under 3M",height:"3M",round:"prelim",place:9,score:68.10,source:"divelive",dives:[{code:"101C",dd:1.4,net:11.00,award:15.40,role:"vol"},{code:"201A",dd:1.9,net:11.50,award:21.85,role:"vol"},{code:"401C",dd:1.3,net:14.50,award:18.85,role:"vol"},{code:"5211A",dd:2.0,net:6.00,award:12.00,role:"opt"}]},
  {diverId:"gale",meet:"2026 AAU Nationals",date:"2026-07-17",event:"Boys 9 & Under 3M",height:"3M",round:"final",place:9,score:74.05,source:"divelive",dives:[{code:"101C",dd:1.4,net:13.00,award:18.20,role:"vol"},{code:"201A",dd:1.9,net:9.50,award:18.05,role:"vol"},{code:"401C",dd:1.3,net:16.00,award:20.80,role:"vol"},{code:"5211A",dd:2.0,net:8.50,award:17.00,role:"opt"}]},
  {diverId:"hayden",meet:"2026 AAU Nationals",date:"2026-07-16",event:"Boys 12 1M",height:"1M",round:"prelim",place:17,score:134.40,source:"divelive",dives:[{code:"201A",dd:1.7,net:14.00,award:23.80,role:"vol"},{code:"401C",dd:1.4,net:14.50,award:20.30,role:"vol"},{code:"301C",dd:1.6,net:8.50,award:13.60,role:"vol"},{code:"5211A",dd:1.8,net:10.50,award:18.90,role:"vol"},{code:"102A",dd:1.6,net:11.50,award:18.40,role:"vol"},{code:"202C",dd:1.5,net:6.50,award:9.75,role:"opt"},{code:"5122D",dd:1.9,net:5.50,award:10.45,role:"opt"},{code:"103C",dd:1.6,net:12.00,award:19.20,role:"opt"}]},
];

// ─── DIVER DATA ──────────────────────────────────────────────
const DIVERS = {
  hayden: {
    id: "hayden", name: "Hayden Tashiro", diveMeetsNum: 80986, birthYear: 2014,
    finaAge: 12, ageGroup: "C", ageGroupLabel: "Group C Boys (12-13)",
    qualifying: {
      "1M": { score: 210, dives: 8 },
      "3M": { score: 225, dives: 8 }
    },
    meetSchedule: {
      meet: "AAU National Championships", location: "Fort Lauderdale, FL", dates: "Jul 16–23, 2026",
      events: [
        { date:"2026-07-16", day:"Thu", event:"Group C Boys 1m (12-13)", height:"1M", note:"Prelims AM · Finals PM" },
      ],
    },
    meetHistory: [
      {meet:"Knight Invite",date:"2025-01-21",event:"Group C Boys 1m (12-13)",height:"1M",place:6,score:143.05},
      {meet:"Long Island Divers Invitational",date:"2025-01-17",event:"Group C Boys 1m (12-13)",height:"1M",place:2,score:182.10},
      {meet:"6th Annual JDA Invite",date:"2024-06-08",event:"Group C Boys 1m (12-13)",height:"1M",place:5,score:180.55},
      {meet:"2025 Marlins Cold Turkey",date:"2024-11-19",event:"Group C Boys 1m (12-13)",height:"1M",place:9,score:147.10},
      {meet:"JDA Summer Invite",date:"2024-07-28",event:"Group D Boys 3m (11 & Under)",height:"3M",place:2,score:136.80},
      {meet:"Kimball Cup AAU",date:"2024-03-04",event:"10-11 Boys 3m Novice",height:"3M",place:4,score:74.70},
      {meet:"Kimball Cup AAU",date:"2024-03-04",event:"Group D Boys 1m (11 & Under)",height:"1M",place:6,score:137.15},
      {meet:"Whirlwind Winter 2025",date:"2025-01-28",event:"Group D Boys 1m (10-11)",height:"1M",place:4,score:107.40},
      {meet:"JDA Summer Invite",date:"2024-06-11",event:"Group D Boys 1m (11 & Under)",height:"1M",place:1,score:129.05},
      {meet:"2024 Zone C Championships",date:"2024-05-19",event:"Group D Boys 1m (11 & Under)",height:"1M",place:12,score:96.65},
      {meet:"2024 Region 5 Championships",date:"2024-04-09",event:"Group D Boys 1m (11 & Under)",height:"1M",place:3,score:123.90},
      {meet:"2024 March Madness",date:"2024-03-18",event:"10-11 Boys 3m Novice",height:"3M",place:5,score:95.10},
      {meet:"2024 March Madness",date:"2024-03-18",event:"Group D Boys 1m (11 & Under)",height:"1M",place:6,score:104.80},
      {meet:"Kimball Cup AAU 2024",date:"2024-03-06",event:"10-11 Boys 1m Novice",height:"1M",place:2,score:66.80},
      {meet:"2023 Marlins Cold Turkey",date:"2023-11-15",event:"10-11 Boys 1m Novice",height:"1M",place:7,score:75.05},
      {meet:"2023 Marlins Cold Turkey",date:"2023-11-15",event:"10-11 Boys 3m Novice",height:"3M",place:2,score:70.75},
    ],
    diveStats: [
      {dive:"001A",height:"3M",highScore:18.00,avgScore:18.00,times:1},
      {dive:"001B",height:"3M",highScore:18.50,avgScore:16.83,times:3},
      {dive:"002A",height:"3M",highScore:15.00,avgScore:15.00,times:1},
      {dive:"100A",height:"1M",highScore:17.00,avgScore:16.33,times:3},
      {dive:"100A",height:"3M",highScore:17.00,avgScore:17.00,times:1},
      {dive:"100C",height:"1M",highScore:17.50,avgScore:16.33,times:3},
      {dive:"100C",height:"3M",highScore:18.00,avgScore:17.75,times:2},
      {dive:"101A",height:"1M",highScore:23.80,avgScore:19.95,times:14},
      {dive:"101A",height:"3M",highScore:25.60,avgScore:23.47,times:3},
      {dive:"101C",height:"1M",highScore:19.20,avgScore:19.20,times:1},
      {dive:"101C",height:"3M",highScore:19.60,avgScore:19.60,times:1},
      {dive:"102C",height:"1M",highScore:25.90,avgScore:19.67,times:10},
      {dive:"200A",height:"1M",highScore:17.50,avgScore:15.75,times:4},
      {dive:"200A",height:"3M",highScore:15.00,avgScore:15.00,times:1},
      {dive:"200C",height:"3M",highScore:18.00,avgScore:18.00,times:1},
      {dive:"201A",height:"1M",highScore:29.75,avgScore:24.00,times:13},
      {dive:"201A",height:"3M",highScore:30.40,avgScore:30.40,times:1},
      {dive:"202C",height:"1M",highScore:26.25,avgScore:21.60,times:10},
      {dive:"202C",height:"3M",highScore:26.40,avgScore:26.40,times:1},
      {dive:"300A",height:"3M",highScore:15.00,avgScore:15.00,times:1},
      {dive:"301C",height:"1M",highScore:24.00,avgScore:21.00,times:4},
      {dive:"302C",height:"1M",highScore:20.00,avgScore:19.60,times:2},
      {dive:"401C",height:"1M",highScore:22.40,avgScore:17.78,times:10},
      {dive:"401C",height:"3M",highScore:23.40,avgScore:21.02,times:3},
      {dive:"5101A",height:"1M",highScore:14.50,avgScore:14.50,times:1},
      {dive:"5201A",height:"1M",highScore:15.50,avgScore:12.83,times:3},
      {dive:"5201A",height:"3M",highScore:16.50,avgScore:16.50,times:1},
      {dive:"5211A",height:"1M",highScore:27.00,avgScore:22.61,times:8},
      {dive:"5211A",height:"3M",highScore:31.00,avgScore:31.00,times:1},
      {dive:"5221D",height:"1M",highScore:21.25,avgScore:14.66,times:4},
    ]
  },
  gale: {
    id: "gale", name: "Gale Tashiro", diveMeetsNum: 152421, birthYear: 2017,
    finaAge: 9, ageGroup: "E", ageGroupLabel: "Group E Boys (9 & Under)",
    qualifying: {
      "1M": { score: null, note: "No minimum (coach discretion)" },
      "3M": { score: null, note: "No minimum (coach discretion)" }
    },
    meetSchedule: {
      meet: "AAU National Championships", location: "Fort Lauderdale, FL", dates: "Jul 16–23, 2026",
      events: [
        { date:"2026-07-16", day:"Thu", event:"Group E Boys 1m (9 & Under)", height:"1M", note:"Prelims AM · Finals PM" },
        { date:"2026-07-17", day:"Fri", event:"Group E Boys 3m (9 & Under)", height:"3M", note:"Prelims AM · Finals PM" },
      ],
    },
    // Coach's current working dive lists from the handwritten sheet
    coachDiveList: {
      "3M": [
        {dive:"101A",pos:"a or c",status:"complete",note:"Front dive straight or tuck"},
        {dive:"201A",pos:"a or c",status:"complete",note:"Back dive straight or tuck"},
        {dive:"401C",pos:"c",status:"learning",note:"Inward dive tuck"},
        {dive:"102C",pos:"c",status:"working",note:"Front sommy tuck"},
        {dive:"202C",pos:"c",status:"working",note:"Back sommy tuck"},
        {dive:"5121B",pos:"b",status:"working",note:"Front sommy w/ half twist pike"},
      ],
      "1M": [
        {dive:"101A",pos:"a or c",status:"complete",note:"Front dive straight or tuck"},
        {dive:"201A",pos:"a or c",status:"complete",note:"Back dive straight or tuck"},
        {dive:"401C",pos:"c",status:"complete",note:"Inward dive tuck"},
        {dive:"301C",pos:"c",status:"struggling",note:"Reverse dive tuck"},
        {dive:"302C",pos:"c",status:"struggling",note:"Reverse sommy tuck"},
        {dive:"103C",pos:"c",status:"working",note:"Front 1.5 sommy tuck"},
        {dive:"5121B",pos:"b",status:"planned",note:"Front sommy w/ half twist pike"},
      ]
    },
    meetHistory: [
      {meet:"Knight Invite",date:"2025-01-21",event:"Group E Boys 1m (9 & Under)",height:"1M",place:2,score:109.90},
      {meet:"Long Island Divers Invitational",date:"2025-01-17",event:"Group E Boys 1m (9 & Under)",height:"1M",place:1,score:83.40},
      {meet:"6th Annual JDA Invite",date:"2024-06-08",event:"Group E Boys 1m (9 & Under)",height:"1M",place:2,score:92.20},
      {meet:"6th Annual JDA Invite",date:"2024-06-08",event:"Group E Boys 3m (9 & Under)",height:"3M",place:1,score:93.20},
      {meet:"2025 Marlins Cold Turkey",date:"2024-11-19",event:"9 & Under Boys 1m J.O",height:"1M",place:3,score:94.65},
      {meet:"Kimball Cup AAU",date:"2024-03-04",event:"9 & Under Boys 3m Novice",height:"3M",place:1,score:68.50},
      {meet:"Kimball Cup AAU",date:"2024-03-04",event:"Group E Boys 1m (9 & Under)",height:"1M",place:2,score:85.45},
      {meet:"Whirlwind Winter 2025",date:"2025-01-28",event:"Group E Boys 1m (9 & Under)",height:"1M",place:1,score:84.60},
      {meet:"2024 Zone C Championships",date:"2024-05-19",event:"Group D Boys 1m (11 & Under)",height:"1M",place:"EXHB",score:38.25},
      {meet:"2024 Region 5 Championships",date:"2024-04-09",event:"Group D Boys 1m (11 & Under)",height:"1M",place:7,score:76.55},
      {meet:"2024 March Madness",date:"2024-03-18",event:"7 & Under Boys 1m Novice",height:"1M",place:1,score:69.60},
      {meet:"2024 March Madness",date:"2024-03-18",event:"7 & Under Boys 3m Novice",height:"3M",place:1,score:50.00},
      {meet:"Kimball Cup AAU 2024",date:"2024-03-06",event:"9 & Under Boys 1m Novice",height:"1M",place:2,score:67.55},
      {meet:"Kimball Cup AAU 2024",date:"2024-03-06",event:"9 & Under Boys 3m Novice",height:"3M",place:2,score:65.50},
      {meet:"Whirlwind Winter 2024",date:"2024-01-23",event:"9 & Under Boys 1m Novice",height:"1M",place:1,score:70.30},
      {meet:"Whirlwind Winter 2024",date:"2024-01-23",event:"9 & Under Boys 3m Novice",height:"3M",place:2,score:63.50},
      {meet:"2023 Marlins Cold Turkey",date:"2023-11-15",event:"9 & Under Boys 1m Novice",height:"1M",place:7,score:55.80},
      {meet:"2023 Marlins Cold Turkey",date:"2023-11-15",event:"9 & Under Boys 3m Novice",height:"3M",place:3,score:53.50},
    ],
    diveStats: [
      {dive:"001A",height:"1M",highScore:12.00,avgScore:12.00,times:1},
      {dive:"001B",height:"3M",highScore:16.50,avgScore:13.10,times:5},
      {dive:"002A",height:"3M",highScore:12.50,avgScore:12.50,times:1},
      {dive:"100C",height:"1M",highScore:15.50,avgScore:15.50,times:1},
      {dive:"100C",height:"3M",highScore:18.50,avgScore:16.60,times:5},
      {dive:"101A",height:"1M",highScore:21.70,avgScore:18.30,times:7},
      {dive:"101A",height:"3M",highScore:24.00,avgScore:20.00,times:3},
      {dive:"101C",height:"1M",highScore:19.20,avgScore:18.00,times:3},
      {dive:"102C",height:"1M",highScore:21.70,avgScore:18.73,times:4},
      {dive:"200A",height:"1M",highScore:15.00,avgScore:14.25,times:2},
      {dive:"200A",height:"3M",highScore:19.00,avgScore:16.00,times:3},
      {dive:"201A",height:"1M",highScore:25.50,avgScore:21.37,times:7},
      {dive:"201C",height:"1M",highScore:23.25,avgScore:21.75,times:2},
      {dive:"202C",height:"1M",highScore:22.50,avgScore:17.81,times:4},
      {dive:"300A",height:"3M",highScore:16.50,avgScore:16.50,times:1},
      {dive:"300C",height:"3M",highScore:15.50,avgScore:15.50,times:1},
      {dive:"401C",height:"1M",highScore:23.80,avgScore:14.12,times:6},
      {dive:"5121D",height:"1M",highScore:26.35,avgScore:22.10,times:2},
      {dive:"5211A",height:"1M",highScore:26.10,avgScore:22.28,times:4},
    ]
  }
};

// ─── MERGE DIVELIVE RESULTS INTO DIVERS ──────────────────────
// This runs once at module load: adds DiveLive meet results to meetHistory
// and recomputes diveStats to include individual dive scores from DiveLive
(function mergeDiveLive() {
  DIVELIVE_RESULTS.forEach(r => {
    const diver = DIVERS[r.diverId];
    if(!diver) return;
    
    // Add to meetHistory if not already present (dedupe by meet+date+height+round)
    const key = `${r.meet}|${r.date}|${r.height}|${r.round}`;
    const exists = diver.meetHistory.some(m => 
      `${m.meet}|${m.date}|${m.height}|${m.round||"single"}` === key
    );
    if(!exists) {
      diver.meetHistory.push({
        meet: r.meet, date: r.date, event: r.event,
        height: r.height, place: r.place, score: r.score,
        round: r.round, source: "divelive",
      });
    }
    
    // Merge individual dives into diveStats
    r.dives.forEach(d => {
      const existing = diver.diveStats.find(s => s.dive === d.code && s.height === r.height);
      if(existing) {
        // Recompute running avg: (oldAvg*oldTimes + newScore) / (oldTimes+1)
        const newTimes = existing.times + 1;
        existing.avgScore = (existing.avgScore * existing.times + d.award) / newTimes;
        existing.times = newTimes;
        existing.highScore = Math.max(existing.highScore, d.award);
      } else {
        diver.diveStats.push({
          dive: d.code, height: r.height,
          highScore: d.award, avgScore: d.award, times: 1,
        });
      }
    });
  });
  
  // Sort each diver's meetHistory by date descending (most recent first)
  Object.values(DIVERS).forEach(diver => {
    diver.meetHistory.sort((a,b) => (b.date||"").localeCompare(a.date||""));
  });
})();

// ─── PRACTICE LOG (in-memory, would be Firestore) ────────────
const PRACTICE_DAYS = {Sun:"Pool",Mon:"Pool",Tue:"Dryland/Trampoline",Thu:"Pool"};

const initPracticeLog = () => {
  // Status: "practiced" | "refused" | "not_attempted"
  const seeds = [
    {diverId:"hayden",date:"2026-03-09",type:"Pool",dives:[
      {code:"101A",height:"1M",status:"practiced"},{code:"201A",height:"1M",status:"practiced"},
      {code:"102C",height:"1M",status:"practiced"},{code:"301C",height:"1M",status:"practiced"},
      {code:"401C",height:"1M",status:"practiced"},{code:"5211A",height:"1M",status:"practiced"},
      {code:"202C",height:"1M",status:"refused"},{code:"302C",height:"1M",status:"not_attempted"},
    ]},
    {diverId:"hayden",date:"2026-03-06",type:"Pool",dives:[
      {code:"101A",height:"1M",status:"practiced"},{code:"201A",height:"1M",status:"practiced"},
      {code:"202C",height:"1M",status:"practiced"},{code:"5221D",height:"1M",status:"refused"},
      {code:"302C",height:"1M",status:"practiced"},{code:"401C",height:"1M",status:"practiced"},
    ]},
    // Gale's last week — actual data from Jun (week of 3/9)
    {diverId:"gale",date:"2026-03-09",type:"Pool",dives:[
      // 3M — practiced: 101A, 201A. Refused: 102C, 202C, 5121B. Not attempted: 401C
      {code:"101A",height:"3M",status:"practiced"},{code:"201A",height:"3M",status:"practiced"},
      {code:"102C",height:"3M",status:"refused"},{code:"202C",height:"3M",status:"refused"},
      {code:"5121B",height:"3M",status:"refused"},{code:"401C",height:"3M",status:"not_attempted"},
      // 1M — practiced: 101A, 201A, 401C. Refused: 301C, 302C, 103C. Not attempted: 5121B
      {code:"101A",height:"1M",status:"practiced"},{code:"201A",height:"1M",status:"practiced"},
      {code:"401C",height:"1M",status:"practiced"},
      {code:"301C",height:"1M",status:"refused"},{code:"302C",height:"1M",status:"refused"},
      {code:"103C",height:"1M",status:"refused"},{code:"5121B",height:"1M",status:"not_attempted"},
    ]},
    {diverId:"gale",date:"2026-03-06",type:"Pool",dives:[
      {code:"101A",height:"1M",status:"practiced"},{code:"201A",height:"1M",status:"practiced"},
      {code:"401C",height:"1M",status:"practiced"},{code:"102C",height:"1M",status:"practiced"},
      {code:"301C",height:"1M",status:"refused"},{code:"5121D",height:"1M",status:"not_attempted"},
      {code:"101A",height:"3M",status:"practiced"},{code:"201A",height:"3M",status:"practiced"},
      {code:"102C",height:"3M",status:"practiced"},{code:"202C",height:"3M",status:"not_attempted"},
    ]},
    {diverId:"gale",date:"2026-03-04",type:"Dryland/Trampoline",dives:[
      {code:"102C",height:"1M",status:"practiced"},{code:"202C",height:"1M",status:"practiced"},
      {code:"301C",height:"1M",status:"refused"},{code:"103C",height:"1M",status:"not_attempted"},
    ]},
  ];
  return seeds;
};

// ─── ICONS ───────────────────────────────────────────────────
const Icon = ({type, size=18}) => {
  const s = {width:size,height:size,display:"inline-block",verticalAlign:"middle"};
  switch(type){
    case "trophy": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></svg>;
    case "chart": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>;
    case "clipboard": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>;
    case "target": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
    case "printer": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
    case "star": return <svg style={s} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
    case "user": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "plus": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>;
    case "check": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;
    case "wave": return <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>;
    default: return null;
  }
};

// ─── MINI SPARKLINE ──────────────────────────────────────────
const Sparkline = ({data, width=120, height=32, color="#2563eb"}) => {
  if(!data||data.length<2) return null;
  const min = Math.min(...data)*0.9;
  const max = Math.max(...data)*1.1;
  const range = max-min||1;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-min)/range)*height}`).join(" ");
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i)=>(
        <circle key={i} cx={(i/(data.length-1))*width} cy={height-((v-min)/range)*height} r="2.5" fill={color}/>
      ))}
    </svg>
  );
};

// ─── STATUS BADGE (Practiced / Refused / Not Attempted) ─────
const STATUS_CONFIG = {
  practiced:    { label:"Practiced",     color:"#10b981", emoji:"✓", short:"P" },
  refused:      { label:"Refused",       color:"#ef4444", emoji:"✗", short:"R" },
  not_attempted:{ label:"Not Attempted", color:"#6b7280", emoji:"—", short:"N" },
};
const StatusBadge = ({status}) => {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.not_attempted;
  return (
    <span style={{
      fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:8,
      background:`${s.color}20`,color:s.color,border:`1px solid ${s.color}33`,
    }}>{s.label}</span>
  );
};

// ─── MINI DIVE ADDER (standalone - own state, no focus loss) ───
const MiniDiveAdder = ({onAdd, placeholder, theme}) => {
  const [search, setSearch] = useState("");
  const [height, setHeight] = useState("1M");
  const q = search.toLowerCase();
  const matches = q.length >= 2 ? Object.entries(DD_TABLE)
    .filter(([code, info]) => code.toLowerCase().includes(q) || info.name.toLowerCase().includes(q))
    .filter(([code]) => (DD_TABLE[code]?.[height]||0) >= 1.0)
    .slice(0, 5) : [];
  return (
    <div style={{marginTop:6}}>
      <div style={{display:"flex",gap:4,alignItems:"center"}}>
        <input placeholder={placeholder||"Add dive..."} value={search}
          onChange={e=>setSearch(e.target.value.toUpperCase())}
          style={{flex:1,padding:7,borderRadius:6,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:11,boxSizing:"border-box"}}
        />
        <select value={height} onChange={e=>setHeight(e.target.value)}
          style={{padding:7,borderRadius:6,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:11}}>
          <option value="1M">1M</option><option value="3M">3M</option>
        </select>
      </div>
      {matches.length > 0 && (
        <div style={{marginTop:4,background:theme.card,border:`1px solid ${theme.cardBorder}`,borderRadius:6,overflow:"hidden"}}>
          {matches.map(([code, info]) => (
            <div key={code} onClick={()=>{
              onAdd({dive:code, height, name:info.name, dd:info[height]||0, group:getDiveGroup(code)});
              setSearch("");
            }} style={{
              display:"flex",alignItems:"center",gap:6,padding:"6px 8px",cursor:"pointer",
              borderBottom:`1px solid ${theme.cardBorder}`,
            }}>
              <span style={{width:5,height:5,borderRadius:"50%",background:GROUP_COLORS[getDiveGroup(code)]}}/>
              <span style={{fontSize:11,fontWeight:700,color:theme.text}}>{code}</span>
              <span style={{fontSize:9,color:theme.textMuted,flex:1}}>{info.name}</span>
              <span style={{fontSize:9,color:theme.accent}}>DD {info[height]}</span>
              <span style={{fontSize:11,color:theme.accent}}>+</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── MAIN APP ────────────────────────────────────────────────
export default function PikeDiveTracker() {
  const [activeDiver, setActiveDiver] = useState("hayden");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [practiceView, setPracticeView] = useState("log");
  const [practiceLog, setPracticeLog] = useState(initPracticeLog);
  const [heightFilter, setHeightFilter] = useState("ALL");
  const [showAddPractice, setShowAddPractice] = useState(false);
  const [newPractice, setNewPractice] = useState({date: new Date().toISOString().slice(0,10), type:"Pool", dives:[]});
  const [newDiveEntry, setNewDiveEntry] = useState({code:"",height:"1M",status:"practiced"});
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showAddMeet, setShowAddMeet] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");

  // ─── LIVE SCORING (unofficial calculator) ──────────────────
  const blankRow = () => ({ code:"", dd:"", scores:["","","","","","",""] });
  const freshSheet = (diverId, judges=3, open=false) => {
    if(TODAY_DIVE_LIST && TODAY_DIVE_LIST.diverId === diverId) {
      const h = TODAY_DIVE_LIST.height;
      return { open, judges, height:h, meetName:TODAY_DIVE_LIST.meet, event:TODAY_DIVE_LIST.event,
        rows: TODAY_DIVE_LIST.codes.map(c=>({ code:c, dd:String((DD_TABLE[c]||{})[h] ?? ""), scores:["","","","","","",""] })) };
    }
    return { open, judges, height:"1M", meetName:"", event:"", rows:[blankRow()] };
  };
  const loadUnofficial = (diverId) => {
    try { const raw = localStorage.getItem(`dt-unofficial-${diverId}`); if(raw) return JSON.parse(raw); } catch(e){}
    return [];
  };
  const [unofficialScores, setUnofficialScores] = useState(()=>loadUnofficial("hayden"));
  const [liveSheet, setLiveSheet] = useState(()=>freshSheet("hayden", 3, true));

  // Event rule presets by age group + height
  const ALL_EVENT_RULES = {
    "E-1M": { vols:3, opts:2, maxVolDD:5.4, maxOptDD:2.2, volGroups:3, optGroups:2, volList:["101C","201C","301C","401C"], label:"Group E Boys 1m (9 & Under) — 5 dives" },
    "E-3M": { vols:3, opts:2, maxVolDD:5.4, maxOptDD:2.6, volGroups:3, optGroups:2, volList:["101C","201C","301C","401C"], label:"Group E Boys 3m (9 & Under) — 5 dives" },
    "C-1M": { vols:5, opts:3, maxVolDD:9.0, maxOptDD:99, volGroups:5, optGroups:3, volList:null, label:"Group C Boys 1m (12-13) — 8 dives" },
    "C-3M": { vols:5, opts:3, maxVolDD:9.5, maxOptDD:99, volGroups:5, optGroups:3, volList:null, label:"Group C Boys 3m (12-13) — 8 dives" },
  };
  // Only show rules for the active diver's age group + custom
  const diverGroup = DIVERS[activeDiver].ageGroup;
  const EVENT_RULES = Object.fromEntries(
    Object.entries(ALL_EVENT_RULES).filter(([k]) => k.startsWith(diverGroup + "-"))
  );
  const defaultRuleKey = `${diverGroup}-1M`;
  const [meetRuleKey, setMeetRuleKey] = useState(defaultRuleKey);
  const [meetRules, setMeetRules] = useState(EVENT_RULES[defaultRuleKey] || Object.values(ALL_EVENT_RULES)[0]);
  const [meetHeight, setMeetHeight] = useState("1M");
  const [showCustomRules, setShowCustomRules] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  // Load customizations from localStorage per diver
  const loadDiverPrefs = (diverId) => {
    try {
      const raw = localStorage.getItem(`dt-prefs-${diverId}`);
      if(raw) {
        const p = JSON.parse(raw);
        return {
          hidden: new Set(p.hidden || []),
          extraPrint: p.extraPrint || [],
          extraPlan: p.extraPlan || [],
          compOverrides: p.compOverrides || [],
          removedComp: new Set(p.removedComp || []),
        };
      }
    } catch(e) {}
    return { hidden: new Set(), extraPrint: [], extraPlan: [], compOverrides: [], removedComp: new Set() };
  };
  const saveDiverPrefs = (diverId, hidden, extraPrint, extraPlan, compOverrides, removedComp) => {
    try {
      localStorage.setItem(`dt-prefs-${diverId}`, JSON.stringify({
        hidden: [...hidden], extraPrint, extraPlan, compOverrides, removedComp: [...removedComp],
      }));
    } catch(e) {}
  };
  
  const initPrefs = loadDiverPrefs(activeDiver);
  const [hiddenPrintDives, setHiddenPrintDives] = useState(initPrefs.hidden);
  const [extraPrintDives, setExtraPrintDives] = useState(initPrefs.extraPrint);
  const [extraPlanDives, setExtraPlanDives] = useState(initPrefs.extraPlan);
  const [compDiveOverrides, setCompDiveOverrides] = useState(initPrefs.compOverrides);
  const [removedCompDives, setRemovedCompDives] = useState(initPrefs.removedComp);
  
  // Save prefs whenever they change
  useEffect(() => {
    saveDiverPrefs(activeDiver, hiddenPrintDives, extraPrintDives, extraPlanDives, compDiveOverrides, removedCompDives);
  }, [hiddenPrintDives, extraPrintDives, extraPlanDives, compDiveOverrides, removedCompDives, activeDiver]);
  const printRef = useRef();
  const [firebaseStatus, setFirebaseStatus] = useState(
    FIREBASE_READY ? "connecting" : "local"
  ); // "local" | "connecting" | "connected"

  // ─── Firebase real-time sync ───────────────────────────────
  useEffect(() => {
    if (!FIREBASE_READY) return;
    let unsubs = [];
    try {
      // Subscribe to practice sessions for active diver
      const unsubPractice = onPracticeUpdates(activeDiver, (sessions) => {
        setPracticeLog(prev => {
          // Merge: keep local seeds for non-Firebase, replace with Firestore data
          const firebaseSessions = sessions.map(s => ({
            ...s,
            diverId: activeDiver,
            _fromFirebase: true,
          }));
          const otherDiverLocal = prev.filter(p => p.diverId !== activeDiver && !p._fromFirebase);
          return [...otherDiverLocal, ...firebaseSessions];
        });
        setFirebaseStatus("connected");
      });
      unsubs.push(unsubPractice);
    } catch (e) {
      console.error("Firebase sync error:", e);
      setFirebaseStatus("local");
    }
    return () => unsubs.forEach(fn => fn());
  }, [activeDiver]);

  // Auto-close print preview after print dialog
  useEffect(() => {
    const handleAfterPrint = () => setShowPrintPreview(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // Reset meet rules when switching divers
  useEffect(() => {
    const g = DIVERS[activeDiver].ageGroup;
    const key = `${g}-1M`;
    const rules = ALL_EVENT_RULES[key];
    if(rules) { setMeetRuleKey(key); setMeetRules(rules); setMeetHeight("1M"); setShowCustomRules(false); }
    const prefs = loadDiverPrefs(activeDiver);
    setHiddenPrintDives(prefs.hidden);
    setEditingSession(null);
    setExtraPrintDives(prefs.extraPrint);
    setExtraPlanDives(prefs.extraPlan);
    setCompDiveOverrides(prefs.compOverrides);
    setRemovedCompDives(prefs.removedComp);
    setUnofficialScores(loadUnofficial(activeDiver));
    setLiveSheet(freshSheet(activeDiver, 3, activeDiver==="hayden"));
  }, [activeDiver]);

  const diver = DIVERS[activeDiver];
  const otherDiver = DIVERS[activeDiver==="hayden"?"gale":"hayden"];

  const diverPractice = useMemo(()=>
    practiceLog.filter(p=>p.diverId===activeDiver).sort((a,b)=>b.date.localeCompare(a.date))
  ,[practiceLog, activeDiver]);

  // Practice frequency per dive (last 5 sessions)
  const practiceFrequency = useMemo(()=>{
    const freq = {};
    const recent5 = diverPractice.slice(0,5);
    recent5.forEach(session=>{
      session.dives.forEach(d=>{
        const key = `${d.code}-${d.height}`;
        if(!freq[key]) freq[key]={code:d.code,height:d.height,sessions:0,practiced:0,refused:0,not_attempted:0};
        freq[key].sessions++;
        const status = d.status || "practiced"; // backward compat
        if(status === "practiced") freq[key].practiced++;
        else if(status === "refused") freq[key].refused++;
        else freq[key].not_attempted++;
      });
    });
    return freq;
  },[diverPractice]);

  // Recommended next dives
  const recommendations = useMemo(()=>{
    const competed = new Set(diver.diveStats.map(s=>`${s.dive}-${s.height}`));
    const groups = {};
    diver.diveStats.forEach(s=>{
      const g = getDiveGroup(s.dive);
      if(!groups[g]) groups[g]={count:0,heights:new Set()};
      groups[g].count++;
      groups[g].heights.add(s.height);
    });
    const recs = [];
    // Suggest higher difficulty dives in established groups
    const nextDives = {
      "101A":["102C","103C"],"101C":["102C","103C"],
      "201A":["202C","203C"],"201C":["202C","203C"],
      "301C":["302C","303C"],"302C":["303C"],
      "401C":["402C","403C"],
      "5211A":["5221D","5231D"],"5121D":["5131D"],
    };
    diver.diveStats.forEach(s=>{
      const progressions = nextDives[s.dive]||[];
      progressions.forEach(next=>{
        const key = `${next}-${s.height}`;
        if(!competed.has(key) && DD_TABLE[next]){
          recs.push({
            dive:next, height:s.height,
            name: DD_TABLE[next].name,
            dd: DD_TABLE[next][s.height]||"?",
            reason:`Progression from ${s.dive}`,
            group: getDiveGroup(next),
            priority: s.times>=3?"high":"medium"
          });
        }
      });
    });
    // Check for missing groups
    [1,2,3,4,5].forEach(g=>{
      if(!groups[g]){
        const starters = {1:"101C",2:"201C",3:"301C",4:"401C",5:"5211A"};
        const code = starters[g];
        if(DD_TABLE[code]) recs.push({
          dive:code, height:"1M", name:DD_TABLE[code].name,
          dd:DD_TABLE[code]["1M"], reason:`Add ${GROUP_NAMES[g]} group`,
          group:g, priority:"high"
        });
      }
    });
    // Deduplicate
    const seen = new Set();
    return recs.filter(r=>{
      const k=`${r.dive}-${r.height}`;
      if(seen.has(k)) return false;
      seen.add(k); return true;
    }).sort((a,b)=>a.priority==="high"?-1:1);
  },[diver]);

  const addPracticeEntry = async () => {
    if(newPractice.dives.length===0) return;
    const entry = {...newPractice, diverId:activeDiver};

    // Save to Firestore if connected
    if(FIREBASE_READY) {
      try {
        await addPracticeSession(activeDiver, {
          date: newPractice.date,
          type: newPractice.type,
          dives: newPractice.dives,
        });
      } catch(e) {
        console.error("Failed to save to Firestore:", e);
      }
    }

    // Always update local state as fallback
    setPracticeLog(prev=>[...prev, entry]);
    setNewPractice({date:new Date().toISOString().slice(0,10),type:"Pool",dives:[]});
    setShowAddPractice(false);
  };

  const addDiveToPractice = () => {
    if(!newDiveEntry.code) return;
    setNewPractice(prev=>({...prev, dives:[...prev.dives, {...newDiveEntry}]}));
    setNewDiveEntry({code:"",height:"1M",status:"practiced"});
  };

  // ─── STYLES ────────────────────────────────────────────────
  const theme = {
    bg: "#0c1220",
    card: "#141e33",
    cardBorder: "#1e2d4a",
    surface: "#1a2744",
    text: "#e2e8f0",
    textMuted: "#8896b3",
    accent: activeDiver==="hayden" ? "#3b82f6" : "#10b981",
    accentGlow: activeDiver==="hayden" ? "rgba(59,130,246,0.15)" : "rgba(16,185,129,0.15)",
    gold: "#f59e0b",
    danger: "#ef4444",
    success: "#10b981",
  };

  const cardStyle = {
    background: theme.card,
    border: `1px solid ${theme.cardBorder}`,
    borderRadius: 14,
    padding: "16px",
    marginBottom: 12,
  };

  const tabBtn = (tab) => ({
    flex:1, padding:"8px 2px", border:"none",
    background: activeTab===tab ? theme.accent : "transparent",
    color: activeTab===tab ? "#fff" : theme.textMuted,
    fontWeight: activeTab===tab ? 700 : 500,
    fontSize: 9, borderRadius: 8, cursor:"pointer",
    transition:"all 0.2s", display:"flex", flexDirection:"column",
    alignItems:"center", gap:2, letterSpacing:"-0.01em",
  });

  const badge = (color, text) => (
    <span style={{
      display:"inline-block",padding:"2px 8px",borderRadius:20,
      fontSize:11,fontWeight:600,
      background:`${color}22`,color:color,
      border:`1px solid ${color}44`,
    }}>{text}</span>
  );

  // ─── RENDER: DASHBOARD ─────────────────────────────────────
  const renderDashboard = () => {
    const d = diver;
    const scores1M = d.meetHistory.filter(m=>m.height==="1M").map(m=>m.score);
    const scores3M = d.meetHistory.filter(m=>m.height==="3M").map(m=>m.score);
    const best1M = scores1M.length ? Math.max(...scores1M) : 0;
    const best3M = scores3M.length ? Math.max(...scores3M) : 0;
    const recent1M = scores1M.length ? scores1M[0] : 0;

    return (
      <div>
        {/* Diver Selector */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {Object.values(DIVERS).map(dv=>(
            <button key={dv.id} onClick={()=>setActiveDiver(dv.id)} style={{
              flex:1, padding:"14px 12px", borderRadius:12, border:`2px solid ${activeDiver===dv.id ? (dv.id==="hayden"?"#3b82f6":"#10b981") : theme.cardBorder}`,
              background: activeDiver===dv.id ? (dv.id==="hayden"?"rgba(59,130,246,0.12)":"rgba(16,185,129,0.12)") : theme.card,
              color: theme.text, cursor:"pointer", transition:"all 0.2s",
            }}>
              <div style={{fontWeight:700,fontSize:16}}>{dv.name.split(" ")[0]}</div>
              <div style={{fontSize:11,color:theme.textMuted,marginTop:2}}>{dv.ageGroupLabel}</div>
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
          <div style={{...cardStyle,textAlign:"center"}}>
            <div style={{fontSize:11,color:theme.textMuted,marginBottom:4}}>Best 1M</div>
            <div style={{fontSize:24,fontWeight:800,color:theme.accent}}>{best1M.toFixed(1)}</div>
            {d.qualifying?.["1M"]?.score && (
              <div style={{fontSize:10,color:theme.textMuted,marginTop:2}}>
                Need: {d.qualifying["1M"].score}
              </div>
            )}
          </div>
          <div style={{...cardStyle,textAlign:"center"}}>
            <div style={{fontSize:11,color:theme.textMuted,marginBottom:4}}>Best 3M</div>
            <div style={{fontSize:24,fontWeight:800,color:theme.accent}}>{best3M.toFixed(1)}</div>
            {d.qualifying?.["3M"]?.score && (
              <div style={{fontSize:10,color:theme.textMuted,marginTop:2}}>
                Need: {d.qualifying["3M"].score}
              </div>
            )}
          </div>
          <div style={{...cardStyle,textAlign:"center"}}>
            <div style={{fontSize:11,color:theme.textMuted,marginBottom:4}}>Meets</div>
            <div style={{fontSize:24,fontWeight:800,color:theme.gold}}>{d.meetHistory.length}</div>
          </div>
          <div style={{...cardStyle,textAlign:"center"}}>
            <div style={{fontSize:11,color:theme.textMuted,marginBottom:4}}>Unique Dives</div>
            <div style={{fontSize:24,fontWeight:800,color:"#a78bfa"}}>{d.diveStats.length}</div>
          </div>
        </div>

        {/* Score Trends */}
        <div style={cardStyle}>
          <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:8}}>
            <Icon type="chart" size={14}/> Score Trends
          </div>
          {scores1M.length >= 2 && (
            <div style={{marginBottom:scores3M.length>=2?10:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:600,color:theme.accent}}>1M</span>
                <span style={{fontSize:10,color:theme.textMuted}}>Latest: {scores1M[0]} · Best: {best1M}</span>
              </div>
              <Sparkline data={[...scores1M].reverse()} width={280} height={40} color={theme.accent}/>
            </div>
          )}
          {scores3M.length >= 2 && (
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:11,fontWeight:600,color:"#a78bfa"}}>3M</span>
                <span style={{fontSize:10,color:theme.textMuted}}>Latest: {scores3M[0]} · Best: {best3M}</span>
              </div>
              <Sparkline data={[...scores3M].reverse()} width={280} height={40} color="#a78bfa"/>
            </div>
          )}
          {scores1M.length < 2 && scores3M.length < 2 && (
            <div style={{fontSize:11,color:theme.textMuted}}>Need 2+ meets to show trends</div>
          )}
        </div>

        {/* Compact Upcoming Meets */}
        <div style={{...cardStyle,padding:"10px 14px"}}>
          <div style={{fontSize:11,fontWeight:700,color:theme.textMuted,marginBottom:6,letterSpacing:"0.04em"}}>UPCOMING</div>
          <div style={{display:"flex",gap:6}}>
            {UPCOMING_MEETS.map((m,i)=>(
              <div key={i} style={{
                flex:1,padding:"8px 6px",borderRadius:8,textAlign:"center",
                background: m.goal ? `${theme.gold}12` : theme.surface,
                border: `1px solid ${m.goal ? theme.gold+"33" : theme.cardBorder}`,
              }}>
                <div style={{fontSize:10,fontWeight:700,color: m.goal ? theme.gold : theme.text,lineHeight:1.3}}>
                  {m.goal ? "🎯 " : ""}{m.name.replace("2026 ","").replace(" Championships","")}
                </div>
                <div style={{fontSize:9,color:theme.textMuted,marginTop:2}}>{m.date}</div>
                <div style={{fontSize:9,color:theme.textMuted}}>{m.location.split(",")[0]}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AAU Nationals Qualifying — next season, by FINA age at the next championship */}
        {(() => {
          const now = new Date();
          const nextChampYear = now.getFullYear() + (now.getMonth() >= 6 ? 1 : 0);
          const by = d.birthYear || (2026 - d.finaAge);
          const nextAge = nextChampYear - by;
          const ageToGroup = a => a<=9?"E":a<=11?"D":a<=13?"C":a<=15?"B":"A";
          const grp = ageToGroup(nextAge);
          const gi = AAU_QUALIFYING[grp];
          const movedUp = grp !== d.ageGroup;
          const first = d.name.split(" ")[0];
          return (
            <div style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:2}}>
                <Icon type="target" size={14}/> {nextChampYear} AAU Nationals Qualifying
              </div>
              <div style={{fontSize:10,color:theme.textMuted,marginBottom:8}}>
                {first} will be FINA {nextAge} · {gi.label}{movedUp?" — moved up this season":""}
              </div>
              {["1M","3M"].map(h=>{
                const best = h==="1M" ? best1M : best3M;
                const tgt = gi.boys[h];
                if(!tgt){
                  return (
                    <div key={h} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:12,fontWeight:600,color:theme.text}}>{h}</span>
                      <span style={{fontSize:11,color:theme.success}}>No minimum · coach's discretion</span>
                    </div>
                  );
                }
                const pct = Math.min(100,(best/tgt.score)*100);
                const ok = best>=tgt.score;
                return (
                  <div key={h} style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:12,fontWeight:600,color:theme.text}}>{h}</span>
                      <span style={{fontSize:11,color: ok ? theme.success : theme.textMuted}}>
                        {best.toFixed(1)} / {tgt.score} {ok ? "✓ on pace" : `(${(tgt.score-best).toFixed(1)} to go)`}
                      </span>
                    </div>
                    <div style={{height:7,background:theme.surface,borderRadius:4,overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:4,transition:"width 0.5s",width:`${pct}%`,
                        background: ok ? `linear-gradient(90deg,${theme.success},#34d399)` : `linear-gradient(90deg,${theme.accent},#60a5fa)`}}/>
                    </div>
                    <div style={{fontSize:9,color:theme.textMuted,marginTop:2}}>
                      {tgt.score} pts ({tgt.dives} dives) · {gi.label}{movedUp?" — first season needing a qualifying score":""}
                    </div>
                  </div>
                );
              })}
              <div style={{fontSize:9,color:theme.textMuted,marginTop:4,fontStyle:"italic"}}>
                Best so far vs the {nextChampYear} standard{movedUp?" (new group may use a different dive count)":""}. Numbers from the last published AAU table — update when {nextChampYear} scores post.
              </div>
            </div>
          );
        })()}

        {/* Star Dives — motivational highlight */}
        {(() => {
          const skipDives = new Set(["001A","001B","002A","100A","100C","200A","200C","300A","300C","5101A","5201A"]);
          const stars = d.diveStats
            .filter(s => !skipDives.has(s.dive) && s.times >= 2 && DD_TABLE[s.dive])
            .map(s => ({ ...s, dd: DD_TABLE[s.dive]?.[s.height] || 0, name: DD_TABLE[s.dive]?.name }))
            .sort((a,b) => b.highScore - a.highScore)
            .slice(0, 3);
          if(!stars.length) return null;
          return (
            <div style={{...cardStyle, background:`linear-gradient(135deg, ${theme.card}, ${theme.accent}11)`}}>
              <div style={{fontSize:13,fontWeight:700,color:theme.gold,marginBottom:8}}>
                ⭐ Star Dives
              </div>
              {stars.map((s,i) => (
                <div key={i} style={{
                  display:"flex",alignItems:"center",gap:8,
                  padding:"6px 0",borderTop:i>0?`1px solid ${theme.cardBorder}`:"none",
                }}>
                  <span style={{fontSize:16,fontWeight:800,color:theme.gold,width:22,textAlign:"center"}}>{i+1}</span>
                  <span style={{width:6,height:20,borderRadius:3,background:GROUP_COLORS[getDiveGroup(s.dive)]}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:theme.text}}>{s.dive} <span style={{fontSize:10,color:theme.textMuted}}>{s.height}</span></div>
                    <div style={{fontSize:10,color:theme.textMuted}}>{s.name} · DD {s.dd}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:16,fontWeight:800,color:theme.gold}}>{s.highScore.toFixed(1)}</div>
                    <div style={{fontSize:9,color:theme.textMuted}}>{s.times}× competed</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Top Performances — motivator */}
        {(() => {
          const topMeets = [...d.meetHistory]
            .sort((a,b) => b.score - a.score)
            .slice(0, 3);
          if(!topMeets.length) return null;
          return (
            <div style={{...cardStyle,background:`linear-gradient(135deg, ${theme.card}, ${theme.surface})`}}>
              <div style={{fontSize:13,fontWeight:700,color:theme.gold,marginBottom:8}}>
                ⭐ Personal Bests
              </div>
              {topMeets.map((m,i) => (
                <div key={i} style={{
                  display:"flex",alignItems:"center",gap:8,
                  padding:"6px 0",borderBottom:i<topMeets.length-1?`1px solid ${theme.cardBorder}`:"none",
                }}>
                  <span style={{fontSize:16,fontWeight:800,color:i===0?theme.gold:theme.textMuted,width:20,textAlign:"center"}}>{i+1}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:theme.text}}>{m.meet}</div>
                    <div style={{fontSize:10,color:theme.textMuted}}>{m.event} · {m.date} · {m.height}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:15,fontWeight:800,color:i===0?theme.gold:theme.text}}>{typeof m.score==="number"?m.score.toFixed(2):m.score}</div>
                    {typeof m.place==="number" && <div style={{fontSize:9,color:theme.textMuted}}>#{m.place}</div>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Recent Meets */}
        <div style={cardStyle}>
          <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:8}}>
            <Icon type="trophy" size={14}/> Recent Meets
          </div>
          {d.meetHistory.slice(0,4).map((m,i)=>(
            <div key={i} style={{
              display:"flex",justifyContent:"space-between",alignItems:"center",
              padding:"7px 0",borderBottom:i<3?`1px solid ${theme.cardBorder}`:"none",
            }}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:theme.text}}>{m.meet}</div>
                <div style={{fontSize:10,color:theme.textMuted}}>{m.event} — {m.date}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:700,color:theme.accent}}>{m.score}</div>
                <div style={{fontSize:10}}>
                  {typeof m.place==="number" ? badge(m.place<=3?theme.gold:theme.textMuted,`#${m.place}`) : badge(theme.textMuted, m.place)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── RENDER: DIVE STATS ────────────────────────────────────
  const [expandedDive, setExpandedDive] = useState(null);

  const [ddLookup, setDdLookup] = useState("");
  
  const renderDiveStats = () => {
    const filtered = heightFilter==="ALL" ? diver.diveStats : diver.diveStats.filter(s=>s.height===heightFilter);
    
    // Group by dive group
    const grouped = {};
    filtered.forEach(s => {
      const g = getDiveGroup(s.dive);
      if(!grouped[g]) grouped[g] = [];
      grouped[g].push(s);
    });
    Object.keys(grouped).forEach(g => {
      grouped[g].sort((a,b) => {
        const ddA = DD_TABLE[a.dive]?.[a.height]||0;
        const ddB = DD_TABLE[b.dive]?.[b.height]||0;
        return ddB - ddA;
      });
    });

    // DD lookup results
    const ddResults = ddLookup.length >= 2 ? Object.entries(DD_TABLE)
      .filter(([code, info]) => code.toLowerCase().includes(ddLookup.toLowerCase()) || info.name.toLowerCase().includes(ddLookup.toLowerCase()))
      .slice(0, 6) : [];

    return (
      <div>
        {/* DD Lookup Tool */}
        <div style={{...cardStyle,padding:"10px 12px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:theme.text,marginBottom:4}}>🔍 DD Lookup</div>
          <input placeholder="Search any dive code or name..." value={ddLookup}
            onChange={e=>setDdLookup(e.target.value)}
            style={{width:"100%",padding:8,borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:12,boxSizing:"border-box"}}
          />
          {ddResults.length > 0 && (
            <div style={{marginTop:6}}>
              {ddResults.map(([code, info]) => (
                <div key={code} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${theme.cardBorder}`}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:GROUP_COLORS[getDiveGroup(code)],flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:theme.text,width:50}}>{code}</span>
                  <span style={{fontSize:10,color:theme.textMuted,flex:1}}>{info.name}</span>
                  <span style={{fontSize:10,fontWeight:600,color:theme.accent}}>1M: {info["1M"]}</span>
                  <span style={{fontSize:10,fontWeight:600,color:"#a78bfa"}}>3M: {info["3M"]}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {["ALL","1M","3M"].map(h=>(
            <button key={h} onClick={()=>setHeightFilter(h)} style={{
              padding:"6px 16px",borderRadius:8,border:`1px solid ${theme.cardBorder}`,
              background:heightFilter===h?theme.accent:"transparent",
              color:heightFilter===h?"#fff":theme.textMuted,fontWeight:600,fontSize:12,cursor:"pointer",
            }}>{h}</button>
          ))}
        </div>
        {[1,2,3,4,5].map(g => {
          if(!grouped[g]?.length) return null;
          return (
            <div key={g} style={{marginBottom:12}}>
              <div style={{
                display:"flex",alignItems:"center",gap:8,marginBottom:6,
                padding:"6px 0",borderBottom:`2px solid ${GROUP_COLORS[g]}`,
              }}>
                <span style={{width:10,height:10,borderRadius:"50%",background:GROUP_COLORS[g]}}/>
                <span style={{fontSize:13,fontWeight:700,color:theme.text}}>{GROUP_NAMES[g]}</span>
                <span style={{fontSize:10,color:theme.textMuted}}>{grouped[g].length} dives</span>
              </div>
              {grouped[g].map((s,i) => {
                const dd = DD_TABLE[s.dive];
                const group = getDiveGroup(s.dive);
                const freqKey = `${s.dive}-${s.height}`;
                const pFreq = practiceFrequency[freqKey];
                const diveKey = `${s.dive}-${s.height}`;
                const isExpanded = expandedDive === diveKey;
                
                // Find all meet scores for this dive (for trend)
                const meetScores = diver.meetHistory
                  .filter(m => {
                    // We don't have dive-level scores in meets, but we have diveStats
                    return false; // placeholder — we only have aggregate stats
                  });
                
                return (
                  <div key={i} style={{
                    ...cardStyle, padding:"10px 12px", marginBottom:4,
                    borderLeft:`3px solid ${GROUP_COLORS[group]}`,
                    cursor:"pointer",
                  }} onClick={() => setExpandedDive(isExpanded ? null : diveKey)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{fontSize:14,fontWeight:700,color:theme.text}}>{s.dive}</span>
                          <span style={{fontSize:11,color:theme.textMuted}}>{s.height}</span>
                          {dd && <span style={{fontSize:10,color:theme.accent,fontWeight:600}}>DD {dd[s.height]||"?"}</span>}
                        </div>
                        <div style={{fontSize:11,color:theme.textMuted}}>{dd?.name || "Unknown"}</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:16,fontWeight:800,color:theme.gold}}>{s.highScore.toFixed(1)}</div>
                        <div style={{fontSize:10,color:theme.textMuted}}>avg {s.avgScore.toFixed(1)}</div>
                      </div>
                    </div>
                    
                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{marginTop:8,padding:"8px 0",borderTop:`1px solid ${theme.cardBorder}`}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                          <div>
                            <div style={{fontSize:10,color:theme.textMuted}}>Competed</div>
                            <div style={{fontSize:14,fontWeight:700,color:theme.text}}>{s.times}×</div>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:theme.textMuted}}>Best</div>
                            <div style={{fontSize:14,fontWeight:700,color:theme.gold}}>{s.highScore.toFixed(1)}</div>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:theme.textMuted}}>Average</div>
                            <div style={{fontSize:14,fontWeight:700,color:theme.text}}>{s.avgScore.toFixed(1)}</div>
                          </div>
                          <div>
                            <div style={{fontSize:10,color:theme.textMuted}}>Gap</div>
                            <div style={{fontSize:14,fontWeight:700,color:s.highScore-s.avgScore>3?theme.danger:theme.success}}>
                              {(s.highScore-s.avgScore).toFixed(1)}
                            </div>
                          </div>
                        </div>
                        {/* Performance sparkline — estimated range from competitions */}
                        {s.times >= 2 && (() => {
                          // Generate estimated score points based on avg, high, and count
                          const n = Math.min(s.times, 12);
                          const low = Math.max(s.avgScore - (s.highScore - s.avgScore) * 0.8, s.avgScore * 0.7);
                          const pts = [];
                          for(let j = 0; j < n; j++) {
                            const t = j / (n - 1);
                            // Trend upward from low toward avg, with variance
                            const base = low + (s.avgScore - low) * t;
                            const variance = (s.highScore - s.avgScore) * 0.4 * Math.sin(j * 2.3 + 1);
                            pts.push(Math.max(low * 0.9, Math.min(s.highScore, base + variance)));
                          }
                          // Make sure the highest point matches actual high
                          const peakIdx = Math.max(1, Math.floor(n * 0.7));
                          if(peakIdx < pts.length) pts[peakIdx] = s.highScore;
                          // Last point near avg
                          pts[pts.length - 1] = s.avgScore + (s.highScore - s.avgScore) * 0.2;
                          return (
                            <div style={{marginBottom:6}}>
                              <Sparkline data={pts} width={260} height={36} color={GROUP_COLORS[getDiveGroup(s.dive)]}/>
                              <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:theme.textMuted,marginTop:2}}>
                                <span>First</span>
                                <span style={{color:theme.gold}}>▲ best: {s.highScore.toFixed(1)}</span>
                                <span>Recent</span>
                              </div>
                            </div>
                          );
                        })()}
                        {/* Score range bar */}
                        <div style={{height:6,background:theme.surface,borderRadius:3,position:"relative",marginBottom:6}}>
                          <div style={{position:"absolute",left:0,top:0,height:"100%",borderRadius:3,
                            width:`${(s.avgScore/s.highScore)*100}%`,background:theme.accent,opacity:0.5}}/>
                          <div style={{position:"absolute",right:0,top:0,height:"100%",borderRadius:3,
                            width:`${((s.highScore-s.avgScore)/s.highScore)*100}%`,background:theme.gold,opacity:0.3}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:theme.textMuted}}>
                          <span>0</span>
                          <span>avg: {s.avgScore.toFixed(1)}</span>
                          <span>best: {s.highScore.toFixed(1)}</span>
                        </div>
                        {pFreq && (
                          <div style={{fontSize:10,marginTop:6,display:"flex",gap:8}}>
                            {pFreq.practiced > 0 && <span style={{color:theme.success}}>✓ {pFreq.practiced}× practiced</span>}
                            {pFreq.refused > 0 && <span style={{color:theme.danger}}>✗ {pFreq.refused}× refused</span>}
                            {pFreq.not_attempted > 0 && <span style={{color:theme.textMuted}}>— {pFreq.not_attempted}× skipped</span>}
                          </div>
                        )}
                        {!pFreq && (
                          <div style={{fontSize:10,color:theme.danger,marginTop:6}}>
                            Not in last 5 sessions
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!isExpanded && (
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:4,alignItems:"center"}}>
                        <span style={{fontSize:10,color:theme.textMuted}}>
                          {s.times}× competed {s.times>=5?"🔥":""}
                        </span>
                        <span style={{fontSize:9,color:theme.textMuted}}>tap for detail</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── RENDER: PRACTICE LOG ──────────────────────────────────
  const [diveSearch, setDiveSearch] = useState("");
  const [showDiveDropdown, setShowDiveDropdown] = useState(false);

  // All dives for autocomplete
  const allDiveOptions = useMemo(() => {
    return Object.entries(DD_TABLE).map(([code, info]) => ({
      code, name: info.name, group: getDiveGroup(code),
      dd1M: info["1M"], dd3M: info["3M"],
    })).filter(d => d.dd1M >= 1.2 || d.dd3M >= 1.2); // skip entries/jumps from autocomplete
  }, []);

  const filteredDiveOptions = useMemo(() => {
    if(!diveSearch) return [];
    const q = diveSearch.toLowerCase();
    return allDiveOptions.filter(d =>
      d.code.toLowerCase().includes(q) || d.name.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [diveSearch, allDiveOptions]);

  // Quick-add suggested dives from the practice plan
  const quickAddDives = useMemo(() => {
    const skipDives = new Set(["001A","001B","002A","100A","100C","200A","200C","300A","300C","5101A","5201A"]);
    return diver.diveStats
      .filter(s => !skipDives.has(s.dive) && DD_TABLE[s.dive])
      .map(s => ({ code: s.dive, height: s.height, name: DD_TABLE[s.dive]?.name, group: getDiveGroup(s.dive) }))
      .filter((d,i,arr) => arr.findIndex(x => x.code === d.code && x.height === d.height) === i)
      .sort((a,b) => getDiveGroup(a.code) - getDiveGroup(b.code));
  }, [diver]);

  // ─── QR Scanner ──────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const streamRef = useRef(null);

  const startScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if(videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Start scanning frames
      scanIntervalRef.current = setInterval(() => {
        if(!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if(video.readyState !== video.HAVE_ENOUGH_DATA) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if(code && code.data.startsWith("PDT|")) {
          // Parse the QR data
          const parts = code.data.split("|");
          if(parts.length >= 4) {
            const qrDiverId = parts[1];
            const qrDate = parts[2];
            const diveStrs = parts[3].split(",");
            const dives = diveStrs.map(s => {
              const [diveCode, height, reps] = s.split(":");
              return { code: diveCode, height, status: "not_attempted" };
            }).filter(d => d.code)
              .sort((a,b) => a.height==="1M"&&b.height==="3M" ? -1 : a.height==="3M"&&b.height==="1M" ? 1 : 0);

            // Pre-populate the practice form
            setNewPractice({ date: qrDate, type: "Pool", dives });
            setShowAddPractice(true);
            setScanResult({ success: true, diver: qrDiverId, date: qrDate, count: dives.length });
            stopScan();
          }
        }
      }, 250);
    } catch(e) {
      console.error("Camera error:", e);
      setScanResult({ success: false, error: "Camera access denied. Check permissions." });
      setScanning(false);
    }
  };

  const stopScan = useCallback(() => {
    if(scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if(streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if(videoRef.current) { videoRef.current.srcObject = null; }
    setScanning(false);
  }, []);

  const renderPracticeLog = () => (
    <div>
      {/* Scan Sheet button */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>setShowAddPractice(!showAddPractice)} style={{
          flex:1,padding:12,borderRadius:12,border:`2px dashed ${theme.cardBorder}`,
          background:showAddPractice?theme.surface:"transparent",color:theme.accent,
          fontWeight:700,fontSize:13,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        }}>
          <Icon type="plus" size={16}/> Log Practice
        </button>
        <button onClick={scanning ? stopScan : startScan} style={{
          padding:"12px 16px",borderRadius:12,border:`2px solid ${scanning?"#ef4444":theme.accent}`,
          background:scanning?"#ef444422":"transparent",
          color:scanning?"#ef4444":theme.accent,
          fontWeight:700,fontSize:13,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        }}>
          📷 {scanning ? "Stop" : "Scan"}
        </button>
      </div>

      {/* Camera view */}
      {scanning && (
        <div style={{...cardStyle,padding:0,overflow:"hidden",position:"relative"}}>
          <video ref={videoRef} style={{width:"100%",height:240,objectFit:"cover",display:"block"}} playsInline muted/>
          <canvas ref={canvasRef} style={{display:"none"}}/>
          <div style={{
            position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
            width:180,height:180,border:"3px solid #fff",borderRadius:12,opacity:0.5,
          }}/>
          <div style={{
            position:"absolute",bottom:8,left:0,right:0,textAlign:"center",
            fontSize:12,color:"#fff",textShadow:"0 1px 4px rgba(0,0,0,0.8)",
          }}>
            Point at the QR code on your practice sheet
          </div>
        </div>
      )}

      {/* Scan result feedback */}
      {scanResult && (
        <div style={{
          ...cardStyle,
          background: scanResult.success ? `${theme.success}15` : `${theme.danger}15`,
          border: `1px solid ${scanResult.success ? theme.success+"44" : theme.danger+"44"}`,
        }}>
          {scanResult.success ? (
            <div style={{fontSize:12,color:theme.success,fontWeight:600}}>
              ✓ Scanned! Loaded {scanResult.count} dives for {scanResult.diver} ({scanResult.date})
              <div style={{fontSize:10,color:theme.textMuted,marginTop:2}}>
                Tap each dive to mark: Practiced / Refused / Not Attempted, then save.
              </div>
            </div>
          ) : (
            <div style={{fontSize:12,color:theme.danger}}>{scanResult.error}</div>
          )}
        </div>
      )}

      {showAddPractice && (
        <div style={{...cardStyle,border:`2px solid ${theme.accent}`}}>
          {/* Date & Type — side by side with explicit widths */}
          <div style={{display:"flex",flexDirection:"row",gap:10,marginBottom:12}}>
            <div style={{width:"55%"}}>
              <label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Date</label>
              <input type="date" value={newPractice.date}
                onChange={e=>setNewPractice(p=>({...p,date:e.target.value}))}
                style={{width:"100%",padding:"10px 6px",borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box",WebkitAppearance:"none"}}
              />
            </div>
            <div style={{width:"40%"}}>
              <label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Type</label>
              <select value={newPractice.type}
                onChange={e=>setNewPractice(p=>({...p,type:e.target.value}))}
                style={{width:"100%",padding:"10px 4px",borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box"}}
              >
                <option value="Pool">Pool</option>
                <option value="Dryland/Trampoline">Dryland</option>
              </select>
            </div>
          </div>

          {/* Quick-add from known dives */}
          <div style={{fontSize:11,fontWeight:700,color:theme.text,marginBottom:6}}>Quick Add (tap to add):</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10,maxHeight:80,overflowY:"auto"}}>
            {quickAddDives.map((d,i) => (
              <button key={i} onClick={()=>{
                setNewPractice(p=>({...p,dives:[...p.dives,{code:d.code,height:d.height,status:"practiced"}]}));
              }} style={{
                padding:"3px 8px",borderRadius:6,border:`1px solid ${GROUP_COLORS[d.group]}44`,
                background:`${GROUP_COLORS[d.group]}15`,color:GROUP_COLORS[d.group],
                fontSize:11,fontWeight:600,cursor:"pointer",
              }}>
                {d.code} {d.height}
              </button>
            ))}
          </div>

          {/* Search / manual entry */}
          <div style={{fontSize:11,fontWeight:700,color:theme.text,marginBottom:6}}>Or search / enter manually:</div>
          <div style={{position:"relative",marginBottom:8}}>
            <div style={{display:"flex",gap:5,alignItems:"end",flexWrap:"wrap"}}>
              <div style={{position:"relative",flex:"1 1 100px",minWidth:80}}>
                <input placeholder="Search dive..." value={diveSearch || newDiveEntry.code}
                  onChange={e=>{
                    const val = e.target.value.toUpperCase();
                    setDiveSearch(val);
                    setNewDiveEntry(p=>({...p,code:val}));
                    setShowDiveDropdown(true);
                  }}
                  onFocus={()=>diveSearch && setShowDiveDropdown(true)}
                  onBlur={()=>setTimeout(()=>setShowDiveDropdown(false),200)}
                  style={{width:"100%",padding:"8px 6px",borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:12,boxSizing:"border-box"}}
                />
                {showDiveDropdown && filteredDiveOptions.length > 0 && (
                  <div style={{
                    position:"absolute",top:"100%",left:0,right:0,zIndex:20,
                    background:theme.card,border:`1px solid ${theme.cardBorder}`,borderRadius:8,
                    maxHeight:180,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,0.4)",
                  }}>
                    {filteredDiveOptions.map((opt,i)=>(
                      <div key={i} onClick={()=>{
                        setNewDiveEntry(p=>({...p,code:opt.code}));
                        setDiveSearch("");
                        setShowDiveDropdown(false);
                      }} style={{
                        padding:"8px 10px",cursor:"pointer",borderBottom:`1px solid ${theme.cardBorder}`,
                        display:"flex",alignItems:"center",gap:6,
                      }}>
                        <span style={{width:6,height:6,borderRadius:"50%",background:GROUP_COLORS[opt.group],flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:700,color:theme.text}}>{opt.code}</span>
                        <span style={{fontSize:10,color:theme.textMuted,flex:1}}>{opt.name}</span>
                        <span style={{fontSize:9,color:theme.accent}}>DD {opt.dd1M}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <select value={newDiveEntry.height}
                onChange={e=>setNewDiveEntry(p=>({...p,height:e.target.value}))}
                style={{flex:"0 0 50px",padding:8,borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:12}}
              >
                <option value="1M">1M</option><option value="3M">3M</option>
              </select>
              <select value={newDiveEntry.status}
                onChange={e=>setNewDiveEntry(p=>({...p,status:e.target.value}))}
                style={{flex:"0 0 90px",padding:8,borderRadius:8,
                  border:`1px solid ${STATUS_CONFIG[newDiveEntry.status]?.color || theme.cardBorder}44`,
                  background:`${STATUS_CONFIG[newDiveEntry.status]?.color || theme.surface}15`,
                  color:STATUS_CONFIG[newDiveEntry.status]?.color || theme.text,fontSize:11,fontWeight:600}}
              >
                <option value="practiced">✓ Practiced</option>
                <option value="refused">✗ Refused</option>
                <option value="not_attempted">— Not Tried</option>
              </select>
              <button onClick={addDiveToPractice} style={{
                flex:"0 0 34px",padding:8,borderRadius:8,border:"none",
                background:theme.accent,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer",
              }}>+</button>
            </div>
          </div>

          {/* Added dives list — grouped by height */}
          {newPractice.dives.length>0 && (
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:theme.textMuted,marginBottom:4}}>
                {newPractice.dives.length} dives · {newPractice.dives.filter(d=>d.status==="practiced").length} practiced · {newPractice.dives.filter(d=>d.status==="refused").length} refused · {newPractice.dives.filter(d=>d.status==="not_attempted").length} not tried
              </div>
              {["1M","3M"].map(h => {
                const heightDives = newPractice.dives.map((d,i)=>({...d,_idx:i})).filter(d=>d.height===h);
                if(!heightDives.length) return null;
                return (
                  <div key={h}>
                    <div style={{fontSize:11,fontWeight:700,color:theme.accent,margin:"8px 0 4px",
                      borderBottom:`1px solid ${theme.cardBorder}`,paddingBottom:2}}>{h} Springboard</div>
                    {heightDives.map((d)=>(
                      <div key={d._idx} style={{
                        display:"flex",justifyContent:"space-between",alignItems:"center",
                        padding:"5px 8px",background:theme.surface,borderRadius:6,marginBottom:3,fontSize:12,
                        borderLeft:`3px solid ${GROUP_COLORS[getDiveGroup(d.code)]}`,
                      }}>
                        <span style={{color:theme.text,fontWeight:600,minWidth:44}}>{d.code}</span>
                        <span style={{color:theme.textMuted,fontSize:10,flex:1,marginLeft:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{DD_TABLE[d.code]?.name||""}</span>
                        <select value={d.status||"not_attempted"} onChange={e=>{
                          setNewPractice(p=>({...p,dives:p.dives.map((dd,j)=>j===d._idx?{...dd,status:e.target.value}:dd)}));
                        }} style={{
                          padding:"2px 4px",borderRadius:6,fontSize:10,fontWeight:600,border:"none",cursor:"pointer",
                          background:`${STATUS_CONFIG[d.status||"not_attempted"].color}20`,
                          color:STATUS_CONFIG[d.status||"not_attempted"].color,
                        }}>
                          <option value="not_attempted">— Not Tried</option>
                          <option value="practiced">✓ Practiced</option>
                          <option value="refused">✗ Refused</option>
                        </select>
                        <button onClick={()=>setNewPractice(p=>({...p,dives:p.dives.filter((_,j)=>j!==d._idx)}))}
                          style={{background:"none",border:"none",color:theme.danger,cursor:"pointer",fontSize:14,padding:"0 2px"}}>×</button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          <button onClick={addPracticeEntry} disabled={newPractice.dives.length===0} style={{
            width:"100%",padding:10,borderRadius:10,border:"none",
            background:newPractice.dives.length>0?theme.accent:theme.surface,
            color:newPractice.dives.length>0?"#fff":theme.textMuted,fontWeight:700,fontSize:13,cursor:"pointer",
          }}>Save Practice Session</button>
        </div>
      )}

      {/* Practice History */}
      {diverPractice.map((session, si)=>{
        const isEditing = editingSession === si;
        return (
        <div key={si} style={{...cardStyle, border: isEditing ? `2px solid ${theme.accent}` : undefined}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:theme.text}}>{session.date}</div>
              <div style={{fontSize:11,color:theme.textMuted}}>{session.type}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:11,color:theme.accent,fontWeight:600}}>
                {session.dives.filter(d=>(d.status||"practiced")==="practiced").length}✓ {session.dives.filter(d=>d.status==="refused").length ? `${session.dives.filter(d=>d.status==="refused").length}✗` : ""} · {session.dives.length}
              </span>
              <button onClick={()=>setEditingSession(isEditing ? null : si)} style={{
                background:"none",border:`1px solid ${isEditing ? theme.accent : theme.cardBorder}`,borderRadius:6,
                color:isEditing ? theme.accent : theme.textMuted,cursor:"pointer",fontSize:11,padding:"2px 8px",
              }}>{isEditing ? "Done" : "Edit"}</button>
              <button onClick={async ()=>{
                if(window.confirm("Delete this practice session?")) {
                  if(FIREBASE_READY && session.id) {
                    try { await deletePracticeSession(activeDiver, session.id); } catch(e) { console.error(e); }
                  }
                  setPracticeLog(prev=>{
                    const idx = prev.indexOf(session);
                    if(idx>=0) return [...prev.slice(0,idx),...prev.slice(idx+1)];
                    return prev.filter(p=>!(p.diverId===activeDiver && p.date===session.date && p.type===session.type));
                  });
                  setEditingSession(null);
                }
              }} style={{
                background:"none",border:`1px solid ${theme.danger}44`,borderRadius:6,
                color:theme.danger,cursor:"pointer",fontSize:11,padding:"2px 6px",
              }}>×</button>
            </div>
          </div>
          {["1M","3M"].map(h => {
            const heightDives = session.dives.map((d,i)=>({...d,_idx:i})).filter(d=>d.height===h);
            if(!heightDives.length) return null;
            return (
              <div key={h}>
                <div style={{fontSize:10,fontWeight:700,color:theme.accent,margin:"6px 0 3px",
                  borderBottom:`1px solid ${theme.cardBorder}`,paddingBottom:2}}>{h} Springboard</div>
                {heightDives.map((d)=>(
                  <div key={d._idx} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"4px 0",borderTop:d._idx>0?`1px solid ${theme.cardBorder}`:"none",
                  }}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:GROUP_COLORS[getDiveGroup(d.code)],display:"inline-block",flexShrink:0}}/>
                      <span style={{fontSize:12,fontWeight:600,color:theme.text}}>{d.code}</span>
                      <span style={{fontSize:9,color:theme.textMuted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{DD_TABLE[d.code]?.name||""}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                      {isEditing ? (
                        <>
                          <select value={d.status||"not_attempted"} onChange={e=>{
                            setPracticeLog(prev=>prev.map(p=>{
                              if(p !== session) return p;
                              const newDives = [...p.dives];
                              newDives[d._idx] = {...newDives[d._idx], status: e.target.value};
                              return {...p, dives: newDives};
                            }));
                          }} style={{
                            padding:"2px 4px",borderRadius:6,fontSize:10,fontWeight:600,border:"none",cursor:"pointer",
                            background:`${STATUS_CONFIG[d.status||"not_attempted"].color}20`,
                            color:STATUS_CONFIG[d.status||"not_attempted"].color,
                          }}>
                            <option value="not_attempted">— Not Tried</option>
                            <option value="practiced">✓ Practiced</option>
                            <option value="refused">✗ Refused</option>
                          </select>
                          <button onClick={()=>{
                            setPracticeLog(prev=>prev.map(p=>{
                              if(p !== session) return p;
                              return {...p, dives: p.dives.filter((_,j)=>j!==d._idx)};
                            }));
                          }} style={{background:"none",border:"none",color:theme.danger,cursor:"pointer",fontSize:13,padding:"0 2px"}}>×</button>
                        </>
                      ) : (
                        <StatusBadge status={d.status||"practiced"}/>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        );
      })}
    </div>
  );

  // ─── RENDER: RECOMMENDATIONS ───────────────────────────────
  const renderRecommendations = () => (
    <div>
      {/* Coach's Working Dive List (Gale) */}
      {diver.coachDiveList && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:8}}>
            📋 Coach Dora's Working Dive List
          </div>
          {["3M","1M"].map(h=>(
            <div key={h} style={cardStyle}>
              <div style={{fontSize:13,fontWeight:700,color:theme.accent,marginBottom:8}}>{h}</div>
              {diver.coachDiveList[h].map((d,i)=>{
                const statusColors = {
                  complete:theme.success, learning:"#f59e0b",
                  working:"#3b82f6", struggling:theme.danger, planned:theme.textMuted,
                };
                const statusLabels = {
                  complete:"✓ Compete-ready", learning:"Learning",
                  working:"Working on it", struggling:"Needs work", planned:"Planned",
                };
                return (
                  <div key={i} style={{
                    display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"6px 0",borderTop:i>0?`1px solid ${theme.cardBorder}`:"none",
                  }}>
                    <div>
                      <span style={{fontSize:13,fontWeight:600,color:theme.text}}>{d.dive} </span>
                      <span style={{fontSize:11,color:theme.textMuted}}>{d.note}</span>
                    </div>
                    <span style={{
                      fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:10,
                      background:`${statusColors[d.status]}22`,color:statusColors[d.status],
                    }}>{statusLabels[d.status]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Recommended Next Dives — grouped by category */}
      <div style={{fontSize:14,fontWeight:700,color:theme.text,marginBottom:8}}>
        <Icon type="star" size={14}/> Recommended Next Dives
      </div>
      {(() => {
        const recs = recommendations.slice(0,6);
        const byGroup = {};
        recs.forEach(r => {
          const g = r.group;
          if(!byGroup[g]) byGroup[g] = [];
          byGroup[g].push(r);
        });
        return Object.entries(byGroup).map(([g, items]) => (
          <div key={g} style={{marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:GROUP_COLORS[g]}}/>
              <span style={{fontSize:11,fontWeight:700,color:GROUP_COLORS[g]}}>{GROUP_NAMES[g]}</span>
            </div>
            {items.map((r,i)=>(
              <div key={i} style={{...cardStyle,borderLeft:`3px solid ${GROUP_COLORS[r.group]}`,padding:"8px 12px",marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <span style={{fontSize:13,fontWeight:700,color:theme.text}}>{r.dive} </span>
                    <span style={{fontSize:10,color:theme.textMuted}}>{r.height}</span>
                    <span style={{fontSize:10,color:theme.accent,fontWeight:600,marginLeft:4}}>DD {r.dd}</span>
                    <div style={{fontSize:10,color:theme.textMuted}}>{r.name}</div>
                  </div>
                  {badge(r.priority==="high"?theme.gold:theme.accent, r.priority==="high"?"Priority":"Suggested")}
                </div>
              </div>
            ))}
          </div>
        ));
      })()}

      {/* Manually added goals */}
      {extraPlanDives.length > 0 && (
        <div style={{...cardStyle,marginTop:8}}>
          <div style={{fontSize:11,fontWeight:700,color:theme.text,marginBottom:4}}>📌 Your Added Goals</div>
          {extraPlanDives.map((d,i) => (
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 0",borderBottom:`1px solid ${theme.cardBorder}`,borderLeft:`3px solid ${GROUP_COLORS[d.group]}`,paddingLeft:8}}>
              <span style={{fontSize:12,fontWeight:700,color:theme.text}}>{d.dive}</span>
              <span style={{fontSize:10,color:theme.textMuted}}>{d.height}</span>
              <span style={{fontSize:9,color:theme.textMuted,flex:1}}>{d.name}</span>
              <span style={{fontSize:9,color:theme.accent}}>DD {d.dd}</span>
              <button onClick={()=>setExtraPlanDives(p=>p.filter((_,j)=>j!==i))}
                style={{background:"none",border:"none",color:theme.danger,cursor:"pointer",fontSize:13}}>×</button>
            </div>
          ))}
        </div>
      )}
      
      {/* Add dive to plan */}
      <div style={{...cardStyle,padding:"8px 12px",marginTop:8}}>
        <div style={{fontSize:10,fontWeight:700,color:theme.textMuted}}>+ Add a dive goal</div>
        <MiniDiveAdder theme={theme} placeholder="Search dive to add as goal..." onAdd={(d) => {
          if(!extraPlanDives.find(x=>x.dive===d.dive && x.height===d.height)) {
            setExtraPlanDives(p=>[...p, d]);
          }
        }}/>
      </div>

      {/* Current Group Coverage (competed dives) */}
      <div style={{...cardStyle,marginTop:12}}>
        <div style={{fontSize:13,fontWeight:700,color:theme.text,marginBottom:4}}>
          Your Group Coverage
        </div>
        <div style={{fontSize:10,color:theme.textMuted,marginBottom:8}}>Dives you've competed, by category</div>
        {[1,2,3,4,5].map(g=>{
          const dives = diver.diveStats.filter(s=>getDiveGroup(s.dive)===g);
          const skipDives = new Set(["001A","001B","002A","100A","100C","200A","200C","300A","300C","5101A","5201A"]);
          const meaningful = dives.filter(d=>!skipDives.has(d.dive));
          return (
            <div key={g} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <span style={{width:10,height:10,borderRadius:"50%",background:GROUP_COLORS[g]}}/>
              <span style={{fontSize:12,fontWeight:600,color:theme.text,width:65}}>{GROUP_NAMES[g]}</span>
              <div style={{flex:1,height:6,background:theme.surface,borderRadius:3}}>
                <div style={{height:"100%",borderRadius:3,background:GROUP_COLORS[g],width:`${Math.min(100,meaningful.length*20)}%`}}/>
              </div>
              <span style={{fontSize:10,color:theme.textMuted}}>{meaningful.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── RENDER: PRINTABLE PRACTICE PLAN ───────────────────────
  const renderPracticePlan = () => {
    // Smart prioritization: categorize dives by what moves the needle
    const buildPracticePlan = (d) => {
      const plan = { "1M": [], "3M": [] };
      
      // ─── Practice pattern analysis (last 5 sessions) ─────────
      const allDiverPractice = practiceLog
        .filter(p => p.diverId === d.id)
        .sort((a,b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      
      const practicePatterns = {}; // key: "CODE-HEIGHT" → {practiced, refused, notAttempted, streak, lastStatus, sessions}
      allDiverPractice.forEach((session, sessionIdx) => {
        session.dives.forEach(dive => {
          const key = `${dive.code}-${dive.height}`;
          if(!practicePatterns[key]) practicePatterns[key] = {practiced:0, refused:0, notAttempted:0, streak:0, lastStatus:null, sessions:0};
          const p = practicePatterns[key];
          p.sessions++;
          if(dive.status === "practiced") p.practiced++;
          else if(dive.status === "refused") p.refused++;
          else p.notAttempted++;
          if(sessionIdx === 0) p.lastStatus = dive.status;
        });
      });
      // Calculate practice streak (consecutive practiced from most recent)
      Object.keys(practicePatterns).forEach(key => {
        const p = practicePatterns[key];
        let streak = 0;
        for(const session of allDiverPractice) {
          const dive = session.dives.find(d => `${d.code}-${d.height}` === key);
          if(dive?.status === "practiced") streak++;
          else break;
        }
        p.streak = streak;
      });
      
      // Helper: get practice-aware tip
      const practiceTip = (key, baseTip) => {
        const p = practicePatterns[key];
        if(!p) return baseTip;
        if(p.lastStatus === "practiced") {
          if(p.streak >= 3) return baseTip + ` · ✓ ${p.streak} sessions in a row!`;
          return baseTip + " · ✓ practiced last session";
        }
        if(p.lastStatus === "refused") return baseTip + " · refused last session — try again";
        if(p.lastStatus === "not_attempted") return baseTip + " · didn't attempt last session";
        return baseTip;
      };
      
      // Helper: auto-promote/demote coach status based on practice patterns
      const adjustedStatus = (coachStatus, key) => {
        const p = practicePatterns[key];
        if(!p || p.sessions < 2) return coachStatus; // not enough data to adjust
        
        // Promotion: struggling → working (if practiced 3+ times in last 5 sessions)
        if(coachStatus === "struggling" && p.practiced >= 3) return "working";
        // Promotion: working → complete (if practiced in 3+ consecutive sessions)
        if(coachStatus === "working" && p.streak >= 3) return "complete";
        // Promotion: learning → working (if practiced 2+ times)
        if(coachStatus === "learning" && p.practiced >= 2 && p.refused === 0) return "working";
        
        // Demotion: complete → working (if refused in most recent session)
        if(coachStatus === "complete" && p.lastStatus === "refused") return "working";
        // Demotion: working → struggling (if refused 2+ times in last 5)
        if(coachStatus === "working" && p.refused >= 2) return "struggling";
        
        return coachStatus;
      };
      
      // If diver has a coach dive list, use it directly (e.g. Gale)
      if(d.coachDiveList) {
        ["1M","3M"].forEach(h => {
          const coachDives = d.coachDiveList[h] || [];
          coachDives.forEach(cd => {
            const dd = DD_TABLE[cd.dive];
            if(!dd) return;
            const ddVal = dd[h] || 0;
            const key = `${cd.dive}-${h}`;
            const p = practicePatterns[key];
            const lastStatus = p?.lastStatus || null;
            const practicedRecently = lastStatus === "practiced";
            const refusedRecently = lastStatus === "refused";
            const notAttemptedRecently = lastStatus === "not_attempted";
            
            // Auto-adjust coach status based on practice patterns
            const effectiveStatus = adjustedStatus(cd.status, key);
            const promoted = effectiveStatus !== cd.status;
            
            let category, tip, priority;
            if(effectiveStatus === "complete") {
              category = "maintain"; priority = 3;
              tip = promoted ? `Promoted from "${cd.status}" — ${p.streak}× practiced in a row!`
                : practicedRecently ? "Compete-ready — warm up reps"
                : refusedRecently ? "Compete-ready but refused last session — rebuild confidence"
                : "Compete-ready — warm up reps";
            } else if(effectiveStatus === "struggling") {
              category = "improve"; priority = 1;
              tip = practicedRecently ? "Practiced last session — keep building!"
                : refusedRecently ? "Refused last session — try again with encouragement"
                : notAttemptedRecently ? "Didn't attempt last session — give it a try"
                : "Needs focused work";
            } else if(effectiveStatus === "working") {
              category = "develop"; priority = 2;
              tip = promoted ? `Promoted from "${cd.status}" — practiced ${p?.practiced}× in last 5 sessions`
                : practicedRecently ? "Practiced last session — build consistency"
                : refusedRecently ? "Refused last session — try again today"
                : notAttemptedRecently ? "Didn't attempt last session — give it a go today"
                : "In progress — build consistency";
            } else if(effectiveStatus === "learning") {
              category = "develop"; priority = 2;
              tip = practicedRecently ? "Practiced last session — good progress!"
                : "Still learning — patient reps";
            } else { // planned
              category = "next"; priority = 3;
              tip = `New dive — introduce when ready (DD ${ddVal})`;
            }
            
            plan[h].push({
              dive: cd.dive, height: h, name: dd.name, dd: ddVal,
              highScore: 0, avgScore: 0, times: 0,
              priority, category, tip,
              suggestedReps: category === "maintain" ? 2 : 3,
              group: getDiveGroup(cd.dive),
              _effectiveStatus: effectiveStatus,
              _promoted: promoted,
            });
          });
        });
        
        Object.keys(plan).forEach(h => {
          plan[h].sort((a,b) => a.priority - b.priority || b.dd - a.dd);
        });
        
        return plan;
      }
      
      // Generic algorithm (e.g. Hayden) — uses competition stats + practice logs
      const skipDives = new Set(["001A","001B","002A","100A","100C","200A","200C","300A","300C","5101A","5201A"]);
      
      d.diveStats.forEach(s => {
        if(skipDives.has(s.dive)) return;
        const dd = DD_TABLE[s.dive];
        if(!dd) return;
        const ddVal = dd[s.height] || 0;
        const gap = s.highScore - s.avgScore;
        const consistency = s.times >= 3 ? gap / Math.max(s.highScore,1) : 1;
        const key = `${s.dive}-${s.height}`;
        
        let priority, category, baseTip;
        
        if(s.times >= 5 && consistency < 0.1 && ddVal < 1.5) {
          return; // Mastered low-DD dive — skip
        } else if(s.times < 3) {
          priority = 2;
          category = "develop";
          baseTip = `Only ${s.times}× in competition — build confidence (DD ${ddVal})`;
        } else if(s.times >= 3 && consistency >= 0.12) {
          priority = 1;
          category = "improve";
          baseTip = `Avg ${s.avgScore.toFixed(1)} vs best ${s.highScore.toFixed(1)} — close the gap`;
        } else if(s.times >= 5 && consistency < 0.12) {
          priority = 3;
          category = "maintain";
          baseTip = "Consistent — keep in rotation";
        } else {
          priority = 2;
          category = "develop";
          baseTip = "Needs consistent practice";
        }
        
        if(ddVal >= 2.0) priority = Math.max(1, priority - 1);
        if(ddVal >= 1.8 && category === "develop") priority = 1;
        
        // Practice-based adjustments (same logic as Gale's path)
        const pp = practicePatterns[key];
        if(pp && pp.sessions >= 2) {
          if(category === "develop" && pp.streak >= 3) { category = "maintain"; priority = 3; baseTip = "Practiced consistently — ready to compete"; }
          else if(category === "improve" && pp.lastStatus === "refused") { priority = 0; baseTip += " — but refused in practice, needs attention"; }
          else if(category === "develop" && pp.practiced >= 3) { baseTip = `Practiced ${pp.practiced}× recently — building confidence`; }
        }
        
        const tip = practiceTip(key, baseTip);
        const suggestedReps = category === "maintain" ? 2 : category === "improve" ? 4 : 3;
        
        plan[s.height].push({
          dive: s.dive, height: s.height, name: dd.name, dd: ddVal,
          highScore: s.highScore, avgScore: s.avgScore, times: s.times,
          priority, category, tip, suggestedReps, group: getDiveGroup(s.dive),
        });
      });
      
      // Add progression dives the diver should be working toward
      const competed = new Set(d.diveStats.map(s => `${s.dive}-${s.height}`));
      const progressions = {
        "101A":["102C","103C"],"101C":["102C","103C"],
        "102C":["103C"],"103C":["104C"],
        "201A":["202C","203C"],"201C":["202C","203C"],
        "202C":["203C"],
        "301C":["302C","303C"],"302C":["303C"],
        "401C":["402C","403C"],"402C":["403C"],
        "5211A":["5221D","5231D"],"5121D":["5131D"],"5221D":["5231D"],
      };
      
      d.diveStats.forEach(s => {
        const nexts = progressions[s.dive] || [];
        nexts.forEach(next => {
          ["1M","3M"].forEach(h => {
            const key = `${next}-${h}`;
            if(!competed.has(key) && DD_TABLE[next]) {
              const ddVal = DD_TABLE[next][h] || 0;
              if(d.diveStats.some(ds => ds.dive === s.dive && ds.height === h && ds.times >= 2)) {
                plan[h].push({
                  dive: next, height: h, name: DD_TABLE[next].name, dd: ddVal,
                  highScore: 0, avgScore: 0, times: 0,
                  priority: ddVal >= 2.0 ? 1 : 2, category: "next",
                  tip: practiceTip(key, `Progression from ${s.dive} — adds DD ${ddVal} to your list`),
                  suggestedReps: 3, group: getDiveGroup(next),
                });
              }
            }
          });
        });
      });
      
      // Sort each height and ensure a balanced mix of categories
      Object.keys(plan).forEach(h => {
        const seen = new Set();
        plan[h] = plan[h].filter(d => {
          if(seen.has(d.dive)) return false;
          seen.add(d.dive); return true;
        });
        plan[h].sort((a,b) => a.priority - b.priority || b.dd - a.dd);
        
        // Ensure at least 1-2 develop/next dives make it through
        const improve = plan[h].filter(d => d.category === "improve");
        const devNext = plan[h].filter(d => d.category === "develop" || d.category === "next");
        const maintain = plan[h].filter(d => d.category === "maintain");
        
        const balanced = [];
        balanced.push(...improve.slice(0, 3));
        balanced.push(...devNext.slice(0, 2));
        balanced.push(...maintain.slice(0, 1));
        // Fill remaining from overflow
        const inPlan = new Set(balanced.map(d => d.dive));
        plan[h].forEach(d => { if(!inPlan.has(d.dive) && balanced.length < 6) balanced.push(d); });
        plan[h] = balanced;
      });
      
      return plan;
    };
    
    const plan = buildPracticePlan(diver);
    const totalDives = plan["1M"].length + plan["3M"].length;
    const totalReps = [...plan["1M"], ...plan["3M"]].reduce((a,d) => a + d.suggestedReps, 0);

    // Filter out hidden dives, add manually added dives
    const extraForPrint = extraPrintDives.map(d => ({
      ...d, category:"develop", tip:"Manually added", suggestedReps:3, priority:2,
    }));
    const printPlan = {
      "1M": [...plan["1M"].filter(d => !hiddenPrintDives.has(`${d.dive}-${d.height}`)), ...extraForPrint.filter(d=>d.height==="1M")],
      "3M": [...plan["3M"].filter(d => !hiddenPrintDives.has(`${d.dive}-${d.height}`)), ...extraForPrint.filter(d=>d.height==="3M")],
    };
    const printTotalDives = printPlan["1M"].length + printPlan["3M"].length;

    // Build QR data string from visible (non-hidden) dives only
    const visiblePlanDives = [...printPlan["1M"], ...printPlan["3M"]];
    const qrData = `PDT|${diver.id}|${new Date().toISOString().slice(0,10)}|${visiblePlanDives.map(d => `${d.dive}:${d.height}:${d.suggestedReps||3}`).join(",")}`;
    
    const handlePrint = async () => {
      // Build QR as data URL
      let qrDataUrl = "";
      try {
        qrDataUrl = await QRCode.toDataURL(qrData, {
          width: 120, margin: 1, color: { dark: '#1a1a1a', light: '#ffffff' }
        });
      } catch(e) { console.error("QR generation failed:", e); }
      
      // Build dive rows HTML
      const catClasses = { improve:"cat-improve", develop:"cat-develop", next:"cat-next", maintain:"cat-maintain" };
      const catLabels = { improve:"IMPROVE", develop:"DEVELOP", next:"NEXT UP", maintain:"MAINTAIN" };
      
      // Get last practice session for status indicators
      const recentSession = diverPractice[0];
      const lastWeekStatus = {};
      if(recentSession) {
        recentSession.dives.forEach(d => {
          lastWeekStatus[`${d.code}-${d.height}`] = d.status;
        });
      }
      
      let divesHtml = "";
      ["1M","3M"].forEach(h => {
        if(!printPlan[h].length) return;
        divesHtml += `<div class="section">${h} Springboard</div>`;
        printPlan[h].forEach(d => {
          const cat = catClasses[d.category] || "cat-develop";
          const label = catLabels[d.category] || "DEVELOP";
          const lwKey = `${d.dive}-${h}`;
          const lwStatus = lastWeekStatus[lwKey];
          const lwBadge = lwStatus === "practiced" ? '<span class="lw lw-p">P</span>'
            : lwStatus === "refused" ? '<span class="lw lw-r">R</span>'
            : lwStatus === "not_attempted" ? '<span class="lw lw-n">N</span>'
            : '<span class="lw lw-none">—</span>';
          divesHtml += `
            <div class="dive-row">
              <div class="dive-code">${d.dive}</div>
              <div class="dive-info">
                <div><span class="dive-name">${d.name}</span><span class="dd-badge">DD ${d.dd}</span>${lwBadge}</div>
                <div class="dive-tip">${d.tip}</div>
              </div>
              <span class="cat-badge ${cat}">${label}</span>
              <div class="status-checks">
                <div class="status-col"><div class="check-box"></div><div class="status-label">P</div></div>
                <div class="status-col"><div class="check-box"></div><div class="status-label">R</div></div>
                <div class="status-col"><div class="check-box"></div><div class="status-label">N</div></div>
              </div>
            </div>`;
        });
      });
      
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Practice Plan - ${diver.name}</title>
        <style>
          *{margin:0;padding:0;box-sizing:border-box}
          body{font-family:'Helvetica Neue',Arial,sans-serif;padding:14px 18px;color:#1a1a1a;font-size:11px}
          h1{font-size:16px;margin-bottom:1px}
          .meta{font-size:10px;color:#666}
          .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
          .qr{width:90px;height:90px}
          .qr-label{font-size:7px;color:#999;text-align:center;margin-top:2px}
          .section{margin:8px 0 3px;font-size:12px;font-weight:700;border-bottom:2px solid #1a1a1a;padding-bottom:1px}
          .dive-row{display:flex;align-items:center;border-bottom:1px solid #ddd;padding:3px 0}
          .dive-code{font-weight:700;width:46px;font-size:11px}
          .dive-info{flex:1}
          .dive-tip{font-size:8px;color:#888;font-style:italic;margin-top:1px}
          .dive-name{font-size:10px;color:#444}
          .dd-badge{font-size:9px;font-weight:700;background:#f0f0f0;padding:1px 4px;border-radius:3px;margin-left:3px}
          .lw{font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;margin-left:4px}
          .lw-p{background:#d1fae5;color:#065f46}
          .lw-r{background:#fee2e2;color:#991b1b}
          .lw-n{background:#e5e7eb;color:#6b7280}
          .lw-none{color:#d1d5db}
          .cat-badge{font-size:8px;font-weight:700;padding:1px 5px;border-radius:8px;text-transform:uppercase;white-space:nowrap}
          .cat-improve{background:#fef3c7;color:#92400e}
          .cat-develop{background:#dbeafe;color:#1e40af}
          .cat-next{background:#ede9fe;color:#5b21b6}
          .cat-maintain{background:#f0fdf4;color:#166534}
          .checks{display:flex;gap:3px;margin-left:auto;padding-left:6px}
          .status-checks{display:flex;gap:6px;margin-left:auto;padding-left:8px}
          .status-col{text-align:center}
          .status-label{font-size:7px;color:#888;margin-top:1px;font-weight:700}
          .check-box{width:16px;height:16px;border:1.5px solid #333;border-radius:2px}
          .footer{margin-top:8px;font-size:7px;color:#aaa;text-align:center}
          .tip{background:#f0f8ff;border:1px solid #d0e8ff;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:#1a5276;text-align:center}
          .tip b{color:#0969da}
          @media print{.no-print{display:none!important}@page{size:letter;margin:0.35in}}
        </style></head><body>
        <div class="tip no-print">
          📱 <b>To print:</b> Tap the <b>Share</b> button (box with arrow) at the bottom of Safari, then tap <b>Print</b>
        </div>
        <div class="header">
          <div>
            <h1>${diver.name} — Practice Plan</h1>
            <div class="meta">Pike Dive Academy · Coach: Dora Fyfe · Date: _______________ · Notes: _______________________________________________</div>
            <div class="meta">${diver.ageGroupLabel} · FINA Age: ${diver.finaAge} · Session: 2h 45min · ${visiblePlanDives.length} dives · Last practice: ${recentSession?.date || "—"}</div>
          </div>
          ${qrDataUrl ? `<div><img src="${qrDataUrl}" class="qr"/><div class="qr-label">Scan to log</div></div>` : ""}
        </div>
        ${divesHtml}
        <div class="footer">Colored badges show last week's status: <span class="lw lw-p">P</span> Practiced <span class="lw lw-r">R</span> Refused <span class="lw lw-n">N</span> Not Attempted · Check P/R/N for today · 🔥 Improve · 📈 Develop · 🆕 Next · ✓ Maintain</div>
        </body></html>`;
      
      // Open as a new page in Safari (works from PWA mode)
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    };

    const catConfig = {
      improve: { label:"IMPROVE", color:"#92400e", bg:"#fef3c7", emoji:"🔥" },
      develop: { label:"DEVELOP", color:"#1e40af", bg:"#dbeafe", emoji:"📈" },
      next:    { label:"NEXT UP", color:"#5b21b6", bg:"#ede9fe", emoji:"🆕" },
      maintain:{ label:"MAINTAIN", color:"#166534", bg:"#f0fdf4", emoji:"✓" },
    };

    const renderDiveRow = (d, i, forPrint) => {
      const cat = catConfig[d.category];
      const boxCount = d.suggestedReps + 1; // +1 bonus slot
      if(forPrint) {
        return (
          <div key={i} className="dive-row">
            <div className="dive-code">{d.dive}</div>
            <div className="dive-info">
              <div><span className="dive-name">{d.name}</span><span className="dd-badge">DD {d.dd}</span></div>
              <div className="dive-tip">{d.tip}</div>
            </div>
            <span className={`cat-badge cat-${d.category}`}>{cat.label}</span>
            <div className="checks">
              {Array.from({length:boxCount},(_,j)=><div key={j} className="check-box"/>)}
            </div>
          </div>
        );
      }
      return (
        <div key={i} style={{
          padding:"8px 0",borderBottom:`1px solid ${theme.cardBorder}`,
          display:"flex",alignItems:"center",gap:8,
        }}>
          <div style={{
            width:6,height:32,borderRadius:3,flexShrink:0,
            background: GROUP_COLORS[getDiveGroup(d.dive)],
          }}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
              <span style={{fontSize:14,fontWeight:700,color:theme.text}}>{d.dive}</span>
              <span style={{fontSize:9,fontWeight:600,padding:"1px 5px",borderRadius:6,
                background:`${GROUP_COLORS[d.group||getDiveGroup(d.dive)]}22`,
                color:GROUP_COLORS[d.group||getDiveGroup(d.dive)],
              }}>{GROUP_NAMES[d.group||getDiveGroup(d.dive)]}</span>
              <span style={{fontSize:10,color:theme.accent,fontWeight:600}}>DD {d.dd}</span>
              <span style={{
                fontSize:9,fontWeight:700,padding:"1px 6px",borderRadius:8,
                background:`${cat.color}18`,color:cat.color,
                letterSpacing:"0.03em",
              }}>{cat.emoji} {cat.label}</span>
            </div>
            <div style={{fontSize:11,color:theme.textMuted,lineHeight:1.3}}>{d.name}</div>
            <div style={{fontSize:10,color:theme.textMuted,fontStyle:"italic",marginTop:1}}>{d.tip}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:14,fontWeight:700,color:theme.accent}}>DD {d.dd}</div>
            {d.highScore > 0 && <div style={{fontSize:9,color:theme.textMuted}}>best {d.highScore}</div>}
          </div>
        </div>
      );
    };

    return (
      <div>
        {/* Session Summary */}
        <div style={{...cardStyle,display:"flex",justifyContent:"space-around",textAlign:"center"}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:theme.accent}}>{printTotalDives}</div>
            <div style={{fontSize:10,color:theme.textMuted}}>Printing</div>
          </div>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:theme.gold}}>{printPlan["1M"].length}</div>
            <div style={{fontSize:10,color:theme.textMuted}}>1M</div>
          </div>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:theme.gold}}>{printPlan["3M"].length}</div>
            <div style={{fontSize:10,color:theme.textMuted}}>3M</div>
          </div>
          {hiddenPrintDives.size > 0 && (
            <div>
              <div style={{fontSize:20,fontWeight:800,color:theme.textMuted}}>{hiddenPrintDives.size}</div>
              <div style={{fontSize:10,color:theme.textMuted}}>Hidden</div>
            </div>
          )}
        </div>

        {hiddenPrintDives.size > 0 && (
          <button onClick={()=>setHiddenPrintDives(new Set())} style={{
            width:"100%",padding:6,borderRadius:8,border:`1px solid ${theme.cardBorder}`,
            background:"transparent",color:theme.textMuted,fontSize:10,cursor:"pointer",marginBottom:8,
          }}>Show all dives</button>
        )}

        {/* In-app preview with hide toggles */}
        <div style={{fontSize:10,color:theme.textMuted,marginBottom:6}}>Tap the eye to hide dives from the printout:</div>
        {["1M","3M"].map(h => {
          if(!plan[h].length) return null;
          return (
            <div key={h} style={cardStyle}>
              <div style={{fontSize:14,fontWeight:700,color:theme.accent,marginBottom:4}}>{h} Springboard</div>
              {plan[h].map((d,i) => {
                const key = `${d.dive}-${d.height}`;
                const isHidden = hiddenPrintDives.has(key);
                return (
                  <div key={i} style={{
                    display:"flex",alignItems:"center",gap:6,
                    padding:"6px 0",borderBottom:`1px solid ${theme.cardBorder}`,
                    opacity: isHidden ? 0.35 : 1,
                  }}>
                    <button onClick={()=>{
                      setHiddenPrintDives(prev => {
                        const next = new Set(prev);
                        if(next.has(key)) next.delete(key); else next.add(key);
                        return next;
                      });
                    }} style={{
                      width:24,height:24,borderRadius:6,border:`1px solid ${theme.cardBorder}`,
                      background:isHidden ? theme.surface : `${theme.accent}15`,
                      color:isHidden ? theme.textMuted : theme.accent,
                      fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                      flexShrink:0,padding:0,
                    }}>
                      {isHidden ? "○" : "👁"}
                    </button>
                    <div style={{
                      width:5,height:28,borderRadius:3,flexShrink:0,
                      background: GROUP_COLORS[d.group||getDiveGroup(d.dive)],
                    }}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:13,fontWeight:700,color:theme.text}}>{d.dive}</span>
                        <span style={{fontSize:9,fontWeight:600,padding:"1px 4px",borderRadius:6,
                          background:`${GROUP_COLORS[d.group||getDiveGroup(d.dive)]}22`,
                          color:GROUP_COLORS[d.group||getDiveGroup(d.dive)],
                        }}>{GROUP_NAMES[d.group||getDiveGroup(d.dive)]}</span>
                        <span style={{fontSize:9,color:theme.accent}}>DD {d.dd}</span>
                      </div>
                      <div style={{fontSize:10,color:theme.textMuted}}>{d.name}</div>
                      <div style={{fontSize:9,color:theme.textMuted,fontStyle:"italic",marginTop:1,opacity:isHidden?0.4:0.8}}>{d.tip}</div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:12,color:isHidden?theme.textMuted:catConfig[d.category]?.color||theme.textMuted}}>
                        {catConfig[d.category]?.emoji}
                      </div>
                      <div style={{fontSize:8,color:theme.textMuted}}>{catConfig[d.category]?.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Manually added dives */}
        {extraPrintDives.length > 0 && (
          <div style={{...cardStyle,padding:"8px 12px"}}>
            <div style={{fontSize:10,fontWeight:700,color:theme.textMuted,marginBottom:4}}>MANUALLY ADDED</div>
            {extraPrintDives.map((d,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",borderBottom:`1px solid ${theme.cardBorder}`}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:GROUP_COLORS[d.group]}}/>
                <span style={{fontSize:12,fontWeight:700,color:theme.text}}>{d.dive}</span>
                <span style={{fontSize:10,color:theme.textMuted}}>{d.height}</span>
                <span style={{fontSize:9,color:theme.textMuted,flex:1}}>{d.name}</span>
                <button onClick={()=>setExtraPrintDives(p=>p.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:theme.danger,cursor:"pointer",fontSize:13}}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Add dive to printout */}
        <div style={{...cardStyle,padding:"8px 12px"}}>
          <div style={{fontSize:10,fontWeight:700,color:theme.textMuted}}>+ Add a dive to this practice sheet</div>
          <MiniDiveAdder theme={theme} placeholder="Search dive to add..." onAdd={(d) => {
            if(!extraPrintDives.find(x=>x.dive===d.dive && x.height===d.height)) {
              setExtraPrintDives(p=>[...p, d]);
            }
          }}/>
        </div>

        {/* Print button */}
        <button onClick={handlePrint} style={{
          width:"100%",padding:12,borderRadius:12,border:"none",
          background:theme.accent,color:"#fff",fontWeight:700,fontSize:14,
          cursor:"pointer",marginTop:8,marginBottom:16,display:"flex",alignItems:"center",
          justifyContent:"center",gap:8,
        }}>
          <Icon type="printer" size={18}/> Print for Coach Dora ({printTotalDives} dives)
        </button>
      </div>
    );
  };

  // ─── RENDER: COMPETITION RESULTS ─────────────────────────────
  const [newMeet, setNewMeet] = useState({
    meet:"", date:new Date().toISOString().slice(0,10), event:"", height:"1M", place:"", score:"",
    dives: [] // individual dive scores
  });
  const [newMeetDive, setNewMeetDive] = useState({code:"",score:""});

  const addMeetResult = () => {
    if(!newMeet.meet || !newMeet.score) return;
    const entry = {
      ...newMeet,
      score: parseFloat(newMeet.score),
      place: newMeet.place ? parseInt(newMeet.place) : null,
      diverId: activeDiver,
    };
    // Add to local meetHistory
    const d = DIVERS[activeDiver];
    d.meetHistory.unshift(entry);
    setShowAddMeet(false);
    setNewMeet({meet:"",date:new Date().toISOString().slice(0,10),event:"",height:"1M",place:"",score:"",dives:[]});
  };

  // ─── RENDER: LIVE SCORING (unofficial) ─────────────────────
  const computeRow = (r, J) => {
    const dd = parseFloat(r.dd);
    const raw = (r.scores||[]).slice(0,J);
    const filled = raw.filter(s=>s!=="" && s!==null && s!==undefined && !isNaN(parseFloat(s))).map(Number);
    if(filled.length < J || isNaN(dd) || dd<=0) return { complete:false, net:null, award:null };
    const sorted = [...filled].sort((a,b)=>a-b);
    const counting = J===5 ? sorted.slice(1,4) : J===7 ? sorted.slice(2,5) : sorted; // J===3 keeps all 3
    const net = counting.reduce((a,b)=>a+b,0);
    return { complete:true, net:+net.toFixed(2), award:+(net*dd).toFixed(2) };
  };

  const renderLiveScoring = () => {
    const sheet = liveSheet;
    const J = sheet.judges;
    const results = sheet.rows.map(r => computeRow(r, J));
    const total = results.reduce((sum,res)=> sum + (res.complete?res.award:0), 0);
    const completeCount = results.filter(r=>r.complete).length;

    const setRow = (i, patch) => setLiveSheet(s => ({...s, rows: s.rows.map((r,idx)=> idx===i ? {...r, ...patch} : r)}));
    const setScore = (i, j, val) => setLiveSheet(s => ({...s, rows: s.rows.map((r,idx)=>{ if(idx!==i) return r; const scores=[...(r.scores||[])]; scores[j]=val; return {...r, scores}; })}));
    const onCode = (i, code) => {
      const up = code.toUpperCase().trim();
      const info = DD_TABLE[up];
      setRow(i, { code:up, dd: info ? String(info[sheet.height] ?? "") : (sheet.rows[i].dd||"") });
    };
    const addRow = () => setLiveSheet(s => ({...s, rows:[...s.rows, blankRow()]}));
    const removeRow = (i) => setLiveSheet(s => ({...s, rows: s.rows.length>1 ? s.rows.filter((_,idx)=>idx!==i) : s.rows}));
    const setHeight = (h) => setLiveSheet(s => ({...s, height:h, rows: s.rows.map(r=>{ const info=DD_TABLE[r.code]; return info ? {...r, dd:String(info[h] ?? r.dd)} : r; })}));
    const setJudges = (n) => setLiveSheet(s => ({...s, judges:n}));

    const saveUnofficial = () => {
      if(completeCount===0) return;
      const entry = {
        id: Date.now(),
        meet: sheet.meetName.trim() || "Unofficial meet",
        event: sheet.event.trim() || diver.ageGroupLabel,
        date: new Date().toISOString().slice(0,10),
        height: sheet.height, judges: J,
        total: +total.toFixed(2),
        dives: sheet.rows.map((r,idx)=>({ code:r.code, dd:r.dd, scores:(r.scores||[]).slice(0,J), net:results[idx].net, award:results[idx].award }))
                         .filter((_,idx)=>results[idx].complete),
      };
      const next = [entry, ...unofficialScores];
      setUnofficialScores(next);
      try { localStorage.setItem(`dt-unofficial-${activeDiver}`, JSON.stringify(next)); } catch(e){}
      setLiveSheet(freshSheet(activeDiver, J, true));
    };
    const deleteUnofficial = (id) => {
      const next = unofficialScores.filter(e=>e.id!==id);
      setUnofficialScores(next);
      try { localStorage.setItem(`dt-unofficial-${activeDiver}`, JSON.stringify(next)); } catch(e){}
    };

    const inp = { padding:"8px 6px", borderRadius:8, border:`1px solid ${theme.cardBorder}`, background:theme.surface, color:theme.text, fontSize:13, boxSizing:"border-box" };
    const segBtn = (active) => ({ flex:1, padding:"7px 0", borderRadius:7, border:`1px solid ${active?theme.accent:theme.cardBorder}`, background:active?theme.accent:theme.surface, color:active?"#fff":theme.textMuted, fontWeight:700, fontSize:12, cursor:"pointer" });

    return (
      <div style={{...cardStyle, border:`1px solid ${theme.accent}55`}}>
        <div onClick={()=>setLiveSheet(s=>({...s, open:!s.open}))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
          <div style={{fontSize:14,fontWeight:800,color:theme.text}}>🧮 Live Scoring <span style={{fontSize:9,fontWeight:700,color:theme.gold,letterSpacing:"0.04em"}}>UNOFFICIAL</span></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {unofficialScores.length>0 && <span style={{fontSize:9,color:theme.textMuted}}>{unofficialScores.length} saved</span>}
            <span style={{fontSize:14,color:theme.textMuted}}>{sheet.open?"▾":"▸"}</span>
          </div>
        </div>

        {sheet.open && (<>
          <div style={{fontSize:10,color:theme.textMuted,margin:"6px 0 10px",lineHeight:1.4}}>Enter each judge's raw score. {J===3?"All 3 count":"Highest & lowest are dropped"}; the middle 3 are summed and multiplied by DD. Not part of official results.</div>

          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <div style={{flex:1.4}}>
              <label style={{fontSize:9,color:theme.textMuted,display:"block",marginBottom:3,fontWeight:600}}>JUDGES</label>
              <div style={{display:"flex",gap:4}}>
                {[3,5,7].map(n=>(<button key={n} onClick={()=>setJudges(n)} style={segBtn(J===n)}>{n}</button>))}
              </div>
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:9,color:theme.textMuted,display:"block",marginBottom:3,fontWeight:600}}>HEIGHT</label>
              <div style={{display:"flex",gap:4}}>
                {["1M","3M"].map(h=>(<button key={h} onClick={()=>setHeight(h)} style={segBtn(sheet.height===h)}>{h}</button>))}
              </div>
            </div>
          </div>

          <input placeholder="Meet name (optional)" value={sheet.meetName} onChange={e=>setLiveSheet(s=>({...s,meetName:e.target.value}))} style={{...inp,width:"100%",marginBottom:6}} />
          <input placeholder="Event (optional)" value={sheet.event} onChange={e=>setLiveSheet(s=>({...s,event:e.target.value}))} style={{...inp,width:"100%",marginBottom:10}} />

          {sheet.rows.map((r,i)=>{
            const res = results[i];
            const info = DD_TABLE[r.code];
            return (
              <div key={i} style={{background:theme.surface,borderRadius:10,padding:10,marginBottom:8,border:`1px solid ${theme.cardBorder}`}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
                  <span style={{fontSize:10,fontWeight:700,color:theme.textMuted,width:14}}>{i+1}</span>
                  <input list="dt-dive-codes" placeholder="Code" value={r.code} onChange={e=>onCode(i,e.target.value)} style={{...inp,width:64,textTransform:"uppercase",background:theme.card,padding:"8px 4px"}} />
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,color:info?theme.text:theme.textMuted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{info?info.name:"unknown code"}</div>
                  </div>
                  <span style={{fontSize:9,color:theme.textMuted}}>DD</span>
                  <input inputMode="decimal" value={r.dd} onChange={e=>setRow(i,{dd:e.target.value})} style={{...inp,width:44,textAlign:"center",background:theme.card,padding:"8px 2px"}} />
                  {sheet.rows.length>1 && <button onClick={()=>removeRow(i)} style={{border:"none",background:"transparent",color:theme.danger,fontSize:15,cursor:"pointer",padding:"0 2px",lineHeight:1}}>✕</button>}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                  {Array.from({length:J}).map((_,j)=>(
                    <input key={j} inputMode="decimal" placeholder={`J${j+1}`} value={(r.scores||[])[j]||""} onChange={e=>setScore(i,j,e.target.value)} style={{...inp,width:42,textAlign:"center",padding:"7px 2px"}} />
                  ))}
                </div>
                <div style={{fontSize:11,color: res.complete?theme.success:theme.textMuted,fontWeight:600}}>
                  {res.complete ? `Net ${res.net} × DD ${parseFloat(r.dd)} = ${res.award.toFixed(2)}` : "Fill all judge scores + DD"}
                </div>
              </div>
            );
          })}

          <button onClick={addRow} style={{width:"100%",padding:9,borderRadius:9,border:`1px dashed ${theme.cardBorder}`,background:"transparent",color:theme.accent,fontWeight:600,fontSize:12,cursor:"pointer",marginBottom:10}}>+ Add Dive</button>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderRadius:10,background:theme.accentGlow,border:`1px solid ${theme.accent}55`,marginBottom:unofficialScores.length>0?12:0}}>
            <div>
              <div style={{fontSize:9,color:theme.textMuted,letterSpacing:"0.04em"}}>RUNNING TOTAL · {completeCount} dive{completeCount===1?"":"s"} · {sheet.height}</div>
              <div style={{fontSize:24,fontWeight:800,color:theme.accent,letterSpacing:"-0.02em"}}>{total.toFixed(2)}</div>
            </div>
            <button onClick={saveUnofficial} disabled={completeCount===0} style={{padding:"10px 14px",borderRadius:9,border:"none",background:completeCount?theme.accent:theme.surface,color:completeCount?"#fff":theme.textMuted,fontWeight:700,fontSize:12,cursor:completeCount?"pointer":"default"}}>Save</button>
          </div>

          {unofficialScores.length>0 && (
            <div>
              <div style={{fontSize:10,fontWeight:700,color:theme.textMuted,marginBottom:6,letterSpacing:"0.04em"}}>SAVED (UNOFFICIAL)</div>
              {unofficialScores.map(e=>(
                <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:8,background:theme.surface,marginBottom:6,border:`1px solid ${theme.cardBorder}`}}>
                  <div style={{minWidth:0,paddingRight:8}}>
                    <div style={{fontSize:12,fontWeight:700,color:theme.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.meet}</div>
                    <div style={{fontSize:9,color:theme.textMuted}}>{e.date} · {e.height} · {e.dives.length} dives · {e.judges} judges</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                    <span style={{fontSize:16,fontWeight:800,color:theme.gold}}>{(e.total||0).toFixed(2)}</span>
                    <button onClick={()=>deleteUnofficial(e.id)} style={{border:"none",background:"transparent",color:theme.danger,fontSize:14,cursor:"pointer"}}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <datalist id="dt-dive-codes">
            {Object.keys(DD_TABLE).map(c=> <option key={c} value={c} />)}
          </datalist>
        </>)}
      </div>
    );
  };

  // ─── RENDER: MEET SCHEDULE (per diver) ─────────────────────
  const renderMeetSchedule = () => {
    const sched = diver.meetSchedule;
    if(!sched || !sched.events || !sched.events.length) return null;
    const fmt = (iso) => { const [y,m,dd]=iso.split("-").map(Number); return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]+" "+dd; };
    return (
      <div style={cardStyle}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{fontSize:14,fontWeight:800,color:theme.text}}>📅 {sched.meet}</div>
          <span style={{fontSize:9,fontWeight:600,padding:"2px 8px",borderRadius:8,background:`${theme.gold}22`,color:theme.gold}}>{sched.dates}</span>
        </div>
        <div style={{fontSize:10,color:theme.textMuted,marginBottom:10}}>{sched.location} · {diver.name.split(" ")[0]}'s events</div>
        {sched.events.map((ev,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,background:theme.surface,marginBottom:6,border:`1px solid ${theme.cardBorder}`}}>
            <div style={{textAlign:"center",minWidth:42}}>
              <div style={{fontSize:9,color:theme.textMuted,fontWeight:700,textTransform:"uppercase"}}>{ev.day}</div>
              <div style={{fontSize:13,fontWeight:800,color:theme.accent}}>{fmt(ev.date)}</div>
            </div>
            <div style={{width:1,alignSelf:"stretch",background:theme.cardBorder}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:theme.text}}>{ev.event}</div>
              <div style={{fontSize:9,color:theme.textMuted,marginTop:1}}>{ev.note}</div>
            </div>
            <span style={{fontSize:11,fontWeight:800,color:theme.accent,padding:"3px 9px",borderRadius:7,background:theme.accentGlow}}>{ev.height}</span>
          </div>
        ))}
        <div style={{fontSize:8,color:theme.textMuted,marginTop:2,opacity:0.7}}>Days from official AAU schedule · times not published (prelims morning, finals afternoon/evening)</div>
      </div>
    );
  };

  const renderCompetition = () => {
    const d = diver;
    const nextMeet = UPCOMING_MEETS.find(m => !m.goal) || UPCOMING_MEETS[0];

    return (
      <div>
        {renderLiveScoring()}
        {renderMeetSchedule()}
        {/* ─── Competition Dive List Builder (TOP) ──────────── */}
        <div style={cardStyle}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontSize:14,fontWeight:800,color:theme.text}}>
              🏆 Dive List Builder
            </div>
            {nextMeet && (
              <span style={{fontSize:9,fontWeight:600,padding:"2px 8px",borderRadius:8,
                background:`${theme.gold}22`,color:theme.gold,
              }}>Next: {nextMeet.name.replace("2026 ","")}</span>
            )}
          </div>
          
          <select value={meetRuleKey} onChange={e=>{
            const key = e.target.value;
            setMeetRuleKey(key);
            if(key === "custom") {
              setShowCustomRules(true);
              setMeetHeight(meetHeight); // keep current height
            } else if(EVENT_RULES[key]) {
              setMeetRules({...EVENT_RULES[key]});
              setMeetHeight(key.split("-")[1]);
              setShowCustomRules(false);
            }
          }} style={{
            width:"100%",padding:10,borderRadius:8,border:`1px solid ${theme.cardBorder}`,
            background:theme.surface,color:theme.text,fontSize:12,boxSizing:"border-box",marginBottom:4,
          }}>
            {Object.entries(EVENT_RULES).map(([k,v])=>(
              <option key={k} value={k}>{v.label}</option>
            ))}
            <option value="custom">✏️ Custom Rules</option>
          </select>
          
          {/* Custom rules editor */}
          {showCustomRules && (
            <div style={{padding:10,background:theme.surface,borderRadius:8,marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:700,color:theme.text,marginBottom:6}}>Custom Event Rules</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {[
                  {label:"Vols",key:"vols",step:"1",w:"30%"},
                  {label:"Opts",key:"opts",step:"1",w:"30%"},
                  {label:"Vol Groups",key:"volGroups",step:"1",w:"30%"},
                  {label:"Max Vol DD",key:"maxVolDD",step:"0.1",w:"30%"},
                  {label:"Max Opt DD",key:"maxOptDD",step:"0.1",w:"30%"},
                  {label:"Opt Groups",key:"optGroups",step:"1",w:"30%"},
                ].map(f=>(
                  <div key={f.key} style={{width:f.w}}>
                    <label style={{fontSize:8,color:theme.textMuted,display:"block",marginBottom:2}}>{f.label}</label>
                    <input type="number" step={f.step} value={meetRules[f.key]>=99?"":meetRules[f.key]}
                      placeholder={f.key==="maxOptDD"?"No limit":""}
                      onChange={e=>{
                        const val = f.step==="0.1" ? (parseFloat(e.target.value)||99) : (parseInt(e.target.value)||0);
                        setMeetRules(p=>({...p,[f.key]:val}));
                      }}
                      style={{width:"100%",padding:6,borderRadius:6,border:`1px solid ${theme.cardBorder}`,background:theme.card,color:theme.text,fontSize:11,boxSizing:"border-box"}}
                    />
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:6,marginTop:6}}>
                <label style={{fontSize:8,color:theme.textMuted,marginTop:4}}>Height:</label>
                <select value={meetHeight} onChange={e=>setMeetHeight(e.target.value)}
                  style={{padding:4,borderRadius:6,border:`1px solid ${theme.cardBorder}`,background:theme.card,color:theme.text,fontSize:11}}>
                  <option value="1M">1M</option><option value="3M">3M</option>
                </select>
              </div>
            </div>
          )}
          
          {!showCustomRules && (
            <div style={{fontSize:9,color:theme.textMuted,marginBottom:8}}>
              {meetRules.vols}V + {meetRules.opts}O · Max Vol DD: {meetRules.maxVolDD}
              {meetRules.maxOptDD < 99 ? ` · Max Opt DD: ${meetRules.maxOptDD}` : ""}
              · {meetRules.volGroups} vol grps
              {meetRules.volList ? ` · Vols: ${meetRules.volList.join(",")}` : " · Any dive as vol"}
            </div>
          )}

          {(() => {
            const h = meetHeight;
            const available = d.diveStats
              .filter(s => s.height === h && DD_TABLE[s.dive])
              .filter(s => !removedCompDives.has(s.dive))
              .map(s => ({ ...s, dd: DD_TABLE[s.dive][h] || 0, name: DD_TABLE[s.dive].name, group: getDiveGroup(s.dive) }))
              .sort((a,b) => b.avgScore - a.avgScore);

            // Calculate avg execution for estimating uncompeted dives
            const execScores = available.filter(s=>s.times>=1).map(s => s.avgScore / Math.max(s.dd, 1));
            const avgExec = execScores.length ? execScores.reduce((a,b)=>a+b,0)/execScores.length : 12;
            const bestExec = execScores.length ? Math.max(...execScores) : 15;

            // Practice-ready: practiced 3+ times in last 5 sessions but never competed
            const competedCodes = new Set(d.diveStats.filter(s=>s.height===h).map(s=>s.dive));
            const recentSessions = practiceLog.filter(p=>p.diverId===d.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
            const practiceCounts = {};
            recentSessions.forEach(session => {
              session.dives.forEach(dive => {
                if(dive.height !== h || dive.status !== "practiced") return;
                practiceCounts[dive.code] = (practiceCounts[dive.code] || 0) + 1;
              });
            });
            const practiceReady = Object.entries(practiceCounts)
              .filter(([code, count]) => count >= 3 && !competedCodes.has(code) && DD_TABLE[code] && !removedCompDives.has(code))
              .map(([code, count]) => ({
                dive: code, height: h, dd: DD_TABLE[code][h] || 0, name: DD_TABLE[code].name,
                group: getDiveGroup(code), times: 0, _practiced: true, _practiceCount: count,
                avgScore: avgExec * (DD_TABLE[code][h] || 1),
                highScore: bestExec * (DD_TABLE[code][h] || 1),
              }));

            // Manually added dives
            const manualDives = compDiveOverrides
              .filter(od => od.height === h && !available.find(a => a.dive === od.dive))
              .map(od => ({ dive:od.dive, height:h, dd:od.dd, name:od.name, group:od.group, highScore:bestExec*od.dd, avgScore:avgExec*od.dd, times:0, _manual:true }));
            const allAvailable = [...available, ...practiceReady, ...manualDives];

            if(!allAvailable.length && !compDiveOverrides.length) return <div style={{fontSize:11,color:theme.textMuted,padding:"12px 0"}}>No competed dives on {h} yet.</div>;

            const volList = meetRules.volList;
            const volCandidates = volList ? allAvailable.filter(d => volList.includes(d.dive)) : allAvailable;
            const volDives = [], usedGroups = new Set(), usedDives = new Set();
            let volDDTotal = 0;
            for(const dive of volCandidates) { if(volDives.length >= meetRules.vols) break; if(usedGroups.has(dive.group) && usedGroups.size < meetRules.volGroups) continue; if(volDDTotal + dive.dd > meetRules.maxVolDD) continue; volDives.push({...dive, role:"vol"}); usedGroups.add(dive.group); usedDives.add(dive.dive); volDDTotal += dive.dd; }
            for(const dive of volCandidates) { if(volDives.length >= meetRules.vols) break; if(usedDives.has(dive.dive)) continue; if(volDDTotal + dive.dd > meetRules.maxVolDD) continue; volDives.push({...dive, role:"vol"}); usedDives.add(dive.dive); volDDTotal += dive.dd; }
            const optDives = [], optGrps = new Set();
            const optPool = allAvailable.filter(d => !usedDives.has(d.dive)).filter(d => !meetRules.maxOptDD || meetRules.maxOptDD >= 99 || d.dd <= meetRules.maxOptDD).sort((a,b) => b.avgScore - a.avgScore);
            for(const dive of optPool) { if(optDives.length >= meetRules.opts) break; if(optGrps.has(dive.group) && optGrps.size < (meetRules.optGroups||1)) continue; optDives.push({...dive, role:"opt"}); optGrps.add(dive.group); }
            for(const dive of optPool) { if(optDives.length >= meetRules.opts) break; if(optDives.find(d=>d.dive===dive.dive)) continue; optDives.push({...dive, role:"opt"}); }
            
            const allDives = [...volDives, ...optDives];
            const projectedTotal = allDives.reduce((s, d) => s + d.avgScore, 0);
            const bestCaseTotal = allDives.reduce((s, d) => s + d.highScore, 0);
            const totalDD = allDives.reduce((s, d) => s + d.dd, 0);
            const needed = meetRules.vols + meetRules.opts;
            const short = needed - allDives.length;

            return (
              <div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,padding:"6px 0",borderBottom:`1px solid ${theme.cardBorder}`}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:700,color:theme.text}}>Projected: {projectedTotal.toFixed(1)}</div>
                    <div style={{fontSize:11,fontWeight:700,color:theme.gold}}>Best case: {bestCaseTotal.toFixed(1)}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:10,color:theme.textMuted}}>Total DD: {totalDD.toFixed(1)}</div>
                    <div style={{fontSize:10,color:theme.textMuted}}>{allDives.length}/{needed} dives ({volDives.length}V + {optDives.length}O)</div>
                  </div>
                </div>
                {short > 0 && (
                  <div style={{fontSize:10,color:theme.danger,marginBottom:6,padding:6,background:`${theme.danger}10`,borderRadius:6}}>
                    ⚠️ Need {short} more dive{short>1?"s":""} to fill list. Compete new dives to unlock more options.
                  </div>
                )}
                {allDives.map((dive, i) => (
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:6, padding:"5px 0",borderBottom:`1px solid ${theme.cardBorder}`, borderLeft:`3px solid ${GROUP_COLORS[dive.group]}`,paddingLeft:8 }}>
                    <span style={{fontSize:12,fontWeight:700,color:theme.text,width:44}}>{dive.dive}</span>
                    <span style={{ fontSize:8,fontWeight:700,padding:"1px 5px",borderRadius:6, background:dive.role==="vol"?`${theme.accent}22`:`${theme.gold}22`, color:dive.role==="vol"?theme.accent:theme.gold }}>{dive.role==="vol"?"VOL":"OPT"}</span>
                    <span style={{flex:1,fontSize:10,color:theme.textMuted}}>{dive.name}</span>
                    {dive._practiced && <span style={{fontSize:7,fontWeight:700,padding:"1px 4px",borderRadius:4,background:`${theme.success}22`,color:theme.success}}>PRACTICE {dive._practiceCount}×</span>}
                    {dive._manual && <span style={{fontSize:7,fontWeight:700,padding:"1px 4px",borderRadius:4,background:`${theme.textMuted}22`,color:theme.textMuted}}>MANUAL</span>}
                    <span style={{fontSize:9,color:theme.accent}}>DD {dive.dd}</span>
                    <span style={{fontSize:11,fontWeight:700,color:(dive._manual||dive._practiced)?theme.textMuted:theme.text}}>
                      {(dive._manual||dive._practiced)?"~"+dive.avgScore.toFixed(0):dive.avgScore.toFixed(1)}
                    </span>
                    <button onClick={()=>{
                      if(dive._manual) {
                        setCompDiveOverrides(p=>p.filter(o=>!(o.dive===dive.dive && o.height===h)));
                      } else {
                        setRemovedCompDives(p=>{const n=new Set(p);n.add(dive.dive);return n;});
                      }
                    }} style={{background:"none",border:"none",color:theme.danger,cursor:"pointer",fontSize:13,padding:"0 2px"}}>×</button>
                  </div>
                ))}

                {/* Removed dives (tap to restore) */}
                {[...removedCompDives].filter(code => d.diveStats.some(s=>s.dive===code && s.height===h)).length > 0 && (
                  <div style={{marginTop:4}}>
                    <div style={{fontSize:9,color:theme.textMuted,marginBottom:2}}>Removed (tap to restore):</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {[...removedCompDives].filter(code => d.diveStats.some(s=>s.dive===code && s.height===h)).map(code => (
                        <button key={code} onClick={()=>setRemovedCompDives(p=>{const n=new Set(p);n.delete(code);return n;})}
                          style={{padding:"2px 8px",borderRadius:6,border:`1px dashed ${theme.cardBorder}`,
                            background:"transparent",color:theme.textMuted,fontSize:10,cursor:"pointer"}}>
                          {code} ↩
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add dive to competition list */}
                <div style={{marginTop:6}}>
                  <div style={{fontSize:9,color:theme.textMuted}}>+ Add a dive to see how it changes projections</div>
                  <MiniDiveAdder theme={theme} placeholder="Search dive to add..." onAdd={(newDive) => {
                    if(!compDiveOverrides.find(x=>x.dive===newDive.dive && x.height===newDive.height)) {
                      setCompDiveOverrides(p=>[...p, newDive]);
                      setRemovedCompDives(p=>{const n=new Set(p);n.delete(newDive.dive);return n;});
                    }
                  }}/>
                </div>

                {/* ─── Upgrade Paths ────────────────────────── */}
                {(() => {
                  // Calculate diver's avg execution score (score per DD point)
                  const compDives = d.diveStats.filter(s => s.height === h && s.times >= 1);
                  const execScores = compDives.map(s => {
                    const dd = DD_TABLE[s.dive]?.[h] || 1;
                    return s.avgScore / dd;
                  });
                  const avgExec = execScores.length ? execScores.reduce((a,b)=>a+b,0)/execScores.length : 12;
                  const bestExec = execScores.length ? Math.max(...execScores) : 15;

                  const progressions = {
                    "101A":["102C","103C"],"101C":["102C","103C"],
                    "102C":["103C","104C"],"103C":["104C","105C"],
                    "201A":["202C","203C"],"201C":["202C","203C"],
                    "202C":["203C"],"203C":["204C"],
                    "301C":["302C","303C"],"302C":["303C"],
                    "401C":["402C","403C"],"402C":["403C"],
                    "5121B":["5131D","5132D"],"5121D":["5131D"],
                    "5211A":["5221D","5231D"],"5221D":["5231D"],
                  };

                  const upgrades = [];
                  const usedInList = new Set(allDives.map(d=>d.dive));

                  allDives.forEach(current => {
                    const nexts = progressions[current.dive] || [];
                    nexts.forEach(nextCode => {
                      if(usedInList.has(nextCode)) return;
                      const nextDD = DD_TABLE[nextCode]?.[h];
                      if(!nextDD) return;
                      const ddGain = nextDD - current.dd;
                      const estAvg = avgExec * nextDD;
                      const estBest = bestExec * nextDD;
                      const projGain = estAvg - current.avgScore;
                      const bestGain = estBest - current.highScore;
                      const newProjected = projectedTotal + projGain;
                      const newBest = bestCaseTotal + bestGain;
                      upgrades.push({
                        from: current.dive, fromDD: current.dd, fromAvg: current.avgScore,
                        to: nextCode, toDD: nextDD, toName: DD_TABLE[nextCode].name,
                        ddGain, projGain, bestGain, newProjected, newBest,
                        estAvg, estBest,
                        group: getDiveGroup(nextCode),
                      });
                    });
                  });

                  // Sort by projected gain descending
                  upgrades.sort((a,b) => b.projGain - a.projGain);

                  if(!upgrades.length) return null;
                  const qualScore = d.qualifying?.[h]?.score || 0;

                  return (
                    <div style={{marginTop:10,padding:"8px 0",borderTop:`1px solid ${theme.cardBorder}`}}>
                      <div style={{fontSize:11,fontWeight:700,color:theme.text,marginBottom:6}}>
                        📈 Upgrade Paths — <span style={{fontWeight:400,color:theme.textMuted}}>what if you level up a dive?</span>
                      </div>
                      <div style={{fontSize:8,color:theme.textMuted,marginBottom:6}}>
                        Estimates based on your avg execution ({avgExec.toFixed(1)} pts/DD)
                      </div>
                      {upgrades.slice(0,5).map((u,i) => {
                        const hitsQual = qualScore > 0 && u.newBest >= qualScore && bestCaseTotal < qualScore;
                        return (
                          <div key={i} style={{
                            padding:"6px 8px",marginBottom:4,borderRadius:8,
                            background: hitsQual ? `${theme.success}10` : theme.surface,
                            border:`1px solid ${hitsQual ? theme.success+"44" : theme.cardBorder}`,
                          }}>
                            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}>
                              <span style={{width:5,height:5,borderRadius:"50%",background:GROUP_COLORS[u.group]}}/>
                              <span style={{fontSize:11,color:theme.textMuted}}>{u.from}</span>
                              <span style={{fontSize:11,color:theme.textMuted}}>→</span>
                              <span style={{fontSize:12,fontWeight:700,color:theme.text}}>{u.to}</span>
                              <span style={{fontSize:9,color:theme.textMuted}}>{u.toName}</span>
                            </div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <div style={{fontSize:9,color:theme.textMuted}}>
                                DD {u.fromDD} → <span style={{color:theme.accent,fontWeight:600}}>{u.toDD}</span> (+{u.ddGain.toFixed(1)})
                              </div>
                              <div style={{display:"flex",gap:8}}>
                                <span style={{fontSize:10,color:u.projGain>0?theme.success:theme.danger,fontWeight:600}}>
                                  Proj: {u.projGain>0?"+":""}{u.projGain.toFixed(1)} → {u.newProjected.toFixed(1)}
                                </span>
                                <span style={{fontSize:10,color:u.bestGain>0?theme.gold:theme.textMuted,fontWeight:600}}>
                                  Best: {u.bestGain>0?"+":""}{u.bestGain.toFixed(1)} → {u.newBest.toFixed(1)}
                                </span>
                              </div>
                            </div>
                            {hitsQual && (
                              <div style={{fontSize:9,fontWeight:700,color:theme.success,marginTop:2}}>
                                🎯 This upgrade could unlock qualifying!
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {d.qualifying?.[h]?.score && (
                  <div style={{marginTop:8,padding:8,borderRadius:8, background:bestCaseTotal>=d.qualifying[h].score?`${theme.success}15`:`${theme.danger}10`}}>
                    <div style={{fontSize:11,fontWeight:600, color:bestCaseTotal>=d.qualifying[h].score?theme.success:theme.danger}}>
                      {bestCaseTotal>=d.qualifying[h].score 
                        ? `✓ Best case ${bestCaseTotal.toFixed(1)} can qualify (need ${d.qualifying[h].score})`
                        : `Best case ${bestCaseTotal.toFixed(1)} still ${(d.qualifying[h].score - bestCaseTotal).toFixed(1)} short of ${d.qualifying[h].score}. Higher DD dives needed.`}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ─── Results by Height ──────────────────────────── */}
        {["1M","3M"].map(h => {
          const meets = d.meetHistory.filter(m=>m.height===h);
          if(!meets.length) return null;
          const best = Math.max(...meets.map(m=>m.score));
          const target = d.qualifying?.[h]?.score;
          return (
            <div key={h} style={cardStyle}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:14,fontWeight:700,color:theme.accent}}>{h} Results</div>
                <div style={{textAlign:"right"}}>
                  <span style={{fontSize:12,fontWeight:700,color:theme.gold}}>Best: {best.toFixed(2)}</span>
                  {target && <span style={{fontSize:10,color:best>=target?theme.success:theme.textMuted,marginLeft:6}}>{best>=target?"✓ Qualified":`Need ${target}`}</span>}
                </div>
              </div>
              {meets.map((m,i)=>(
                <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center", padding:"7px 0",borderTop:i>0?`1px solid ${theme.cardBorder}`:"none" }}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                      <span style={{fontSize:12,fontWeight:600,color:theme.text}}>{m.meet}</span>
                      {m.round && m.round !== "single" && (
                        <span style={{fontSize:8,fontWeight:700,padding:"1px 4px",borderRadius:4,
                          background: m.round==="final"?`${theme.gold}22`:`${theme.accent}22`,
                          color: m.round==="final"?theme.gold:theme.accent,
                        }}>{m.round.toUpperCase()}</span>
                      )}
                      {m.source === "divelive" && (
                        <span style={{fontSize:7,fontWeight:700,padding:"1px 4px",borderRadius:4,
                          background:`${theme.textMuted}22`,color:theme.textMuted}}>DIVELIVE</span>
                      )}
                    </div>
                    <div style={{fontSize:10,color:theme.textMuted}}>{m.event} · {m.date}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:15,fontWeight:700,color:m.score===best?theme.gold:theme.text}}>{m.score.toFixed?m.score.toFixed(2):m.score}</div>
                    {typeof m.place==="number" && <span style={{fontSize:10,fontWeight:600,padding:"1px 6px",borderRadius:8, background:m.place<=3?`${theme.gold}22`:`${theme.textMuted}18`, color:m.place<=3?theme.gold:theme.textMuted}}>#{m.place}</span>}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* ─── Data Sources (BOTTOM) ──────────────────────── */}
        <div style={cardStyle}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:theme.text}}>📊 DiveMeets #{d.diveMeetsNum}</div>
              <div style={{fontSize:9,color:theme.textMuted}}>{syncStatus.startsWith("synced:")?"Last synced: just now":"Tap Sync to pull latest results"}</div>
            </div>
            <button onClick={async ()=>{
              setSyncStatus("syncing");
              try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://secure.meetcontrol.com/divemeets/system/profile.php?number=${d.diveMeetsNum}`)}`;
                const resp = await fetch(proxyUrl);
                if(!resp.ok) throw new Error("Fetch failed");
                const html = await resp.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, "text/html");
                const rows = doc.querySelectorAll("table tr");
                let newMeets = [], currentMeet = "";
                rows.forEach(row => {
                  const cells = row.querySelectorAll("td");
                  if(cells.length === 1 && cells[0].querySelector("b")) currentMeet = cells[0].textContent.trim();
                  if(cells.length === 3 && currentMeet) {
                    const event = cells[0]?.textContent?.trim(), place = cells[1]?.textContent?.trim();
                    const score = parseFloat(cells[2]?.querySelector("a")?.textContent?.trim());
                    if(event && !isNaN(score)) newMeets.push({ meet:currentMeet, event, height:event.toLowerCase().includes("3m")?"3M":"1M", place:parseInt(place)||place, score });
                  }
                });
                const existing = new Set(d.meetHistory.map(m => `${m.meet}|${m.event}|${m.score}`));
                let added = 0;
                newMeets.forEach(m => { if(!existing.has(`${m.meet}|${m.event}|${m.score}`)) { d.meetHistory.unshift(m); added++; } });
                setSyncStatus(`synced:${added}`);
              } catch(e) { setSyncStatus("error"); }
            }} disabled={syncStatus==="syncing"} style={{
              padding:"6px 14px",borderRadius:8,border:`1px solid ${theme.accent}44`,
              background:`${theme.accent}15`,color:theme.accent,fontSize:11,fontWeight:700,cursor:"pointer",
              opacity:syncStatus==="syncing"?0.5:1,
            }}>
              {syncStatus==="syncing" ? "Syncing..." : "🔄 Sync"}
            </button>
          </div>
          {syncStatus.startsWith("synced:") && <div style={{fontSize:10,color:theme.success,marginBottom:6}}>✓ {syncStatus.split(":")[1]==="0"?"Up to date":`${syncStatus.split(":")[1]} new result(s)`}</div>}
          {syncStatus==="error" && <div style={{fontSize:10,color:theme.danger,marginBottom:6}}>Sync failed — add manually below.</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowAddMeet(!showAddMeet)} style={{ flex:1,padding:8,borderRadius:8,border:`1px solid ${theme.cardBorder}`, background:showAddMeet?theme.surface:"transparent",color:theme.accent, fontWeight:600,fontSize:11,cursor:"pointer" }}>
              {showAddMeet ? "Cancel" : "+ Add Manually"}
            </button>
            <a href={`https://secure.meetcontrol.com/divemeets/system/profile.php?number=${d.diveMeetsNum}`} target="_blank" rel="noopener noreferrer" style={{ padding:8,borderRadius:8,border:`1px solid ${theme.cardBorder}`, background:"transparent",color:theme.accent,fontWeight:600,fontSize:11, textDecoration:"none",textAlign:"center" }}>View Profile ↗</a>
          </div>
        </div>
        {showAddMeet && (
          <div style={{...cardStyle,border:`2px solid ${theme.accent}`}}>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Meet Name</label>
            </div>
            <div style={{display:"flex",flexDirection:"row",gap:10,marginBottom:10}}>
              <div style={{width:"55%"}}><label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Date</label><input type="date" value={newMeet.date} onChange={e=>setNewMeet(p=>({...p,date:e.target.value}))} style={{width:"100%",padding:"10px 6px",borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box",WebkitAppearance:"none"}} /></div>
              <div style={{width:"40%"}}><label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Height</label><select value={newMeet.height} onChange={e=>setNewMeet(p=>({...p,height:e.target.value}))} style={{width:"100%",padding:"10px 4px",borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box"}}><option value="1M">1M</option><option value="3M">3M</option></select></div>
            </div>
            <div style={{marginBottom:10}}><label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Event</label><input placeholder={`e.g. ${d.ageGroupLabel}`} value={newMeet.event} onChange={e=>setNewMeet(p=>({...p,event:e.target.value}))} style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box"}} /></div>
            <div style={{display:"flex",flexDirection:"row",gap:10,marginBottom:12}}>
              <div style={{width:"60%"}}><label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Total Score</label><input type="number" step="0.05" placeholder="182.10" value={newMeet.score} onChange={e=>setNewMeet(p=>({...p,score:e.target.value}))} style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box"}} /></div>
              <div style={{width:"35%"}}><label style={{fontSize:10,color:theme.textMuted,display:"block",marginBottom:4,fontWeight:600}}>Place</label><input type="number" min={1} placeholder="#" value={newMeet.place} onChange={e=>setNewMeet(p=>({...p,place:e.target.value}))} style={{width:"100%",padding:10,borderRadius:8,border:`1px solid ${theme.cardBorder}`,background:theme.surface,color:theme.text,fontSize:13,boxSizing:"border-box"}} /></div>
            </div>
            <button onClick={addMeetResult} disabled={!newMeet.meet||!newMeet.score} style={{ width:"100%",padding:10,borderRadius:10,border:"none", background:(newMeet.meet&&newMeet.score)?theme.accent:theme.surface, color:(newMeet.meet&&newMeet.score)?"#fff":theme.textMuted,fontWeight:700,fontSize:13,cursor:"pointer" }}>Save Result</button>
          </div>
        )}
      </div>
    );
  };

  // ─── MAIN LAYOUT ───────────────────────────────────────────
  return (
    <div style={{
      maxWidth:420, margin:"0 auto", minHeight:"100vh",
      background: theme.bg, color: theme.text,
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      paddingBottom: 90,
    }}>
      {/* Header */}
      <div style={{
        padding:"16px 16px 12px",
        paddingTop: "max(16px, env(safe-area-inset-top, 16px))",
        background: `linear-gradient(180deg, ${theme.card} 0%, ${theme.bg} 100%)`,
        borderBottom: `1px solid ${theme.cardBorder}`,
        position:"sticky", top:0, zIndex:10,
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22}}>🤿</span>
            <div>
              <div style={{fontSize:16,fontWeight:800,letterSpacing:"-0.02em",
                background:`linear-gradient(135deg, ${theme.accent}, #a78bfa)`,
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
              }}>Dive Tracker</div>
              <div style={{fontSize:10,color:theme.textMuted,letterSpacing:"0.05em"}}>PIKE DIVE ACADEMY</div>
              <div style={{fontSize:8,color:theme.textMuted,opacity:0.7,marginTop:1}}>{APP_VERSION} · {APP_UPDATED}</div>
            </div>
          </div>
          <div style={{fontSize:10,color:theme.textMuted,textAlign:"right"}}>
            <select value={activeDiver} onChange={e=>setActiveDiver(e.target.value)} style={{
              background:theme.surface,color:theme.text,border:`1px solid ${theme.cardBorder}`,
              borderRadius:8,fontSize:12,fontWeight:700,padding:"3px 20px 3px 8px",cursor:"pointer",
              appearance:"none",WebkitAppearance:"none",textAlign:"right",marginBottom:2,
              backgroundImage:`url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='3'><path d='M6 9l6 6 6-6'/></svg>")`,
              backgroundRepeat:"no-repeat",backgroundPosition:"right 6px center",
            }}>
              {Object.values(DIVERS).map(dv=>(<option key={dv.id} value={dv.id}>{dv.name}</option>))}
            </select>
            <div>FINA {diver.finaAge} · {diver.ageGroup}</div>
            <div style={{fontSize:9,display:"flex",alignItems:"center",gap:3,justifyContent:"flex-end",marginTop:1}}>
              <span style={{width:5,height:5,borderRadius:"50%",display:"inline-block",
                background: firebaseStatus==="connected"?"#10b981":firebaseStatus==="connecting"?"#f59e0b":"#6b7280",
              }}/>
              {firebaseStatus==="connected"?"Synced":firebaseStatus==="connecting"?"Syncing...":"Local only"}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{padding:16}}>
        {activeTab==="dashboard" && renderDashboard()}
        {activeTab==="stats" && renderDiveStats()}
        {activeTab==="practice" && (
          <>
            <div style={{display:"flex",gap:6,marginBottom:12}}>
              <button onClick={()=>setPracticeView("log")} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:practiceView==="log"?theme.accent:theme.surface,color:practiceView==="log"?"#fff":theme.textMuted}}>Practice Log</button>
              <button onClick={()=>setPracticeView("print")} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:practiceView==="print"?theme.accent:theme.surface,color:practiceView==="print"?"#fff":theme.textMuted}}>Print Sheet</button>
            </div>
            {practiceView==="log" ? renderPracticeLog() : renderPracticePlan()}
          </>
        )}
        {activeTab==="compete" && renderCompetition()}
        {activeTab==="recommend" && renderRecommendations()}
      </div>

      {/* Bottom Nav */}
      <div style={{
        position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:420,
        background:theme.card, borderTop:`1px solid ${theme.cardBorder}`,
        display:"flex",padding:"6px 8px calc(10px + env(safe-area-inset-bottom, 0px))",gap:2,
        boxShadow:`0 -4px 20px rgba(0,0,0,0.3)`,
      }}>
        <button onClick={()=>setActiveTab("dashboard")} style={tabBtn("dashboard")}>
          <Icon type="wave" size={16}/> Home
        </button>
        <button onClick={()=>setActiveTab("stats")} style={tabBtn("stats")}>
          <Icon type="chart" size={16}/> Stats
        </button>
        <button onClick={()=>setActiveTab("practice")} style={tabBtn("practice")}>
          <Icon type="clipboard" size={16}/> Practice
        </button>
        <button onClick={()=>setActiveTab("compete")} style={tabBtn("compete")}>
          <Icon type="trophy" size={16}/> Compete
        </button>
        <button onClick={()=>setActiveTab("recommend")} style={tabBtn("recommend")}>
          <Icon type="star" size={16}/> Plan
        </button>
      </div>
    </div>
  );
}
