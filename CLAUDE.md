# CLAUDE.md — Outreach V2 Agent Rules

## Absolute Rules
- NO frameworks (no React, Vue, Svelte, etc.)
- USE Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- USE Alpine.js via CDN: <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
- Light theme ONLY. White background. Accent: #FD384E.
- Font: system-ui, -apple-system, sans-serif
- NO build step. NO node_modules. NO bundler.
- All JS in ES modules or inline <script> tags.
- Mobile responsive (min 375px).

## Data Contract
Each firm in firms.json:
```json
{
  "id": "eclipse-ventures",
  "rank": 1,
  "firm": "Eclipse Ventures",
  "tier": "A",
  "hq": "Palo Alto, CA",
  "fundSize": "$1B+",
  "stage": "Seed to Growth",
  "thesis": "Physical industries transformation",
  "portfolio": ["Bright Machines", "Augury"],
  "contact": "Greg Reichow",
  "contactTitle": "Partner",
  "contactContext": "Former VP of Production at Tesla",
  "email": "greg@eclipse.capital",
  "why": "Eclipse's thesis IS the digitization of physical industries...",
  "emailSubject": "CloudNC — AI for CNC machining...",
  "emailBody": "Hi Greg,\n\n..."
}
```

## State.js API Contract
```js
// State is a plain object with methods, stored in window.OutreachState
window.OutreachState = {
  init(firms),           // Initialize with firms array
  getCurrentFirm(),      // Returns current firm object or null
  getPosition(),         // Current index
  setPosition(i),        // Jump to position
  next(),                // Advance to next in queue
  prev(),                // Go back one
  markSent(id),          // Move to sent
  markSkipped(id),       // Move to skipped  
  unmark(id),            // Return to queue
  getStatus(id),         // 'queue' | 'sent' | 'skipped'
  saveEdit(id, field, value),  // Persist an edit
  getEdit(id, field),    // Get edited value or null
  getEffectiveEmail(id), // Returns edited body or original
  getEffectiveSubject(id),
  getCounts(),           // { queue, sent, skipped, total }
  exportState(),         // Full JSON dump
}
// All state persisted to localStorage key: 'outreach-v2'
```

## Email Template
Subject: CloudNC — AI for CNC machining, $5.4M ARR, [firm-specific hook]
Body: ~200 words. Professional but warm. Mention:
- Theo Saville, co-founder/CEO, 10 years in AI manufacturing
- CloudNC makes CNC machining as simple as 3D printing
- $5.4M ARR, hundreds of machine shops, Autodesk + Lockheed Martin as strategic partners
- $108.5M total raised (Series B led by Autodesk, $45M)
- Why THIS firm specifically (portfolio overlap, thesis match, partner background)
- Ask: 30-minute conversation about the growth round
