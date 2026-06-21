// ExpoCacReaderModule.swift
//
// CAC / PIV Smart Card Reader — iOS CryptoTokenKit Implementation
// ==============================================================
//
// What this does:
//   Communicates with physical CAC cards via the CryptoTokenKit framework
//   (available on iOS 10+). On devices with a USB-C or Lightning card reader
//   (ACR3901T-W1, BT-SC-1, Identiv SCR3500A), the OS presents the card as
//   a TKSmartCard token. This module:
//
//   1. Watches for card insertion/removal via TKTokenWatcher
//   2. Opens a session to the card using TKSmartCard
//   3. Selects the NIST PIV Application (AID A0 00 00 03 08 00 00 10 00 01 00)
//   4. Reads the X.509 Authentication Certificate from slot 9A
//   5. Performs a challenge-response using GENERAL AUTHENTICATE (ISO 7816)
//      — private key signs the challenge inside the card, NEVER exported
//   6. Returns the certificate DER + signature to the JS layer for server verification
//
// How it helps Tabula Medica win DoD contracts:
//   - DoD requires CAC authentication for all personnel accessing PHI
//   - Without hardware CAC support, the app is limited to IL4 software certs
//   - With this module, the app achieves IL4/IL5 hardware assurance (IAL3)
//   - This is the single feature that separates commercial health apps from
//     DoD-eligible platforms — virtually no competitor has native CAC support
//
// DISA STIGs addressed:
//   AIOS-13-010300 — DoD PKI authentication required
//   AIOS-13-010400 — Certificate-based authentication for sensitive data
//   CAT I finding in most DoD mobile app assessments without CAC support
//
// Supported hardware (all use standard PC/SC protocol):
//   - ACR3901T-W1 Bluetooth CAC reader (most common DoD-issued reader)
//   - Identiv SCR3500A USB-C reader
//   - HID Omnikey 3021 USB reader
//   - Apriva CAMP iOS CAC reader (Lightning)
//   Any PC/SC compliant reader that iOS can see as a TKSmartCard

import ExpoModulesCore
import CryptoTokenKit
import Security
import Foundation

// ─── PIV Application constants ────────────────────────────────────────────────
// Source: NIST SP 800-73-4 Part 2

private let PIV_AID: [UInt8] = [0xA0, 0x00, 0x00, 0x03, 0x08, 0x00, 0x00, 0x10, 0x00, 0x01, 0x00]

// PIV object IDs for certificate slots
private let PIV_OBJ_AUTH_CERT:    [UInt8] = [0x5C, 0x03, 0x5F, 0xC1, 0x05] // Slot 9A — PIV Authentication
private let PIV_OBJ_SIGN_CERT:    [UInt8] = [0x5C, 0x03, 0x5F, 0xC1, 0x0A] // Slot 9C — Digital Signature
private let PIV_OBJ_MGMT_CERT:    [UInt8] = [0x5C, 0x03, 0x5F, 0xC1, 0x0B] // Slot 9D — Key Management
private let PIV_OBJ_CARDAUTH_CERT:[UInt8] = [0x5C, 0x03, 0x5F, 0xC1, 0x01] // Slot 9E — Card Authentication

// APDU class bytes
private let CLA_ISO: UInt8 = 0x00
private let INS_SELECT:           UInt8 = 0xA4
private let INS_GET_DATA:         UInt8 = 0xCB
private let INS_GENERAL_AUTH:     UInt8 = 0x87
private let INS_VERIFY:           UInt8 = 0x20
private let INS_GET_RESPONSE:     UInt8 = 0xC0

// Status words
private let SW_SUCCESS:            UInt16 = 0x9000
private let SW_MORE_DATA_MASK:     UInt16 = 0x6100
private let SW_WRONG_PIN_MASK:     UInt16 = 0x63C0
private let SW_PIN_BLOCKED:        UInt16 = 0x6983
private let SW_SECURITY_NOT_SATISFIED: UInt16 = 0x6982

// ─── Expo Module definition ───────────────────────────────────────────────────

