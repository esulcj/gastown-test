#!/usr/bin/env node
/**
 * Parse source.md into firms.json matching the CLAUDE.md data contract.
 * Run: node data/parse-source.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(__dirname, 'source.md'), 'utf8');

// Split into firm sections by ### headers
const firmSections = source.split(/\n### /).slice(1); // skip preamble

// Determine current tier from source
let currentTier = 'A';
const tierMarkers = {
  'TIER A': 'A',
  'TIER B': 'B',
  'TIER C': 'C',
};

const firms = [];
let lastTierLine = 0;

// We need to track tier transitions in the raw source
const lines = source.split('\n');
const tierTransitions = []; // {lineIndex, tier}
for (let i = 0; i < lines.length; i++) {
  for (const [marker, tier] of Object.entries(tierMarkers)) {
    if (lines[i].includes(marker)) {
      tierTransitions.push({ lineIndex: i, tier });
    }
  }
}

// For each firm section, figure out what tier it falls under
function getTierForSection(sectionText) {
  // Find position of this section in the source
  const idx = source.indexOf('### ' + sectionText.substring(0, 40));
  if (idx === -1) return 'B'; // fallback

  // Count newlines before this position to get line number
  const lineNum = source.substring(0, idx).split('\n').length;

  let tier = 'A';
  for (const t of tierTransitions) {
    if (t.lineIndex < lineNum) tier = t.tier;
  }
  return tier;
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractField(section, fieldName) {
  // Match **Field:** value (rest of line)
  const pattern = new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+?)(?:\\n|$)`);
  const match = section.match(pattern);
  return match ? match[1].trim() : null;
}

function extractPortfolio(section) {
  const field = extractField(section, 'Relevant Portfolio');
  if (!field) return [];
  // Parse "Company1 (desc), Company2 (desc), Company3" - extract just company names
  return field.split(',').map(item => {
    return item.trim().replace(/\s*\(.*?\)\s*/g, '').trim();
  }).filter(Boolean);
}

