# Dasha Calculation Methodologies: Astronomical vs. Linear

This document explains the technical and philosophical differences between the dasha calculation methods used in **JHora** and this **Application**, specifically regarding the "True Sidereal Solar Year" system.

## 1. The Core Divergence

### JHora: Linear Interpolation within Cycles
JHora follows a "Hybrid" approach:
- **Major Cycle (MD):** Calculated astronomically (finding the exact moment the Sun completes a 360° sweep).
- **Sub-periods (AD down to Deha):** Calculated by **dividing time**. If a Mahadasha lasts 2,191 days, the sub-periods are simply mathematical fractions of that total time. 
- **Assumption:** It treats the Sun's speed as a constant "average" throughout the major cycle.

### This Application: Astronomical Recursion
This application follows a "Pure" approach:
- **All Levels:** Every single boundary (from MD down to Deha) is calculated by finding the **exact astronomical moment** the Sun has swept a specific degree of arc.
- **Assumption:** It acknowledges that the Sun's speed varies daily (faster in January, slower in July) and tracks this variation precisely at every sub-level.

## 2. Why the Results Drift (The "Speed of the Sun" Problem)

Because the Earth's orbit is elliptical, the Sun appears to move faster at certain times of the year and slower at others.

- **In JHora**, a sub-period's duration is fixed by clock time.
- **In this Application**, a sub-period's duration "stretches" or "shrinks" based on the Sun's actual physical speed.

By the time you reach the **Deha Dasha** (6th level), these tiny astronomical variations have compounded. Even if both systems start at the same second, they will drift apart by days because they are measuring different things: one measures **Clock Time**, the other measures **Solar Arc**.

## 3. Precision vs. Jitter

### Numerical Precision (`1e-9`)
The application uses a convergence threshold of `1e-9` (one billionth of a degree). This is extremely precise for planetary positions.

### The Deha Challenge
A Deha Dasha can last as little as **60 seconds**. When a period is that short, even the tiniest numerical variance in the astronomical search can lead to "jitter"—small jumps in start/end times. This is a natural side effect of trying to map high-speed planetary motion to minute-level time windows.

## 4. Which Method is "Better"?

### The Case for this Application (Astronomical Purity)
- **Truer to Physics:** It represents the actual movement of the solar system.
- **Logical Consistency:** If the year is defined by degrees, the sub-divisions should be too.
- **Ideal for Research:** Best for testing if exact astronomical alignments correlate with life events.

### The Case for JHora (Traditional Parity)
- **Industry Standard:** Matches the historical "averaging" methods used for centuries.
- **Stability:** Predictive rules in Vedic Astrology were largely developed using linear time divisions.
- **Communication:** Essential for speaking the same "time language" as other astrologers.

## Summary Recommendation

| Goal | Recommended Method |
| :--- | :--- |
| **Scientific/Research** | **Astronomical (This App)** |
| **Traditional Consultation** | **Linear (JHora)** |

This application provides a **scientifically superior** model by utilizing modern computational power to track actual solar motion, whereas JHora provides a **traditionally consistent** model that aligns with historical predictive practice.