public class ExpoCacReaderModule: Module {

    private var tokenWatcher: TKTokenWatcher?
    private var currentCard: TKSmartCard?
    private var currentSession: TKSmartCardSession?

    public func definition() -> ModuleDefinition {
        Name("ExpoCacReader")

        // ── Events ──────────────────────────────────────────────────────────
        Events(
            "onCardInserted",    // { tokenId: string, readerName: string }
            "onCardRemoved",     // { tokenId: string }
            "onReaderConnected", // { readerName: string }
            "onReaderDisconnected"
        )

        // ── Functions ────────────────────────────────────────────────────────

        /// Start watching for CAC card insertion/removal
        AsyncFunction("startWatching") { (promise: Promise) in
            DispatchQueue.main.async {
                self.tokenWatcher = TKTokenWatcher { [weak self] tokenId in
                    // Card inserted
                    self?.sendEvent("onCardInserted", [
                        "tokenId": tokenId,
                        "readerName": self?.getReaderName(for: tokenId) ?? "Unknown Reader"
                    ])
                } removal: { [weak self] tokenId in
                    // Card removed — clear session
                    if self?.currentCard?.token?.tokenID == tokenId {
                        self?.currentSession = nil
                        self?.currentCard = nil
                    }
                    self?.sendEvent("onCardRemoved", ["tokenId": tokenId])
                }
                promise.resolve(true)
            }
        }

        AsyncFunction("stopWatching") { (promise: Promise) in
            self.tokenWatcher = nil
            promise.resolve(true)
        }

        /// List connected smart card readers
        AsyncFunction("getAvailableReaders") { (promise: Promise) in
            let manager = TKSmartCardSlotManager.default
            let slotNames = manager?.slotNames ?? []
            var readers: [[String: Any]] = []

            for name in slotNames {
                manager?.getSlot(withName: name) { slot in
                    guard let slot = slot else { return }
                    let readerInfo: [String: Any] = [
                        "name": name,
                        "hasCard": slot.state == .validCard || slot.state == .validCardMuted,
                        "state": slot.state.rawValue
                    ]
                    readers.append(readerInfo)
                }
            }

            // Also check for tokens via TKTokenWatcher
            let watcher = TKTokenWatcher { _ in } removal: { _ in }
            let tokenIds = watcher.tokenIDs

            promise.resolve([
                "readers": readers,
                "tokens": tokenIds,
                "supportsSmartCard": !slotNames.isEmpty || !tokenIds.isEmpty
            ])
        }

        /// Read the PIV authentication certificate from slot 9A
        /// Returns base64-encoded DER certificate + parsed fields
        AsyncFunction("readAuthCertificate") { (tokenId: String?, promise: Promise) in
            self.withSession(tokenId: tokenId, promise: promise) { [weak self] session in
                guard let self = self else { return }

                do {
                    // 1. Select PIV application
                    try await self.selectPIVApplication(session: session)

                    // 2. Read certificate from slot 9A
                    let certDER = try await self.readPIVObject(
                        session: session,
                        objectId: PIV_OBJ_AUTH_CERT
                    )

                    // 3. Parse certificate fields
                    let parsed = self.parseCertificate(der: certDER)

                    promise.resolve([
                        "certDerBase64": certDER.base64EncodedString(),
                        "subject": parsed["subject"] ?? "",
                        "issuer": parsed["issuer"] ?? "",
                        "serialNumber": parsed["serialNumber"] ?? "",
                        "notBefore": parsed["notBefore"] ?? "",
                        "notAfter": parsed["notAfter"] ?? "",
                        "edipi": parsed["edipi"] ?? "",
                        "email": parsed["email"] ?? "",
                        "keyAlgorithm": parsed["keyAlgorithm"] ?? "",
                        "slot": "9A"
                    ])
                } catch CACError.pinRequired {
                    promise.reject("PIN_REQUIRED", "Card PIN required — call verifyPin() first")
                } catch CACError.cardNotFound {
                    promise.reject("CARD_NOT_FOUND", "No CAC card detected")
                } catch {
                    promise.reject("READ_FAILED", error.localizedDescription)
                }
            }
        }

        /// Verify the card PIN (required before signing operations)
        /// Returns: { success, retriesRemaining }
        AsyncFunction("verifyPin") { (pin: String, promise: Promise) in
            guard (4...8).contains(pin.count), pin.allSatisfy({ $0.isNumber }) else {
                promise.reject("INVALID_PIN", "PIN must be 4–8 digits")
                return
            }

            self.withSession(tokenId: nil, promise: promise) { [weak self] session in
                guard let self = self else { return }

                do {
                    try await self.selectPIVApplication(session: session)
                    let retriesRemaining = try await self.verifyCardPin(session: session, pin: pin)
                    promise.resolve(["success": true, "retriesRemaining": retriesRemaining])
                } catch CACError.wrongPin(let retries) {
                    promise.resolve(["success": false, "retriesRemaining": retries])
                } catch CACError.pinBlocked {
                    promise.reject("PIN_BLOCKED", "Card PIN is blocked after too many failed attempts")
                } catch {
                    promise.reject("VERIFY_FAILED", error.localizedDescription)
                }
            }
        }

        /// Sign a challenge with the card's slot 9A private key
        /// The private key NEVER leaves the card — signing happens on-card
        AsyncFunction("signChallenge") { (challengeHex: String, promise: Promise) in
            guard challengeHex.count == 64, // 32 bytes = 64 hex chars
                  challengeHex.allSatisfy({ $0.isHexDigit }) else {
                promise.reject("INVALID_CHALLENGE", "Challenge must be 32 bytes (64 hex chars)")
                return
            }

            self.withSession(tokenId: nil, promise: promise) { [weak self] session in
                guard let self = self else { return }

                do {
                    try await self.selectPIVApplication(session: session)

                    // Detect key algorithm from certificate
                    let certDER = try await self.readPIVObject(session: session, objectId: PIV_OBJ_AUTH_CERT)
                    let parsed = self.parseCertificate(der: certDER)
                    let isECDSA = parsed["keyAlgorithm"]?.contains("EC") ?? true

                    // Perform GENERAL AUTHENTICATE
                    let challengeData = Data(hexString: challengeHex)!
                    let signature = try await self.generalAuthenticate(
                        session: session,
                        challenge: challengeData,
                        slot: 0x9A,
                        isECDSA: isECDSA
                    )

                    promise.resolve([
                        "signatureBase64": signature.base64EncodedString(),
                        "signatureHex": signature.hexString,
                        "algorithm": isECDSA ? "ECDSA-P384" : "RSA-2048",
                        "slot": "9A"
                    ])
                } catch CACError.pinRequired {
                    promise.reject("PIN_REQUIRED", "Call verifyPin() before signing")
                } catch CACError.signatureFailed(let reason) {
                    promise.reject("SIGN_FAILED", reason)
                } catch {
                    promise.reject("SIGN_FAILED", error.localizedDescription)
                }
            }
        }

        /// Get CHUID (Card Holder Unique Identifier) — contains FASC-N and GUID
        AsyncFunction("getCardInfo") { (promise: Promise) in
            self.withSession(tokenId: nil, promise: promise) { [weak self] session in
                guard let self = self else { return }
                do {
                    try await self.selectPIVApplication(session: session)
                    let chuidData = try await self.getChuid(session: session)
                    promise.resolve(chuidData)
                } catch {
                    promise.reject("READ_FAILED", error.localizedDescription)
                }
            }
        }

        AsyncFunction("disconnect") { (promise: Promise) in
            self.currentSession = nil
            self.currentCard = nil
            promise.resolve(true)
        }
    }