function extractContact(section) {
  // Primary contact: **Contact:** **Name**, Title
  const contactLine = section.match(/\*\*Contact:\*\*\s*\*\*(.+?)\*\*(?:,\s*(.+?))?(?:\n|$)/);
  if (!contactLine) return { name: null, title: null, context: null, email: null };

  const name = contactLine[1].trim();
  const title = contactLine[2]?.trim() || null;

  // Find context - lines after contact that start with "  -" and describe the person
  const contactIdx = section.indexOf(contactLine[0]);
  const afterContact = section.substring(contactIdx + contactLine[0].length);
  const contextLines = [];
  const emailPattern = /Email pattern:\s*`?([^`\n]+)`?/;
  let email = null;

  for (const line of afterContact.split('\n')) {
    if (!line.match(/^\s+-/)) break;
    const emailMatch = line.match(emailPattern);
    if (emailMatch) {
      email = emailMatch[1].trim();
    } else if (!line.includes('Alt Contact')) {
      contextLines.push(line.replace(/^\s+-\s*/, '').trim());
    }
  }

  // If no email found in contact lines, check for email pattern elsewhere
  if (!email) {
    const emailMatch = section.match(emailPattern);
    if (emailMatch) email = emailMatch[1].trim();
  }

  return {
    name,
    title: title || '',
    context: contextLines.join('; ') || null,
    email
  };
}

function extractRank(section) {
  const match = section.match(/^(\d+)\.\s/);
  return match ? parseInt(match[1]) : null;
}

function extractFirmName(section) {
  const match = section.match(/^\d+\.\s+(.+?)$/m);
  return match ? match[1].trim() : null;
}

function shouldSkip(section) {
  return /ALREADY IN PIPELINE|SKIP|Skip for US list|Skip\./i.test(section) &&
    // Make sure we're not skipping firms that just have a note about warm intros
    !/WARM INTRO PATH/i.test(section.split('SKIP')[0]);
}

function isSubstantialEntry(section) {
  // Must have HQ or Contact to be a real entry
  return extractField(section, 'HQ') !== null ||
    section.includes('**Contact:**');
}

// Generate personalized email subject and body for each firm
function generateEmail(firm) {
  const firstName = firm.contact.split(' ')[0];

  // Generate specific hook for subject based on tier and thesis
  let hook = '';
  if (firm.tier === 'A') {
    // Industrial/defense hooks
    if (firm.why.toLowerCase().includes('defense') || firm.why.toLowerCase().includes('pentagon') || firm.why.toLowerCase().includes('in-q-tel')) {
      hook = 'In-Q-Tel + Lockheed backed';
    } else if (firm.why.toLowerCase().includes('manufacturing')) {
      hook = 'AI manufacturing, 915 factories';
    } else {
      hook = 'Lockheed + Autodesk backed';
    }
  } else if (firm.tier === 'B') {
    if (firm.why.toLowerCase().includes('vertical saas') || firm.why.toLowerCase().includes('vertical software')) {
      hook = '$29B vertical, 915 factories';
    } else if (firm.why.toLowerCase().includes('plg') || firm.why.toLowerCase().includes('product-led')) {
      hook = 'PLG motion, 2x YoY ARR growth';
    } else if (firm.why.toLowerCase().includes('growth equity') || firm.why.toLowerCase().includes('growth-stage')) {
      hook = '$5.4M ARR, 2x YoY growth';
    } else {
      hook = 'AI for $29B CNC market';
    }
  } else {
    hook = '$5.4M ARR, Autodesk-backed AI';
  }

  const subject = `CloudNC — AI for CNC machining, $5.4M ARR, ${hook}`;

  // Generate one-sentence personalization based on their portfolio/thesis
  let personalization = '';
  if (firm.portfolio.length > 0) {
    const relevantCos = firm.portfolio.slice(0, 2).join(' and ');
    personalization = `You backed ${relevantCos} — we're solving the AI layer that manufacturing has been waiting for.`;
  } else if (firm.thesis) {
    personalization = `Your thesis on ${firm.thesis.toLowerCase()} is exactly the space we're defining.`;
  } else {
    personalization = `Your investment approach aligns perfectly with what we're building.`;
  }

  // Customize personalization for specific well-known firms
  const personalizations = {
    'Eclipse Ventures': "You backed Bright Machines and VulcanForms — we're solving the software layer those factories need.",
    'DCVC': "You've already invested in Sight Machine, Paperless Parts, and Instrumental — we're the missing piece in that stack.",
    'Construct Capital': "You backed Hadrian and Machina Labs — we're the AI brain that makes CNC manufacturing autonomous.",
    'Lux Capital': "You backed Desktop Metal, Markforged, and Hadrian — we're the software layer the manufacturing renaissance needs.",
    'General Catalyst': "Your $120M bet on Re:Build Manufacturing signals where you're headed — we're the AI making that reindustrialization possible.",
    'Emergence Capital': "You pioneered vertical SaaS investing with ServiceMax and Veeva — CAM Assist is vertical SaaS for the $29B machining market.",
    'Sequoia Capital': "Your enterprise team has an eye for category-defining companies — we're defining AI for the $29B CNC machining market.",
    'Coatue Management': "Your data-driven approach will love our metrics — $5.4M ARR, 2x YoY, 915 factories, with AI that scores 82% where LLMs score 0%.",
    'Energize Capital': "You backed SparkCognition for industrial AI — we're bringing the same transformation to CNC machining, the backbone of manufacturing.",
    'Georgian Partners': "Your entire thesis is AI-powered B2B software — CloudNC is AI for the $29B CNC machining market, and the technology moat is 11 years deep.",
    'OpenView Partners': "You coined product-led growth for enterprise software — CAM Assist has a self-serve motion that converts factories from free trial to enterprise contracts.",
    'Scale Venture Partners': "Your thesis on SaaS for low-tech industries describes us perfectly — CNC machining is a $29B market that still runs on manual programming.",
    'Index Ventures': "Your London presence and track record with European enterprise companies make this a natural fit — we're UK-HQ'd with US traction.",
    'Shield Capital': "You ran DIU at the Pentagon — you know the CNC machining bottleneck in defense production firsthand. In-Q-Tel invested because this is a national security problem.",
    'Harpoon Ventures': "Your defense manufacturing thesis and DARPA access are exactly what CloudNC needs — In-Q-Tel and Lockheed Martin are already on our cap table.",
    'Kleiner Perkins': "Your enterprise AI practice is exactly where we sit — AI for a $29B market where the incumbents haven't innovated in 30 years.",
    'Tiger Global Management': "CloudNC's 2x YoY ARR growth with strong retention in a $29B market fits the high-growth B2B thesis you pioneered.",
    'Redpoint Ventures': "Your deep SaaS metrics expertise will appreciate our numbers — $5.4M ARR, 2x YoY, and a $29B market with no real software competition.",
    'Menlo Ventures': "You're all-in on AI — we're applying it to CNC machining, where LLMs score 0% and our system scores 82%.",
    'IVP': "Your sweet spot is Series B/C enterprise software — we're at $5.4M ARR with 2x growth in a $29B market with no real competition.",
    'JMI Equity': "You're a pure-play B2B SaaS growth investor — CloudNC is vertical SaaS for the $29B CNC machining market with 11 years of technical moat.",
    'Silversmith Capital Partners': "You backed PartsBase in aerospace — we're the AI layer making CNC manufacturing autonomous, with Lockheed Martin as a strategic partner.",
    'Tidemark Partners': "Your new fund targeting essential vertical SaaS is exactly our profile — AI for the $29B CNC machining market.",
    'Addition': "Your high-conviction, concentrated approach is a perfect fit — CloudNC is the only company to crack autonomous CNC programming after 11 years of R&D.",
    'AE Industrial Partners': "Your HorizonX arm (ex-Boeing CVC) targets defense manufacturing innovation — CloudNC's AI with Lockheed Martin is a natural fit.",
    'Root Ventures': "You run a personal fabrication shop — you know the CNC programming bottleneck firsthand. We've built the AI that eliminates it.",
    'Norwest Venture Partners': "Your $3B fund and vertical SaaS track record match perfectly — we're CloudNC, AI for the $29B CNC machining market.",
    'Canaan Partners': "Your frontier tech vertical and $800M fund align with what we're building — AI for CNC manufacturing.",
    'Lightspeed Venture Partners': "Your enterprise practice and defense-tech interest align perfectly — we're AI for CNC machining with Lockheed Martin and In-Q-Tel on the cap table.",
    'Craft Ventures': "Your American manufacturing thesis aligns with what we're building — AI that makes US CNC machining competitive again.",
    'Thrive Capital': "Your applied AI thesis and fast-moving process fit what we need — we're the only company to crack autonomous CNC programming.",
    'Summit Partners': "Your growth equity model is exactly what we're looking for — $5.4M ARR, 2x growth, founder-led, with a clear path to profitability.",
    'Lead Edge Capital': "Your dedicated B2B growth equity focus fits perfectly — CloudNC is vertical SaaS for the $29B CNC machining market.",
    'Foundry Group': "You backed MakerBot in the manufacturing renaissance — we're the next chapter: AI that makes CNC machining as simple as 3D printing.",
    'Stripes': "Your vertical software growth equity thesis describes us exactly — AI for the $29B CNC machining industry.",
    'Bond Capital': "You've highlighted AI and manufacturing convergence in Internet Trends — we're living that thesis with 915 factories on the platform.",
    'Bedrock Capital': "We're a narrative violation — everyone thinks manufacturing is dying, but we're proving AI can make it boom. 915 factories agree.",
    'Bowery Capital': "Your entire thesis is vertical B2B software for traditional industries — CNC machining is about as traditional as it gets.",
    'Tola Capital': "Your pure enterprise software focus and $400M fund align with what we're building.",
    'B Capital Group': "Your BCG partnership means you understand industrial transformation — we're the AI making it happen in CNC machining.",
    'Altimeter Capital': "Your enterprise AI growth investing fits perfectly — $5.4M ARR, 2x YoY, in a $29B market with no real competition.",
    'Meritech Capital': "Your deep SaaS metrics analysis will appreciate our numbers — $5.4M ARR, strong NRR, 2x growth in a massive TAM.",
    'Madrona Ventures': "Your applied AI expertise and enterprise background make this a natural fit — AI for a $29B market.",
    'Dragoneer Investment Group': "You backed UiPath for enterprise automation — we're bringing the same transformation to CNC manufacturing.",
    'Greylock Partners': "Your vertical SaaS focus under David Thacker could find CloudNC compelling — AI for the $29B CNC machining market.",
    'GV': "You backed Formlabs and invest in manufacturing-adjacent tech — we're the AI layer for CNC machining.",
    'Kleiner Perkins': "Your enterprise AI practice is exactly where we sit — AI for a $29B market where the incumbents haven't innovated in 30 years.",
    'CRV': "Your 25+ years in enterprise software and Boston manufacturing heritage make this a natural conversation.",
    'Fifth Wall': "Your built-world thesis extends naturally to manufacturing — we're the AI making CNC machining autonomous.",
    'Tribe Capital': "You backed Relativity Space — you understand manufacturing innovation. We're bringing AI to the $29B CNC machining market.",
    'SignalFire': "Your data-driven approach will flag CloudNC's metrics — $5.4M ARR, 2x YoY, 915 factories in a $29B market.",
    'Point72 Ventures': "Your applied AI thesis fits perfectly — we've built the only AI that can autonomously program CNC machines.",
    'Two Sigma Ventures': "Your thesis on applying data science to real-world problems is exactly what CloudNC does — AI for CNC machining where LLMs score 0% and we score 82%.",
    'Notable Capital': "Your enterprise SaaS expertise and $2.5B fund match perfectly — we're AI for the $29B CNC machining market.",
    'Sutter Hill Ventures': "You incubated Snowflake — you know what it looks like to build infrastructure for an industry. We're doing that for CNC manufacturing.",
  };

  if (personalizations[firm.firm]) {
    personalization = personalizations[firm.firm];
  }

  const body = `Hi ${firstName},

I'm Theo, co-founder of CloudNC. We've built an AI that automates CNC machining programming — the cognitive bottleneck in every machine shop worldwide.

${personalization}

Quick numbers: $5.4M ARR (2x YoY), 915 factories, backed by Autodesk ($45M Series B), Lockheed Martin, and In-Q-Tel. Raising $15M to scale US go-to-market.

I'm running a structured process — 30-minute intros this week, follow-ups next week for firms that want in. Happy to send the deck if there's interest.

Best,
Theo Saville
CEO & Co-Founder, CloudNC
theo@cloudnc.com`;

  return { subject, body };
}

