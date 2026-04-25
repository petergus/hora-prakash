# Project Improvement Suggestions: Hora Prakash

## 1. Performance Improvements

### **Calculation Caching (Critical for TSSY)**
The `True Sidereal Solar Year` (TSSY) dasha calculation is computationally expensive because it performs multiple iterative ephemeris lookups.
- **Suggestion:** Implement a cache for `findSolarReturn` and `advanceTSSY` results. Since birth details (JD, Lat, Lon) don't change frequently during a session, caching these boundary points will make switching between Dasha levels or UI modes near-instant.
- **Implementation:** Use a simple `Map` keyed by `(startJd, years, flags)` in `src/core/dasha.js`.

### **Web Worker for Calculations**
Currently, all calculations (including the 5-level dasha tree) run on the main UI thread.
- **Suggestion:** Move `calcBirthChart` and `calcDasha` into a Web Worker. This ensures that even heavy calculations won't "jank" the UI, especially when the Swiss Ephemeris is crunching numbers.
- **Benefit:** Keeps the "Focused" and "Full" mode transitions in the Dasha tab smooth.

### **WASM & Data Lazy Loading**
The `swisseph.data` files can be several megabytes.
- **Suggestion:** Use `IDB` (IndexedDB) via a Service Worker to cache the `.wasm` and `.data` files so they don't need to be downloaded on every cold start.

### **Dasha Table Virtualization**
In "Full" mode, if a user expands multiple levels, the DOM can grow to thousands of rows, which slows down the browser's style calculation and layout.
- **Suggestion:** Use a virtual scrolling technique for the Dasha table if it exceeds ~200 rows.

---

## 2. Architectural & Code Quality Suggestions

### **TypeScript Migration**
The domain logic (signs, nakshatras, dasha nodes, planet objects) is complex.
- **Suggestion:** Migrate to **TypeScript**. 
- **Benefit:** It will catch bugs where you might expect a `number` but get a `string` (e.g., from an input field), and it provides excellent "IntelliSense" for the various planetary properties.

### **Reactive State Management**
Currently, `src/state.js` is a mutable object, and UI updates are triggered by manual calls.
- **Suggestion:** Implement a simple **Publisher/Subscriber** pattern or use a lightweight library like `Preact Signals`.

### **Template-Based Rendering**
You are currently using string interpolation (`innerHTML = ...`) which is prone to XSS and is inefficient for frequent updates.
- **Suggestion:** Use `<template>` tags in HTML or a library like `lit-html` or `uhtml`.

---

## 4. Thorough Code Review

### **A. Domain Logic & Calculations (`src/core/`)**
*   **Precision Management:** The `divisional.js` file uses `Math.floor((lon % 30) * n / 30)` for divisional calculations. This is a good practice to avoid floating-point issues common in divisions like 30/9. However, calculations at the exact 30° boundary (e.g., 29.9999999) can occasionally flip signs. 
    *   *Recommendation:* Consider adding a tiny epsilon or using a rounding function before sign determination.
*   **SwissEph Lifecycle:** `swisseph.js` correctly manages a singleton instance of the WASM module. 
    *   *Observation:* `PLANETS` are defined with Sun as ID 0 and Rahu as ID 10. The Ketu calculation (Rahu + 180) is a standard shortcut, but ensure that "True" vs "Mean" node settings in `settings.js` are consistently applied to both.
*   **Dasha Complexity:** `calcDasha` is quite complex, especially with the TSSY (True Sidereal Solar Year) support. The recursive nature of `calcSubPeriods` is clean, but the eager calculation of the first two levels and lazy loading for others is a smart hybrid approach for performance.

### **B. UI Layer & Rendering (`src/ui/`, `src/tabs/`)**
*   **DOM Updates:** The project relies heavily on `innerHTML` for re-rendering (e.g., `renderInputTab`, `renderDasha`). 
    *   *Issue:* This destroys the existing DOM nodes, causing loss of focus, scroll position, and being less efficient than surgical updates. 
    *   *Recommendation:* Use a lightweight virtual DOM library (like Preact) or a tagged template literal system (like `lit-html`) to preserve DOM state between updates.
*   **SVG Generation:** `chart-svg.js` is well-structured. The use of centroids for North Indian chart polygons ensures labels remain centered even in triangular houses.
    *   *Improvement:* The `placePlanets` function uses a simple vertical list. For houses with 5+ planets, fonts become very small. A 2-column layout or a "honeycomb" positioning would improve readability for complex charts.
*   **Accessibility (A11y):** Many buttons and interactive elements (like the chart polygons) lack ARIA labels or proper keyboard navigation support.
    *   *Recommendation:* Add `aria-label` to icon-only buttons and ensure all `onclick` handlers on non-button elements have corresponding `onkeydown` (Enter/Space) handlers.

### **C. State & Data Management (`src/state.js`, `src/sessions.js`)**
*   **Global Mutable State:** `state.js` exports a mutable object. This makes it difficult to track "who changed what."
    *   *Recommendation:* Move towards an immutable state pattern where updates are dispatched. This would also make "Undo/Redo" functionality trivial to implement.
*   **Persistence:** Profile management in `input.js` is robust but has some code duplication between `importProfiles` (JSON) and `importJhdFiles` (JHD).
    *   *Recommendation:* Consolidate the "Save to LocalStorage and Deduplicate" logic into a single utility function.

### **D. Utilities & Performance (`src/utils/`)**
*   **Network Reliability:** Geocoding and Timezone lookups are dependent on free third-party APIs (`Nominatim` and `timeapi.io`).
    *   *Issue:* These have rate limits and no SLA. 
    *   *Recommendation:* Implement aggressive caching of results in `localStorage` or `IndexedDB` to ensure that loading a saved profile works instantly and offline.
*   **Error Handling:** Most errors are caught and logged to the console or shown via `alert`.
    *   *Improvement:* Implement a consistent UI "Toast" or "Notification" system for errors rather than using blocking `alert()` calls.

### **E. Security**
*   **XSS Risk:** While the app is client-side only, `innerHTML` with user-provided names/locations is a potential XSS vector. 
    *   *Fix:* You already have `escapeHtml` and `escapeAttr` in `input.js`, but they aren't used everywhere. A templating engine would handle this automatically.

---

## 5. Summary Table

| Category | Status | Priority |
| :--- | :--- | :--- |
| **Calculation Accuracy** | Excellent | Low |
| **UI Responsiveness** | Good | Medium |
| **Code Structure** | Maintainable | Low |
| **A11y / UX** | Basic | High |
| **Scalability (DOM)** | Concerns in Full Mode | Medium |
| **Type Safety** | None (JS) | Medium |