    // ─── Session management ────────────────────────────────────────────────────

    private func withSession(
        tokenId: String?,
        promise: Promise,
        work: @escaping (TKSmartCardSession) async throws -> Void
    ) {
        Task {
            do {
                let session = try await self.openSession(tokenId: tokenId)
                try await work(session)
            } catch CACError.cardNotFound {
                promise.reject("CARD_NOT_FOUND", "No CAC card detected. Connect a CAC card reader.")
            } catch CACError.sessionFailed(let reason) {
                promise.reject("SESSION_FAILED", reason)
            } catch {
                promise.reject("ERROR", error.localizedDescription)
            }
        }
    }

    private func openSession(tokenId: String?) async throws -> TKSmartCardSession {
        // Reuse existing session if available
        if let existing = currentSession {
            return existing
        }

        // Find card via token ID or first available
        let card: TKSmartCard
        if let tokenId = tokenId {
            guard let c = findCard(byTokenId: tokenId) else {
                throw CACError.cardNotFound
            }
            card = c
        } else {
            guard let c = findFirstCard() else {
                throw CACError.cardNotFound
            }
            card = c
        }

        currentCard = card

        return try await withCheckedThrowingContinuation { continuation in
            card.beginSession { session, error in
                if let error = error {
                    continuation.resume(throwing: CACError.sessionFailed(error.localizedDescription))
                    return
                }
                guard let session = session else {
                    continuation.resume(throwing: CACError.sessionFailed("Failed to open card session"))
                    return
                }
                self.currentSession = session
                continuation.resume(returning: session)
            }
        }
    }