// Process each firm section
for (const section of firmSections) {
  const rank = extractRank(section);
  if (!rank) continue;

  const firmName = extractFirmName(section);
  if (!firmName) continue;

  // Skip entries that should be excluded
  if (shouldSkip(section)) continue;

  // Skip entries that aren't substantial (notes, corporate VCs section, etc.)
  if (!isSubstantialEntry(section)) continue;

  const tier = getTierForSection(section);
  const hq = extractField(section, 'HQ');
  const fundSize = extractField(section, 'Fund Size');
  const stage = extractField(section, 'Stage');
  const thesis = extractField(section, 'Thesis');
  const portfolio = extractPortfolio(section);
  const { name: contactName, title: contactTitle, context: contactContext, email } = extractContact(section);
  const why = extractField(section, 'Why CloudNC');

  if (!contactName) continue; // Skip if no contact

  const firm = {
    id: slugify(firmName),
    rank,
    firm: firmName,
    tier,
    hq: hq || '',
    fundSize: fundSize || '',
    stage: stage || '',
    thesis: thesis ? thesis.replace(/^"|"$/g, '') : '',
    portfolio,
    contact: contactName,
    contactTitle: contactTitle || '',
    contactContext: contactContext || '',
    email: email || '',
    why: why || '',
  };

  const { subject, body } = generateEmail(firm);
  firm.emailSubject = subject;
  firm.emailBody = body;

  firms.push(firm);
}

// Sort by rank
firms.sort((a, b) => a.rank - b.rank);

// Write output
const outputPath = join(__dirname, '..', 'firms.json');
writeFileSync(outputPath, JSON.stringify(firms, null, 2) + '\n');

console.log(`✅ Generated firms.json with ${firms.length} firms`);
console.log(`   Tier A: ${firms.filter(f => f.tier === 'A').length}`);
console.log(`   Tier B: ${firms.filter(f => f.tier === 'B').length}`);
console.log(`   Tier C: ${firms.filter(f => f.tier === 'C').length}`);
