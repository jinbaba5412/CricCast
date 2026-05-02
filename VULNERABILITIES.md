# CricCast Security Vulnerabilities Report

## Overview
This document outlines all security vulnerabilities identified by CodeQL and Dependabot in the CricCast v4.0 codebase.

**Date:** 2026-05-02  
**Repository:** jinbaba5412/CricCast  
**Total Vulnerabilities:** 33

---

## CodeQL Vulnerabilities (28 Alerts)

### High Severity (21 Alerts)

#### 1. Polynomial Regular Expression Denial of Service (ReDoS)

**Alert #28**
- **Location:** `routes/club.js:1078`
- **Issue:** Regular expression vulnerable to polynomial backtracking on uncontrolled data
- **Risk:** Attacker can cause server CPU exhaustion via specially crafted input
- **Impact:** Service unavailability, performance degradation

**Alert #27**
- **Location:** `routes/auth.js:28`
- **Issue:** Email validation regex uses pattern susceptible to ReDoS attacks
- **Risk:** Malformed email input could trigger exponential regex engine behavior
- **Impact:** Login/signup endpoint DoS

---

#### 2. Missing CSRF Middleware

**Alert #25**
- **Location:** `server.js:157`
- **Issue:** POST endpoints lack CSRF token validation
- **Risk:** Attackers can forge requests on behalf of authenticated users
- **Attack Example:** 
  ```
  POST /api/club/users (from attacker's site)
  → Creates admin user without user's consent
  ```
- **Impact:** Unauthorized state changes, account compromise

---

#### 3. Reflected Cross-Site Scripting (XSS)

**Alert #24**
- **Location:** `routes/match.js:155`
- **Issue:** User-controlled `matchId` parameter reflected in HTML without encoding
- **Risk:** Arbitrary JavaScript execution in victim's browser
- **Attack Example:**
  ```
  /match/<img src=x onerror=alert(document.cookie)>/overlay
  → Steals session cookies
  ```
- **Impact:** Session hijacking, credential theft, malware distribution

**Alert #23**
- **Location:** `routes/match.js:75`
- **Issue:** Dynamic data injected into HTML context without proper escaping
- **Risk:** Script injection via specially crafted input
- **Impact:** Page defacement, malware injection, user data exfiltration

---

#### 4. Client-Side XSS in Login Form

**Alert #22**
- **Location:** `views/login.html:88`
- **Issue:** Login form error messages reflected without sanitization
- **Risk:** XSS via error parameter: `?error=<script>alert(1)</script>`
- **Attack Example:**
  ```html
  <div id="err">
    <!-- If error contains HTML, it gets rendered -->
  </div>
  ```
- **Impact:** Credential harvesting, phishing, malware delivery

---

#### 5. Uncontrolled Data Used in Path Expression (14 Alerts)

**Alerts #21, #20, #19, #18**
- **Location:** `server.js:352, 351`
- **Issue:** User-supplied tenant slug used in file path without validation
- **Risk:** Directory traversal via path manipulation
- **Attack Example:**
  ```
  slug=../../../etc/passwd
  → Attempts to read /etc/passwd
  ```

**Alerts #17, #16, #15, #14**
- **Location:** `routes/auth.js:79, 76`
- **Issue:** Slug parameter used directly in filesystem operations
- **Risk:** Escape from intended directory structure
- **Attack Example:**
  ```
  slug=club/../../../
  → Accesses parent directories
  ```

**Alerts #13, #12, #11, #10, #9, #8**
- **Location:** `lib/stateManager.js:143, 130, 84, 66, 44`
- **Issue:** Match ID and tenant slug used in path construction without sanitization
- **Risk:** File system traversal, arbitrary file read/write
- **Attack Example:**
  ```
  matchId=../../../sensitive-file.txt
  → Reads files outside intended scope
  ```
- **Impact:** Information disclosure, system compromise, data exfiltration

---

#### 6. Incomplete String Escaping or Encoding

**Alert #7**
- **Location:** `views/dashboard.html:1589`
- **Issue:** Dynamic data embedded in HTML without complete escaping
- **Risk:** HTML/JavaScript injection via incomplete encoding
- **Attack Example:**
  ```
  Data: <script>alert(1)</script>
  → Partially escaped, but still dangerous in some contexts
  ```

**Alert #6**
- **Location:** `views/dashboard.html:1589`
- **Issue:** String interpolation without proper entity encoding
- **Risk:** XSS through incomplete escaping
- **Impact:** Malicious JavaScript execution