    private func findCard(byTokenId tokenId: String) -> TKSmartCard? {
        let manager = TKSmartCardSlotManager.default
        for name in manager?.slotNames ?? [] {
            var foundCard: TKSmartCard?
            let sem = DispatchSemaphore(value: 0)
            manager?.getSlot(withName: name) { slot in
                defer { sem.signal() }
                if let slot = slot, slot.state == .validCard,
                   let card = slot.makeSmartCard(),
                   card.token?.tokenID == tokenId {
                    foundCard = card
                }
            }
            sem.wait()
            if let card = foundCard { return card }
        }
        return nil
    }

    private func findFirstCard() -> TKSmartCard? {
        let manager = TKSmartCardSlotManager.default
        for name in manager?.slotNames ?? [] {
            var foundCard: TKSmartCard?
            let sem = DispatchSemaphore(value: 0)
            manager?.getSlot(withName: name) { slot in
                defer { sem.signal() }
                if let slot = slot, slot.state == .validCard {
                    foundCard = slot.makeSmartCard()
                }
            }
            sem.wait()
            if let card = foundCard { return card }
        }
        return nil
    }

    private func getReaderName(for tokenId: String) -> String {
        let manager = TKSmartCardSlotManager.default
        return manager?.slotNames.first ?? "Smart Card Reader"
    }

    // ─── PIV APDU operations ──────────────────────────────────────────────────

    /// SELECT PIV Application by AID
    private func selectPIVApplication(session: TKSmartCardSession) async throws {
        // APDU: 00 A4 04 00 0B [PIV AID]
        var apdu = Data([CLA_ISO, INS_SELECT, 0x04, 0x00, UInt8(PIV_AID.count)])
        apdu.append(contentsOf: PIV_AID)

        let (_, sw) = try await sendAPDU(session: session, apdu: apdu)

        guard sw == SW_SUCCESS else {
            throw CACError.sessionFailed("PIV application not found on card (SW: \(String(format: "%04X", sw)))")
        }
    }

