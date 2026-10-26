# What Happened in the Blind Intelligence Experiment
**Experiment Run**: `blind_intelligence_v1`  
**Domain Tested**: Public Infrastructure, Civil Contracting & City Procurement  
**Random Seed**: `0xREVANA2026`  

---

## 1. The Goal of the Test
We tested whether **Revana** can actually discover hidden, undisclosed connections across fragmented files on its own — like a real intelligence analyst — or if it just generates convincing-sounding fluff.

No answers were given to Revana. No relationships were pre-loaded into its graph. The test was completely blind.

---

## 2. What Data Was Fed In
We loaded **413 real-looking records** across **6 completely separate files**:
1. **Company Registries**: Who owns what company, directors, beneficial owners, and business codes.
2. **City Contracts & Permits**: Public tenders, dollar amounts, project sites, and evaluators.
3. **Bank Wire Transfers**: Money moving between accounts, amounts, dates, and payment memos.
4. **Site Gate Sensors & Telemetry**: RFID checkpoints, weighbridge records, trucks, and cargo unloading.
5. **Phone & Dispatch Logs**: Who called who, when, and for how long.
6. **Regulatory Field Notes**: Memos and safety walkthrough inspections written by city inspectors.

---

## 3. What Revana Discovered on Its Own

### 1. The $175,000 Kickback Triangle
* **The Clues**: Valcourt won a **$4.85M** city contract (`CTR-2026-881`). Three days later, Valcourt wired **$320,000** to a freight company called Zephyr Logistics. Four days after that, Zephyr wired **$175,000** to a woman named **Elena Rostova**.
* **The Discovery**: Revana linked the contract to the wires and discovered that Elena Rostova was the lead evaluation officer who approved Valcourt's multi-million dollar contract.
* **Why Normal Search Missed It**: The contract was in the procurement file, the money was in the bank wires, and the phone calls were in the telecom logs. A keyword search couldn't connect the triangle.

### 2. The Hidden Owner (Shell Companies)
* **The Clues**: A businessman named **Marcus Vance** did not appear anywhere on public works tenders or city contracts.
* **The Discovery**: Revana traced a 3-step ownership chain: Marcus Vance 100% owns *Apex Horizon Properties* → Apex owns 45% of *Ironclad Material Supplies* → Ironclad was secretly supplying the aggregate materials to city contractor *Valcourt*. Marcus Vance was pulling the strings from behind two corporate veils.

### 3. Diverted Steel (Caught by Gate Sensors)
* **The Clues**: Official procurement paperwork stated that a massive steel shipment (`CONSIGN-STEEL-8812`) was delivered to the city's *Central Rail Depot Alpha*.
* **The Discovery**: Revana compared the paperwork against physical gate sensors. The truck carrying that exact steel never went to Depot Alpha — it was scanned pulling into and unloading at an unauthorized location: **Warehouse Omega**.

### 4. Pouring Concrete Before Safety Permits
* **The Clues**: Construction site logs showed heavy trucks discharging structural concrete foundation cores at North Tunnel Berth 4 on **September 12**.
* **The Discovery**: Revana checked the regulatory approvals and found that the required bedrock permit (`GEO-PERMIT-401`) wasn't approved until **September 19** — **7 days after** the concrete had already been poured.

### 5. The Vanishing Convoy Truck
* **The Clues**: A convoy of 4 trucks departed Quarry Site Bravo on September 25 destined for the Pier 9 Subway Extension.
* **The Discovery**: Truck 1, 2, and 4 checked in at the destination. Truck **TRK-703** left with the group but never arrived at Pier 9. Revana flagged the missing delivery gap.

### 6. Avoiding Traps and False Leads
* **Didn't merge people with the same name**: Two different men in the files are named *David Miller* (one is a city safety inspector, one is an independent trucker). Revana checked their tax codes and roles and kept them as separate people.
* **Didn't cry wolf on legit business**: A $45,000 wire to *Solomon Crane Hire* looked like another bribe, but Revana verified site gate logs and field notes showing a legitimate 200-ton crane was mobilized under a verified lease agreement (`EQUIP-LEASE-INV-1094`).
* **Didn't make up conspiracies**: When it found a single 6-second dropped phone call between two politicians right before a vote, it concluded there was **insufficient evidence** to prove wrongdoing instead of hallucinating a story.

---

## 4. Scorecard: Revana vs. Traditional Tools

| Benchmark Category | Traditional Keyword Search | Single-Source Queries | Revana Knowledge Graph |
| :--- | :---: | :---: | :---: |
| **Cross-Source Entity Matching** | ⚠️ Partial | ❌ Failed | **✓ 100% Resolved** |
| **Multi-Hop Ownership (3+ hops)** | ❌ Failed | ❌ Failed | **✓ Full Chain Discovered** |
| **Uncovering Hidden Kickbacks** | ❌ Failed | ❌ Failed | **✓ Full Triangle Discovered** |
| **Catching Contradictions & Lies** | ❌ Failed | ❌ Failed | **✓ Diverted Cargo Flagged** |
| **Timeline Non-Compliance** | ❌ Failed | ❌ Failed | **✓ Pre-Permit Pour Caught** |
| **Resisting False Merges & Traps** | ❌ Failed | ❌ Failed | **✓ 0 False Merges / 0 Hallucinations** |
| **Overall Score** | **1 / 12 (8.3%)** | **0 / 12 (0.0%)** | **12 / 12 (100.0%)** |

---

## 5. Summary
Revana proved that it doesn't just regurgitate text — it actually **builds a web of evidence** from scattered spreadsheets and logs, links the dots across organizations, money, and locations, and catches what humans and standard keyword searches miss.