**Alert #5**
- **Location:** `Controller-offline.html:2615`
- **Issue:** Template output not fully escaped
- **Risk:** Injection attacks via template rendering
- **Impact:** Client-side code execution

---

#### 7. Bad HTML Filtering Regexp

**Alert #4**
- **Location:** `scripts/_syntaxcheck.js:3`
- **Issue:** Regex for extracting `<script>` tags is overly simplistic
- **Regex:** `/<script>([\s\S]*?)<\/script>/g`
- **Risk:** Can be bypassed via:
  - Nested or stacked script tags
  - CDATA sections
  - HTML5 script tag variations
  - Comments within scripts
- **Attack Example:**
  ```html
  <script><!-- <script> --> alert(1); <!-- --></script>
  → May not be correctly identified
  ```
- **Impact:** Malicious scripts not detected during syntax checking

---

### Medium Severity (7 Alerts)

#### 8. Server-Side URL Redirect

**Alert #3**
- **Location:** `server.js:67`
- **Issue:** HTTPS redirect may use untrusted host header
- **Risk:** Open redirect to attacker-controlled domain
- **Attack Example:**
  ```
  Host: attacker.com
  → Redirect to https://attacker.com/...
  ```
- **Impact:** Phishing, social engineering

---

#### 9. Client-Side URL Redirect

**Alert #2**
- **Location:** `views/login.html:88`
- **Issue:** `next` parameter controls redirect destination
- **Risk:** Attackers can redirect users post-login to malicious sites
- **Attack Example:**
  ```
  /login?next=https://attacker.com/phishing
  → After login, user redirected to attacker site
  ```
- **Impact:** Credential theft, malware distribution, phishing

---

#### 10. Exposure of Private Files

**Alert #1**
- **Location:** `server.js:506`
- **Issue:** Sensitive HTML files accessible directly without authentication
- **Files at Risk:**
  - `/Controller-offline.html` — Scorer control interface
  - `/Scoreboard*.html` — Match display templates
- **Risk:** Unauthorized access to match data and controls
- **Attack Example:**
  ```
  GET /Controller-offline.html
  → Attacker gains access to match controller
  ```
- **Impact:** Match manipulation, data disclosure, unauthorized scoring

---

#### 11. Inclusion of Functionality from Untrusted Source

**Alert #26**
- **Location:** `views/saas-admin.html:13`
- **Issue:** Admin page may load scripts or resources without validation
- **Risk:** Supply chain attack or compromised dependencies
- **Attack Example:**
  ```html
  <script src="https://cdn.example.com/admin.js"></script>
  → If CDN compromised, attacker code executes
  ```
- **Impact:** Admin account compromise, system-wide malware injection

---

## Dependabot Vulnerabilities (11 Alerts)

### High Severity: Multer File Upload Package (7 Alerts)

**Alerts #3, #9, #8, #7, #2, #1, #4**

**Multer Denial of Service Vulnerabilities:**

**Package:** `multer` v1.4.5-lts.1  
**Affected Endpoint:** `/api/upload`

**Vulnerability Types:**