    /// GET DATA — read a PIV data object by object ID
    /// Handles chained responses (SW 61xx) for large objects like certificates
    private func readPIVObject(session: TKSmartCardSession, objectId: [UInt8]) async throws -> Data {
        // APDU: 00 CB 3F FF [length] 5C 03 [object ID]
        var apdu = Data([CLA_ISO, INS_GET_DATA, 0x3F, 0xFF])
        let payload = objectId
        apdu.append(UInt8(payload.count))
        apdu.append(contentsOf: payload)
        apdu.append(0x00) // Le = 0 means maximum

        var (response, sw) = try await sendAPDU(session: session, apdu: apdu)

        // Handle chained response (SW 61xx = more data available)
        while (sw & 0xFF00) == (SW_MORE_DATA_MASK & 0xFF00) {
            let remaining = UInt8(sw & 0x00FF)
            let getMore = Data([CLA_ISO, INS_GET_RESPONSE, 0x00, 0x00, remaining])
            let (moreData, moreSw) = try await sendAPDU(session: session, apdu: getMore)
            response.append(moreData)
            sw = moreSw

            if sw == SW_SECURITY_NOT_SATISFIED {
                throw CACError.pinRequired
            }
        }

        if sw == SW_SECURITY_NOT_SATISFIED {
            throw CACError.pinRequired
        }

        guard sw == SW_SUCCESS else {
            throw CACError.sessionFailed("GET DATA failed (SW: \(String(format: "%04X", sw)))")
        }

        // Extract certificate from BER-TLV encoding
        // PIV cert object: 53 [len] 70 [len] [cert DER] 71 01 [compression] FE 00
        return try extractCertFromPIVObject(response)
    }

    /// VERIFY — check card PIN
    private func verifyCardPin(session: TKSmartCardSession, pin: String) async throws -> Int {
        let pinBytes = pin.utf8.map { UInt8($0) }
        // APDU: 00 20 00 80 [length] [PIN bytes]
        var apdu = Data([CLA_ISO, INS_VERIFY, 0x00, 0x80, UInt8(pinBytes.count)])
        apdu.append(contentsOf: pinBytes)

        let (_, sw) = try await sendAPDU(session: session, apdu: apdu)

        if sw == SW_SUCCESS { return 3 } // PIN correct, assume 3 retries remaining

        if sw == SW_PIN_BLOCKED {
            throw CACError.pinBlocked
        }

        if (sw & 0xFFF0) == (SW_WRONG_PIN_MASK & 0xFFF0) {
            let retries = Int(sw & 0x000F)
            throw CACError.wrongPin(retries)
        }

        throw CACError.sessionFailed("PIN verify failed (SW: \(String(format: "%04X", sw)))")
    }

    /// GENERAL AUTHENTICATE — on-card signing
    /// The private key NEVER leaves the card. The card performs the cryptographic
    /// operation internally and returns only the signature.
    private func generalAuthenticate(
        session: TKSmartCardSession,
        challenge: Data,
        slot: UInt8,
        isECDSA: Bool
    ) async throws -> Data {
        // Build Dynamic Authentication Template (tag 7C)
        // 7C [len]
        //   82 00         (empty response tag — card fills this in)
        //   81 [len] [challenge]  (challenge tag)

        var dynamicAuthTemplate = Data()

        // Challenge (tag 81)
        let challengeTag: [UInt8] = [0x81, UInt8(challenge.count)]
        dynamicAuthTemplate.append(contentsOf: challengeTag)
        dynamicAuthTemplate.append(challenge)

        // Empty response placeholder (tag 82)
        dynamicAuthTemplate.append(contentsOf: [0x82, 0x00])

        // Wrap in outer 7C tag
        var payload = Data()
        payload.append(contentsOf: [0x7C, UInt8(dynamicAuthTemplate.count)])
        payload.append(dynamicAuthTemplate)

        // Algorithm reference: 06 = ECDSA P-384, 07 = ECDSA P-256, 06 = RSA-2048
        let algRef: UInt8 = isECDSA ? 0x06 : 0x07 // 0x06 = ECC P-384 per SP 800-73-4

        // APDU: 00 87 [alg] [slot] [len] [payload] 00
        var apdu = Data([CLA_ISO, INS_GENERAL_AUTH, algRef, slot])
        apdu.append(UInt8(payload.count))
        apdu.append(payload)
        apdu.append(0x00) // Le

        var (response, sw) = try await sendAPDU(session: session, apdu: apdu)

        // Handle chained response
        while (sw & 0xFF00) == (SW_MORE_DATA_MASK & 0xFF00) {
            let remaining = UInt8(sw & 0x00FF)
            let getMore = Data([CLA_ISO, INS_GET_RESPONSE, 0x00, 0x00, remaining])
            let (moreData, moreSw) = try await sendAPDU(session: session, apdu: getMore)
            response.append(moreData)
            sw = moreSw
        }

        if sw == SW_SECURITY_NOT_SATISFIED {
            throw CACError.pinRequired
        }

        guard sw == SW_SUCCESS else {
            throw CACError.signatureFailed("GENERAL AUTHENTICATE failed (SW: \(String(format: "%04X", sw)))")
        }

        // Extract signature from response (7C tag → 82 tag)
        return try extractSignatureFromAuthResponse(response)
    }

    /// GET DATA for CHUID object — contains FASC-N and card GUID
    private func getChuid(session: TKSmartCardSession) async throws -> [String: Any] {
        let chuidObjId: [UInt8] = [0x5C, 0x03, 0x5F, 0xC1, 0x02]
        let data = try await readPIVObject(session: session, objectId: chuidObjId)
        return parseChuid(data)
    }

    // ─── APDU transport ───────────────────────────────────────────────────────

    private func sendAPDU(session: TKSmartCardSession, apdu: Data) async throws -> (Data, UInt16) {
        return try await withCheckedThrowingContinuation { continuation in
            session.send(apdu) { response, error in
                if let error = error {
                    continuation.resume(throwing: CACError.sessionFailed(error.localizedDescription))
                    return
                }

                guard let response = response, response.count >= 2 else {
                    continuation.resume(throwing: CACError.sessionFailed("Empty APDU response"))
                    return
                }

                let sw = UInt16(response[response.count - 2]) << 8 | UInt16(response[response.count - 1])
                let responseData = response.dropLast(2)
                continuation.resume(returning: (Data(responseData), sw))
            }
        }
    }

    // ─── TLV parsing ─────────────────────────────────────────────────────────

    private func extractCertFromPIVObject(_ data: Data) throws -> Data {
        // BER-TLV: find tag 70 (Certificate container), then extract DER bytes
        var idx = 0
        while idx < data.count - 2 {
            let tag = data[idx]
            idx += 1

            var length = Int(data[idx])
            idx += 1

            if length == 0x81 {
                length = Int(data[idx]); idx += 1
            } else if length == 0x82 {
                length = Int(data[idx]) << 8 | Int(data[idx + 1]); idx += 2
            }

            if tag == 0x70 {
                // Certificate is nested under tag 70 — it's itself TLV
                // The actual DER cert starts with 0x30 (SEQUENCE)
                let certData = data.subdata(in: idx..<(idx + length))
                if certData.first == 0x30 {
                    return certData
                }
                // May have another level of wrapping
                return try extractInnerCert(certData)
            }

            guard idx + length <= data.count else { break }
            idx += length
        }

        // Fallback: find SEQUENCE tag directly
        if let seqStart = data.firstIndex(of: 0x30) {
            return Data(data[seqStart...])
        }

        throw CACError.sessionFailed("Could not find certificate in PIV object")
    }

    private func extractInnerCert(_ data: Data) throws -> Data {
        var idx = 0
        while idx < data.count - 2 {
            if data[idx] == 0x30 { return Data(data[idx...]) }
            idx += 1
        }
        throw CACError.sessionFailed("No DER SEQUENCE found in certificate container")
    }

    private func extractSignatureFromAuthResponse(_ data: Data) throws -> Data {
        // Response is 7C [len] 82 [len] [signature]
        guard data.count > 4, data[0] == 0x7C else {
            throw CACError.signatureFailed("Invalid GENERAL AUTHENTICATE response format")
        }

        var idx = 2 // Skip 7C and its length
        while idx < data.count - 1 {
            let tag = data[idx]; idx += 1
            var len = Int(data[idx]); idx += 1
            if len == 0x81 { len = Int(data[idx]); idx += 1 }
            else if len == 0x82 { len = Int(data[idx]) << 8 | Int(data[idx+1]); idx += 2 }

            if tag == 0x82 {
                return data.subdata(in: idx..<(idx + len))
            }
            idx += len
        }

        throw CACError.signatureFailed("Signature not found in GENERAL AUTHENTICATE response")
    }