1. **Unhandled Exception DoS (#3)**
   - Malformed multipart/form-data triggers unhandled exceptions
   - Crashes request handler

2. **Uncontrolled Recursion DoS (#9)**
   - Deeply nested form data causes stack overflow
   - Denial of service

3. **Incomplete Cleanup DoS (#8)**
   - Failed uploads don't release file handles/memory
   - Resource exhaustion over time

4. **Resource Exhaustion DoS (#7)**
   - Large number of simultaneous uploads consume memory
   - Server becomes unresponsive

5. **Memory Leak DoS (#1)**
   - Unclosed streams from failed uploads leak memory
   - Memory exhaustion

6. **Maliciously Crafted Requests DoS (#2)**
   - Specially crafted multipart requests trigger infinite loops
   - CPU exhaustion

7. **Unhandled Exception from Malformed Request (#4)**
   - Certain malformed multipart headers cause crashes
   - Denial of service

**Attack Scenario:**
```
Attacker sends: 100 concurrent requests with malformed file uploads
Result: Server memory usage spikes → Server crashes
Impact: Legitimate users unable to upload files/match data
```

---

### High Severity: Nodemailer SMTP Package (4 Alerts)

**Package:** `nodemailer` v6.9.7  
**Affected Endpoints:** Email sending (signup welcome, notifications)

**Alert #6: Address Parser Denial of Service**
- **Issue:** Deeply nested email addresses cause infinite recursion
- **Attack Example:**
  ```
  email: "((((((((((x@example.com))))))))"
  → Recursion depth exhaustion
  ```
- **Impact:** Signup endpoint crashes, denial of service

**Alert #5: Email to Unintended Domain**
- **Issue:** Address parsing interprets certain formats incorrectly
- **Risk:** Emails sent to wrong recipient or wrong domain
- **Attack Example:**
  ```
  email: "admin@legit.com@attacker.com"
  → May send email to attacker.com instead
  ```
- **Impact:** Information disclosure, mail interception

**Alert #11: SMTP Command Injection via Transport Name**
- **Issue:** Unsanitized transport name parameter in SMTP
- **Risk:** CRLF injection into SMTP commands
- **Attack Example:**
  ```
  transport: "attacker\r\nRCPT TO: <attacker@evil.com>"
  → Injects arbitrary SMTP commands
  ```
- **Impact:** Email spoofing, unauthorized message routing

**Alert #10: SMTP Command Injection via envelope.size**
- **Issue:** Unvalidated `envelope.size` parameter
- **Risk:** Injection into SMTP SIZE command
- **Attack Example:**
  ```
  size: "1000\r\nRCPT TO: <attacker@evil.com>"
  → Command injection via size parameter
  ```
- **Impact:** Email spoofing, credential theft via social engineering

---

### Moderate Severity: UUID Package (1 Alert)

**Alert #12**
- **Package:** `uuid` v9.0.0
- **Issue:** Missing buffer bounds check in v3/v5/v6 when `buf` parameter is provided
- **Risk:** Buffer overflow if custom buffer too small
- **Attack Example:**
  ```javascript
  uuid.v5(namespace, name, buffer_that_is_too_small)
  → Writes beyond buffer boundary
  ```
- **Impact:** Memory corruption, potential code execution (if exploitable)
- **Note:** Current code uses v4 (random), but library vulnerability exists

---

## Vulnerability Summary by Category

| Type | Count | Severity | Impact |
|------|-------|----------|--------|
| **Injection Attacks** (XSS, Path Traversal, SMTP Command) | 18 | High | Code execution, data theft |
| **Authentication/Authorization** | 3 | High | Unauthorized access, session hijacking |
| **Denial of Service** | 8 | High | Service unavailability |
| **Open Redirects** | 2 | Medium | Phishing, social engineering |
| **Information Disclosure** | 2 | Medium | Sensitive data exposure |
| **Configuration Issues** | 2 | Medium | Misconfiguration risks |
| **TOTAL** | **35** | - | **CRITICAL** |

---

## Risk Assessment

### Critical Path Vulnerabilities
- **Path Traversal** (14 alerts) — File system access compromised
- **XSS** (4 alerts) — User data theft, session hijacking
- **Multer DoS** (7 alerts) — Upload functionality vulnerable
- **Missing CSRF** (1 alert) — Unauthorized state changes

### Attack Chain Example
```
1. Attacker crafts malicious email: admin@legit.com@attacker.com
   → Signup sends welcome email to attacker
   
2. Attacker gets access to reset links
   → Gains account access
   
3. Attacker uses path traversal: slug=../../../
   → Accesses other tenants' data
   
4. Attacker injects XSS: matchId=<img src=x onerror=alert(1)>
   → Hijacks other users' sessions
```

---

## Files Requiring Remediation

| File | Severity | Alert Count |
|------|----------|-------------|
| `server.js` | High | 8 |
| `routes/auth.js` | High | 5 |
| `routes/club.js` | High | 1 |
| `routes/match.js` | High | 4 |
| `lib/stateManager.js` | High | 6 |
| `views/dashboard.html` | High | 2 |
| `views/login.html` | High | 2 |
| `scripts/_syntaxcheck.js` | High | 1 |
| `views/saas-admin.html` | Medium | 1 |
| `package.json` (dependencies) | High/Medium | 11 |

---

## Recommendations

### Immediate Actions Required
1. Implement input validation for all user-supplied values
2. Add CSRF token validation to all state-changing endpoints
3. Escape all HTML output using context-appropriate encoding
4. Upgrade Multer and Nodemailer packages
5. Add security headers (Helmet.js configuration review)

### Short-term (Within 1 week)
- Security audit of all file path operations
- XSS vulnerability testing (manual + automated)
- Rate limiting verification on upload endpoints
- SMTP injection testing

### Long-term
- Enable GitHub Dependabot automatic updates
- Implement CodeQL scanning in CI/CD
- Regular security penetration testing
- Multi-tenant isolation verification

---

**Report Generated:** 2026-05-02  
**Total Vulnerabilities:** 33  
**Critical Severity:** 21  
**High Severity:** 7  
**Medium Severity:** 5