    private func parseChuid(_ data: Data) -> [String: Any] {
        var result: [String: Any] = [:]
        var idx = 0
        while idx < data.count - 1 {
            let tag = data[idx]; idx += 1
            if idx >= data.count { break }
            var len = Int(data[idx]); idx += 1
            if len == 0x81 { len = Int(data[idx]); idx += 1 }
            guard idx + len <= data.count else { break }
            let value = data.subdata(in: idx..<(idx + len))

            switch tag {
            case 0x30: result["fascN"] = value.hexString      // FASC-N
            case 0x34: result["cardGuid"] = value.hexString   // Card UUID
            case 0x35: result["expirationDate"] = String(data: value, encoding: .utf8) ?? ""
            case 0x3E: result["issuerAsymmetricSignature"] = value.base64EncodedString()
            default: break
            }
            idx += len
        }
        return result
    }

    // ─── X.509 certificate parsing ────────────────────────────────────────────
    // Uses Security framework to parse DER-encoded certificate

    private func parseCertificate(der: Data) -> [String: String] {
        var result: [String: String] = [:]

        guard let cert = SecCertificateCreateWithData(nil, der as CFData) else {
            return result
        }

        // Subject
        if let subject = SecCertificateCopySubjectSummary(cert) {
            result["subject"] = subject as String
        }

        // Extract CN (EDIPI is in CN for CAC certs: "SMITH.JOHN.1234567890")
        let subjectStr = result["subject"] ?? ""
        if let cnRange = subjectStr.range(of: "\\d{10}", options: .regularExpression) {
            result["edipi"] = String(subjectStr[cnRange])
        }

        // Key algorithm
        if let key = SecCertificateCopyKey(cert) {
            let keyType = SecKeyGetBlockSize(key) > 256 ? "ECDSA-P384" : "RSA-2048"
            result["keyAlgorithm"] = keyType
        }

        // Full subject/issuer via SecCertificateCopyValues
        let oids = [kSecOIDCommonName, kSecOIDEmailAddress, kSecOIDIssuerEmailAddress] as CFArray
        if let values = SecCertificateCopyValues(cert, oids, nil) as? [String: Any] {
            if let cn = (values[kSecOIDCommonName as String] as? [String: Any])?["value"] as? String {
                result["commonName"] = cn
            }
            if let email = (values[kSecOIDEmailAddress as String] as? [String: Any])?["value"] as? String {
                result["email"] = email
            }
        }

        // Validity dates
        let props = SecCertificateCopyProperties(cert) as? [[String: Any]] ?? []
        for prop in props {
            if let label = prop["label"] as? String {
                if label.contains("Not Before"), let val = prop["value"] as? Date {
                    result["notBefore"] = ISO8601DateFormatter().string(from: val)
                }
                if label.contains("Not After"), let val = prop["value"] as? Date {
                    result["notAfter"] = ISO8601DateFormatter().string(from: val)
                }
            }
        }

        return result
    }
}

// ─── Error types ──────────────────────────────────────────────────────────────

enum CACError: Error {
    case cardNotFound
    case sessionFailed(String)
    case pinRequired
    case pinBlocked
    case wrongPin(Int)
    case signatureFailed(String)
    case invalidCertificate(String)
}

// ─── Data extensions ─────────────────────────────────────────────────────────

extension Data {
    var hexString: String {
        map { String(format: "%02hhx", $0) }.joined()
    }

    init?(hexString: String) {
        let len = hexString.count
        guard len % 2 == 0 else { return nil }
        var data = Data(capacity: len / 2)
        var i = hexString.startIndex
        while i < hexString.endIndex {
            let j = hexString.index(i, offsetBy: 2)
            guard let byte = UInt8(hexString[i..<j], radix: 16) else { return nil }
            data.append(byte)
            i = j
        }
        self = data
    }
}
